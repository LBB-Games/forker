use std::{collections::HashMap, path::Path};

use crate::{
    diff::parse_unified_diff_rows,
    git_process::{current_branch, git},
    models::{
        BranchHistoryInfo, ChangedFile, CommitDetailsInfo, CommitDiffInfo, FileHistoryInfo,
        HistoryCommitInfo,
    },
};

pub(crate) fn commit_details(repo: &str, id: &str) -> Result<CommitDetailsInfo, String> {
    let changed_paths = commit_changed_files(repo, id)?;
    let files = changed_paths.len();
    let (insertions, deletions) = changed_paths.iter().fold((0, 0), |totals, file| {
        parse_line_stats(&file.lines)
            .map(|stats| (totals.0 + stats.0, totals.1 + stats.1))
            .unwrap_or(totals)
    });
    let message = git(repo, &["log", "-1", "--format=%B", id])?
        .trim()
        .to_string();

    Ok(CommitDetailsInfo {
        id: id.to_string(),
        files,
        insertions,
        deletions,
        message,
        changed_paths,
    })
}

pub(crate) fn commit_diff_info(
    repo: &str,
    id: &str,
    file_path: Option<&str>,
    context_lines: Option<usize>,
) -> Result<CommitDiffInfo, String> {
    let metadata = commit_metadata(repo, id)?;
    let changed_paths = commit_changed_files(repo, id)?;
    let files = changed_paths.len();
    let (insertions, deletions) = changed_paths.iter().fold((0, 0), |totals, file| {
        parse_line_stats(&file.lines)
            .map(|stats| (totals.0 + stats.0, totals.1 + stats.1))
            .unwrap_or(totals)
    });
    let selected_file_path = file_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let diff_rows = if selected_file_path.is_some() {
        let diff_output = commit_patch(repo, id, selected_file_path.as_deref(), context_lines)?;
        parse_unified_diff_rows(&diff_output)
    } else {
        Vec::new()
    };

    Ok(CommitDiffInfo {
        id: metadata.id,
        short_id: metadata.short_id,
        subject: metadata.subject,
        author: metadata.author,
        author_email: metadata.author_email,
        date: metadata.date,
        refs: metadata.refs,
        parents: metadata.parents,
        files,
        insertions,
        deletions,
        message: metadata.message,
        selected_file_path,
        changed_paths,
        diff_rows,
    })
}

