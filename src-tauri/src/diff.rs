use std::{fs, path::Path};

use crate::git_process::git;

pub(crate) fn file_diff(
    repo: &str,
    path: &str,
    staged: bool,
    status: &str,
    context_lines: Option<usize>,
) -> Result<Vec<serde_json::Value>, String> {
    if !staged && status == "?" {
        return untracked_file_diff(repo, path);
    }

    let output = file_diff_output(repo, path, staged, context_lines)?;
    Ok(parse_unified_diff_rows(&output))
}

fn file_diff_output(
    repo: &str,
    path: &str,
    staged: bool,
    context_lines: Option<usize>,
) -> Result<String, String> {
    let context_arg = format!("-U{}", context_lines.unwrap_or(3).min(20));
    let args = if staged {
        vec![
            "diff",
            "--find-renames",
            "--find-copies",
            context_arg.as_str(),
            "--cached",
            "--",
            path,
        ]
    } else {
        vec![
            "diff",
            "--find-renames",
            "--find-copies",
            context_arg.as_str(),
            "--",
            path,
        ]
    };
    git(repo, &args)
}

pub(crate) fn parse_unified_diff_rows(output: &str) -> Vec<serde_json::Value> {
    let mut rows = Vec::new();
    let mut hunk_index: Option<usize> = None;
    let mut next_hunk_index = 0usize;
    let mut old_line = 0usize;
    let mut new_line = 0usize;

    for line in output
        .lines()
        .filter(|l| !l.starts_with("diff --git") && !l.starts_with("index "))
        .take(1200)
    {
        if line.starts_with("@@") {
            hunk_index = Some(next_hunk_index);
            next_hunk_index += 1;
            let (old_start, new_start) = parse_hunk_header(line);
            old_line = old_start;
            new_line = new_start;
            rows.push(serde_json::json!({ "type": "hunk", "left": "", "right": "", "text": line, "hunkIndex": hunk_index }));
        } else if line.starts_with("Binary files ") {
            rows.push(serde_json::json!({ "type": "binary", "left": "", "right": "", "text": line, "hunkIndex": hunk_index }));
        } else if is_diff_metadata_line(line) {
            rows.push(serde_json::json!({ "type": "meta", "left": "", "right": "", "text": line, "hunkIndex": hunk_index }));
        } else if line.starts_with('+') && !line.starts_with("+++") {
            rows.push(serde_json::json!({ "type": "add", "left": "", "right": new_line, "text": line, "hunkIndex": hunk_index }));
            new_line += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            rows.push(serde_json::json!({ "type": "remove", "left": old_line, "right": "", "text": line, "hunkIndex": hunk_index }));
            old_line += 1;
        } else {
            let is_file_header = line.starts_with("---") || line.starts_with("+++");
            rows.push(serde_json::json!({ "type": if is_file_header { "file" } else { "same" }, "left": if is_file_header { serde_json::Value::String("".into()) } else { serde_json::json!(old_line) }, "right": if is_file_header { serde_json::Value::String("".into()) } else { serde_json::json!(new_line) }, "text": line, "hunkIndex": hunk_index }));
            if !is_file_header {
                old_line += 1;
                new_line += 1;
            }
        }
    }
    rows
}

fn is_diff_metadata_line(line: &str) -> bool {
    line.starts_with("old mode ")
        || line.starts_with("new mode ")
        || line.starts_with("deleted file mode ")
        || line.starts_with("new file mode ")
        || line.starts_with("similarity index ")
        || line.starts_with("dissimilarity index ")
        || line.starts_with("rename from ")
        || line.starts_with("rename to ")
        || line.starts_with("copy from ")
        || line.starts_with("copy to ")
}

fn parse_hunk_header(header: &str) -> (usize, usize) {
    let mut old_start = 0;
    let mut new_start = 0;
    for part in header.split_whitespace() {
        if let Some(value) = part.strip_prefix('-') {
            old_start = value
                .split(',')
                .next()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
        } else if let Some(value) = part.strip_prefix('+') {
            new_start = value
                .split(',')
                .next()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
        }
    }
    (old_start, new_start)
}

pub(crate) fn hunk_patch(
    repo: &str,
    path: &str,
    staged: bool,
    target_hunk_index: usize,
) -> Result<String, String> {
    let output = file_diff_output(repo, path, staged, None)?;
    let mut headers = Vec::new();
    let mut hunks: Vec<Vec<&str>> = Vec::new();
    let mut current_hunk: Option<Vec<&str>> = None;

    for line in output.lines() {
        if line.starts_with("@@") {
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }
            current_hunk = Some(vec![line]);
        } else if let Some(hunk) = current_hunk.as_mut() {
            hunk.push(line);
        } else {
            headers.push(line);
        }
    }
    if let Some(hunk) = current_hunk {
        hunks.push(hunk);
    }

    let hunk = hunks
        .get(target_hunk_index)
        .ok_or_else(|| format!("Diff hunk {target_hunk_index} no longer exists."))?;
    let mut patch = String::new();
    for line in headers {
        patch.push_str(line);
        patch.push('\n');
    }
    for line in hunk {
        patch.push_str(line);
        patch.push('\n');
    }
    Ok(patch)
}

fn untracked_file_diff(repo: &str, path: &str) -> Result<Vec<serde_json::Value>, String> {
    let full_path = Path::new(repo).join(path);
    if fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0) > 256 * 1024 {
        return Ok(vec![
            serde_json::json!({ "type": "hunk", "left": "", "right": "", "text": "@@ large untracked file preview skipped @@" }),
        ]);
    }
    let contents = match fs::read_to_string(&full_path) {
        Ok(contents) => contents,
        Err(_) => {
            return Ok(vec![serde_json::json!({
                "type": "binary",
                "left": "",
                "right": "",
                "text": "Binary file preview skipped"
            })]);
        }
    };
    let mut rows = vec![
        serde_json::json!({ "type": "hunk", "left": "", "right": "", "text": "@@ new file @@" }),
    ];
    rows.extend(contents.lines().take(799).enumerate().map(|(index, line)| {
        serde_json::json!({ "type": "add", "left": "", "right": index + 1, "text": format!("+{line}") })
    }));
    Ok(rows)
}