pub(crate) fn file_history(
    repo: &str,
    file_path: &str,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<FileHistoryInfo, String> {
    let file_path = file_path.trim();
    if file_path.is_empty() {
        return Err("Choose a file before opening file history.".into());
    }
    let limit = bounded_history_limit(limit);
    let skip = skip.unwrap_or(0);
    let output = history_log(repo, None, Some(file_path), true, limit, skip)?;

    Ok(FileHistoryInfo {
        path: file_path.to_string(),
        limit,
        skip,
        best_effort_rename_following: true,
        entries: parse_history_log(&output),
    })
}

pub(crate) fn branch_history(
    repo: &str,
    branch_name: &str,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<BranchHistoryInfo, String> {
    let branch_name = branch_name.trim();
    if branch_name.is_empty() {
        return Err("Choose a branch before opening branch history.".into());
    }
    let limit = bounded_history_limit(limit);
    let skip = skip.unwrap_or(0);
    let current = current_branch(repo) == branch_name;
    let kind = branch_kind(repo, branch_name);
    let upstream = if kind == "local" {
        branch_upstream(repo, branch_name)
    } else {
        None
    };
    let (ahead, behind) = branch_ahead_behind(repo, branch_name, upstream.as_deref());
    let output = history_log(repo, Some(branch_name), None, false, limit, skip)?;

    Ok(BranchHistoryInfo {
        branch_name: branch_name.to_string(),
        kind,
        current,
        upstream,
        ahead,
        behind,
        limit,
        skip,
        entries: parse_history_log(&output),
    })
}

struct CommitMetadata {
    id: String,
    short_id: String,
    subject: String,
    author: String,
    author_email: String,
    date: String,
    refs: Vec<String>,
    parents: Vec<String>,
    message: String,
}

fn commit_metadata(repo: &str, id: &str) -> Result<CommitMetadata, String> {
    let output = git(
        repo,
        &[
            "log",
            "-1",
            "--date=format:%m/%d/%y %H:%M",
            "--decorate=short",
            "--format=%H%x1f%h%x1f%P%x1f%s%x1f%an%x1f%ae%x1f%ad%x1f%D%x1f%B",
            id,
        ],
    )?;
    let mut fields = output.splitn(9, '\u{1f}');
    let full_id = fields.next().unwrap_or_default().trim().to_string();
    let short_id = fields.next().unwrap_or_default().trim().to_string();
    let parents = parse_parents(fields.next().unwrap_or_default());
    let subject = fields.next().unwrap_or_default().trim().to_string();
    let author = fields.next().unwrap_or_default().trim().to_string();
    let author_email = fields.next().unwrap_or_default().trim().to_string();
    let date = fields.next().unwrap_or_default().trim().to_string();
    let refs = parse_refs(fields.next().unwrap_or_default());
    let message = fields.next().unwrap_or_default().trim().to_string();

    Ok(CommitMetadata {
        id: if full_id.is_empty() {
            id.to_string()
        } else {
            full_id
        },
        short_id: if short_id.is_empty() {
            id.chars().take(8).collect()
        } else {
            short_id
        },
        subject,
        author,
        author_email,
        date,
        refs,
        parents,
        message,
    })
}

fn commit_patch(
    repo: &str,
    id: &str,
    file_path: Option<&str>,
    context_lines: Option<usize>,
) -> Result<String, String> {
    let context_arg = format!("-U{}", context_lines.unwrap_or(3).min(20));
    let mut args = if let Some(first_parent) = commit_first_parent(repo, id)? {
        vec![
            "diff".to_string(),
            "--find-renames".to_string(),
            "--find-copies".to_string(),
            context_arg,
            first_parent,
            id.to_string(),
        ]
    } else {
        vec![
            "diff-tree".to_string(),
            "--root".to_string(),
            "--no-commit-id".to_string(),
            "-p".to_string(),
            "--find-renames".to_string(),
            "--find-copies".to_string(),
            context_arg,
            id.to_string(),
        ]
    };

    if let Some(path) = file_path.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--".to_string());
        args.push(path.to_string());
    }

    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    git(repo, &arg_refs)
}

fn bounded_history_limit(limit: Option<usize>) -> usize {
    limit.unwrap_or(80).clamp(1, 200)
}

fn history_log(
    repo: &str,
    revision: Option<&str>,
    file_path: Option<&str>,
    follow: bool,
    limit: usize,
    skip: usize,
) -> Result<String, String> {
    let limit_arg = format!("--max-count={limit}");
    let skip_arg = format!("--skip={skip}");
    let format_arg = "--pretty=format:%x1e%H%x1f%h%x1f%P%x1f%s%x1f%an%x1f%ad%x1f%D";
    let mut args = vec![
        "log".to_string(),
        "--date=format:%m/%d/%y %H:%M".to_string(),
        "--decorate=short".to_string(),
        limit_arg,
        skip_arg,
    ];
    if follow {
        args.push("--follow".to_string());
    }
    args.push(format_arg.to_string());
    args.push("--numstat".to_string());
    if let Some(revision) = revision.map(str::trim).filter(|value| !value.is_empty()) {
        args.push(revision.to_string());
    }
    args.push("--".to_string());
    if let Some(file_path) = file_path.map(str::trim).filter(|value| !value.is_empty()) {
        args.push(file_path.to_string());
    }

    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    git(repo, &arg_refs)
}

pub(crate) fn parse_history_log(output: &str) -> Vec<HistoryCommitInfo> {
    output
        .split('\u{1e}')
        .filter_map(|record| parse_history_record(record.trim()))
        .collect()
}

fn parse_history_record(record: &str) -> Option<HistoryCommitInfo> {
    let mut lines = record.lines();
    let header = lines.next()?.trim();
    if header.is_empty() {
        return None;
    }
    let mut fields = header.split('\u{1f}');
    let id = fields.next().unwrap_or_default().trim().to_string();
    if id.is_empty() {
        return None;
    }
    let short_id = fields.next().unwrap_or_default().trim().to_string();
    let parents = parse_parents(fields.next().unwrap_or_default());
    let subject = fields.next().unwrap_or_default().trim().to_string();
    let author = fields.next().unwrap_or_default().trim().to_string();
    let date = fields.next().unwrap_or_default().trim().to_string();
    let refs = parse_refs(fields.next().unwrap_or_default());
    let mut files = 0usize;
    let mut insertions = 0usize;
    let mut deletions = 0usize;
    let mut binary_files = 0usize;

    for line in lines {
        if let Some(stats) = parse_numstat_line(line) {
            files += 1;
            if stats.binary {
                binary_files += 1;
            } else {
                insertions += stats.insertions;
                deletions += stats.deletions;
            }
        }
    }

    Some(HistoryCommitInfo {
        id,
        short_id,
        parents,
        subject,
        author,
        date,
        refs,
        files,
        insertions,
        deletions,
        binary_files,
        lines: history_line_stats(insertions, deletions, binary_files),
    })
}

struct ParsedNumstatLine {
    insertions: usize,
    deletions: usize,
    binary: bool,
}

fn parse_numstat_line(line: &str) -> Option<ParsedNumstatLine> {
    let mut cols = line.split('\t');
    let added = cols.next()?.trim();
    let deleted = cols.next()?.trim();
    let path = cols.next()?.trim();
    if path.is_empty() {
        return None;
    }
    if added == "-" || deleted == "-" {
        return Some(ParsedNumstatLine {
            insertions: 0,
            deletions: 0,
            binary: true,
        });
    }
    Some(ParsedNumstatLine {
        insertions: added.parse().ok()?,
        deletions: deleted.parse().ok()?,
        binary: false,
    })
}

fn history_line_stats(insertions: usize, deletions: usize, binary_files: usize) -> String {
    if binary_files > 0 && insertions == 0 && deletions == 0 {
        return format!("{binary_files} binary");
    }
    if binary_files > 0 {
        return format!("+{insertions} −{deletions} · {binary_files} binary");
    }
    format!("+{insertions} −{deletions}")
}

fn parse_parents(parents: &str) -> Vec<String> {
    parents
        .split_whitespace()
        .map(str::trim)
        .filter(|parent| !parent.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_refs(refs: &str) -> Vec<String> {
    refs.split(',')
        .map(str::trim)
        .filter(|r| !r.is_empty() && *r != "HEAD")
        .map(|r| r.strip_prefix("HEAD -> ").unwrap_or(r).to_string())
        .collect()
}

fn branch_kind(repo: &str, branch_name: &str) -> String {
    if git(
        repo,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch_name}"),
        ],
    )
    .is_ok()
    {
        return "local".into();
    }
    if git(
        repo,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/remotes/{branch_name}"),
        ],
    )
    .is_ok()
    {
        return "remote".into();
    }
    "unknown".into()
}

fn branch_upstream(repo: &str, branch_name: &str) -> Option<String> {
    git(
        repo,
        &[
            "for-each-ref",
            &format!("refs/heads/{branch_name}"),
            "--format=%(upstream:short)",
        ],
    )
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

fn branch_ahead_behind(repo: &str, branch_name: &str, upstream: Option<&str>) -> (usize, usize) {
    let Some(upstream) = upstream else {
        return (0, 0);
    };
    let Ok(output) = git(
        repo,
        &[
            "rev-list",
            "--left-right",
            "--count",
            &format!("{upstream}...{branch_name}"),
        ],
    ) else {
        return (0, 0);
    };
    let mut parts = output.split_whitespace();
    let behind = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    let ahead = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    (ahead, behind)
}

fn commit_changed_files(repo: &str, id: &str) -> Result<Vec<ChangedFile>, String> {
    let name_status = commit_diff(repo, id, &["--name-status", "-r", "-M"])?;
    let stats = commit_numstat(repo, id);
    Ok(name_status
        .lines()
        .filter_map(|line| {
            let cols = line.split('\t').collect::<Vec<_>>();
            let status = cols.first()?.chars().next().unwrap_or('M');
            let path = cols.last()?.trim();
            if path.is_empty() {
                None
            } else {
                Some(changed_file(path, status, "commit", stats.get(path)))
            }
        })
        .collect())
}

fn commit_numstat(repo: &str, id: &str) -> HashMap<String, (usize, usize)> {
    let Ok(output) = commit_diff(repo, id, &["--numstat", "--find-renames"]) else {
        return HashMap::new();
    };
    parse_numstat(&output)
}

fn commit_diff(repo: &str, id: &str, diff_args: &[&str]) -> Result<String, String> {
    let args = if let Some(first_parent) = commit_first_parent(repo, id)? {
        let mut args = vec!["diff".to_string()];
        args.extend(diff_args.iter().map(|arg| arg.to_string()));
        args.push(first_parent);
        args.push(id.to_string());
        args
    } else {
        let mut args = vec![
            "diff-tree".to_string(),
            "--root".to_string(),
            "--no-commit-id".to_string(),
        ];
        args.extend(diff_args.iter().map(|arg| arg.to_string()));
        args.push(id.to_string());
        args
    };
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();
    git(repo, &arg_refs)
}

fn commit_first_parent(repo: &str, id: &str) -> Result<Option<String>, String> {
    let output = git(repo, &["rev-list", "--parents", "-n", "1", id])?;
    let mut parts = output.split_whitespace();
    let _commit = parts.next();
    Ok(parts.next().map(str::to_string))
}

pub(crate) fn changed_files(repo: &str) -> Result<Vec<ChangedFile>, String> {
    let output = git(
        repo,
        &["status", "--porcelain=v1", "-z", "--untracked-files=normal"],
    )?;
    let staged_stats = diff_numstat(repo, true);
    let unstaged_stats = diff_numstat(repo, false);
    let mut files = Vec::new();
    let entries = output.split_terminator('\0').collect::<Vec<_>>();
    let mut index = 0;

    while let Some(line) = entries.get(index) {
        index += 1;
        if line.len() < 4 {
            continue;
        }

        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let path = line[3..].to_string();

        // In porcelain -z mode, renamed/copied entries are emitted as
        // "XY new-path\0old-path\0". The UI should display and operate on the
        // new path, so skip the following old-path record.
        if matches!(index_status, 'R' | 'C') || matches!(worktree_status, 'R' | 'C') {
            index += 1;
        }

        if index_status != ' ' && index_status != '?' {
            files.push(changed_file(
                &path,
                index_status,
                "staged",
                staged_stats.get(&path),
            ));
        }
        if worktree_status != ' ' || index_status == '?' {
            let status = if index_status == '?' {
                '?'
            } else {
                worktree_status
            };
            files.push(changed_file(
                &path,
                status,
                "unstaged",
                unstaged_stats.get(&path),
            ));
        }
    }
    Ok(files)
}
pub(crate) fn changed_file(
    path: &str,
    status: char,
    section: &str,
    stat: Option<&(usize, usize)>,
) -> ChangedFile {
    let (label, tone) = status_label(status);
    ChangedFile {
        status: status.to_string(),
        label: label.into(),
        path: path.into(),
        folder: Path::new(path)
            .parent()
            .and_then(|f| f.to_str())
            .filter(|f| !f.is_empty())
            .unwrap_or(".")
            .into(),
        section: section.into(),
        tone: tone.into(),
        lines: stat
            .map(|(insertions, deletions)| format!("+{insertions} −{deletions}"))
            .unwrap_or_else(|| "±0".into()),
    }
}
fn status_label(status: char) -> (&'static str, &'static str) {
    match status {
        'A' | '?' => ("Added", "added"),
        'D' => ("Deleted", "deleted"),
        'R' => ("Renamed", "modified"),
        'C' => ("Copied", "modified"),
        _ => ("Modified", "modified"),
    }
}
fn diff_numstat(repo: &str, staged: bool) -> HashMap<String, (usize, usize)> {
    let args = if staged {
        vec!["diff", "--cached", "--numstat"]
    } else {
        vec!["diff", "--numstat"]
    };
    let Ok(output) = git(repo, &args) else {
        return HashMap::new();
    };
    parse_numstat(&output)
}
fn parse_numstat(output: &str) -> HashMap<String, (usize, usize)> {
    output
        .lines()
        .filter_map(|line| {
            let mut cols = line.split('\t');
            let insertions = cols.next()?.parse::<usize>().ok()?;
            let deletions = cols.next()?.parse::<usize>().ok()?;
            let path = cols.collect::<Vec<_>>().join(" → ");
            if path.is_empty() {
                None
            } else {
                Some((path, (insertions, deletions)))
            }
        })
        .collect()
}
pub(crate) fn parse_line_stats(lines: &str) -> Option<(usize, usize)> {
    let (added, deleted) = lines.split_once(' ')?;
    Some((
        added.strip_prefix('+')?.parse().ok()?,
        deleted.strip_prefix('−')?.parse().ok()?,
    ))
}
