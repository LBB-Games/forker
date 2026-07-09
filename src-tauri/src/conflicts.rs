use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use crate::{
    git_process::{git, git_executable, repo_root},
    models::{
        ConflictFile, ConflictFilePreview, ConflictOperation, ConflictPreviewSide, ConflictState,
        RepoSnapshot,
    },
    snapshot::snapshot,
};

const PREVIEW_MAX_BYTES: usize = 256 * 1024;
const PREVIEW_MAX_LINES: usize = 320;

pub(crate) fn conflict_state(repo: &str) -> ConflictState {
    let operation = conflict_operation(repo);
    let files = conflict_files(repo).unwrap_or_default();
    let active = operation.is_some() || !files.is_empty();
    let operation_label = operation
        .as_ref()
        .map(|operation| operation.label.clone())
        .unwrap_or_else(|| {
            if active {
                "Conflict resolution".into()
            } else {
                "None".into()
            }
        });
    let next_step = if !active {
        "No conflict operation is active.".into()
    } else if files.is_empty() {
        format!(
            "All conflicts are marked resolved. Continue the {} when you are ready.",
            operation_label.to_lowercase()
        )
    } else {
        "Open each conflicted file in your editor, resolve the markers, then mark it resolved here."
            .into()
    };

    ConflictState {
        active,
        operation,
        operation_label,
        files,
        next_step,
    }
}

pub(crate) fn conflict_preview(
    repo_path: &str,
    file_path: &str,
) -> Result<ConflictFilePreview, String> {
    let root = repo_root(repo_path)?;
    let file = conflict_files(&root)?
        .into_iter()
        .find(|file| file.path == file_path)
        .unwrap_or_else(|| fallback_conflict_file(file_path));

    Ok(ConflictFilePreview {
        base: stage_preview(&root, file_path, 1, "Base"),
        ours: stage_preview(&root, file_path, 2, "Ours"),
        theirs: stage_preview(&root, file_path, 3, "Theirs"),
        result: worktree_preview(&root, file_path, "Resolved result"),
        file,
    })
}

pub(crate) fn mark_conflict_resolved(
    path: String,
    file_path: String,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["add", "--", &file_path])?;
    snapshot(&root)
}

pub(crate) fn continue_conflict_operation(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let operation = conflict_operation(&root)
        .ok_or_else(|| "No merge, rebase, cherry-pick, or revert is in progress.".to_string())?;
    if !conflict_files(&root)?.is_empty() {
        return Err(
            "Conflicts remain. Resolve and mark every conflicted file before continuing.".into(),
        );
    }
    let args = [
        "-c",
        "core.editor=true",
        operation.git_command.as_str(),
        "--continue",
    ];
    git(&root, &args)?;
    snapshot(&root)
}

pub(crate) fn abort_conflict_operation(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let operation = conflict_operation(&root)
        .ok_or_else(|| "No merge, rebase, cherry-pick, or revert is in progress.".to_string())?;
    let args = [operation.git_command.as_str(), "--abort"];
    git(&root, &args)?;
    snapshot(&root)
}

fn conflict_operation(repo: &str) -> Option<ConflictOperation> {
    let git_dir = absolute_git_dir(repo).ok()?;
    let checks = [
        (
            "rebase",
            "Rebase",
            "rebase",
            ["rebase-merge", "rebase-apply"].as_slice(),
        ),
        (
            "cherry-pick",
            "Cherry-pick",
            "cherry-pick",
            ["CHERRY_PICK_HEAD"].as_slice(),
        ),
        ("revert", "Revert", "revert", ["REVERT_HEAD"].as_slice()),
        ("merge", "Merge", "merge", ["MERGE_HEAD"].as_slice()),
    ];

    for (kind, label, git_command, markers) in checks {
        if markers.iter().any(|marker| git_dir.join(marker).exists()) {
            return Some(ConflictOperation {
                kind: kind.into(),
                label: label.into(),
                git_command: git_command.into(),
                can_continue: true,
                can_abort: true,
            });
        }
    }
    None
}

fn absolute_git_dir(repo: &str) -> Result<PathBuf, String> {
    let raw = git(repo, &["rev-parse", "--git-dir"])?;
    let git_dir = PathBuf::from(raw.trim());
    if git_dir.is_absolute() {
        Ok(git_dir)
    } else {
        Ok(Path::new(repo).join(git_dir))
    }
}

fn conflict_files(repo: &str) -> Result<Vec<ConflictFile>, String> {
    let output = git(
        repo,
        &["status", "--porcelain=v1", "-z", "--untracked-files=no"],
    )?;
    let mut files = BTreeMap::new();
    let entries = output.split_terminator('\0').collect::<Vec<_>>();
    let mut index = 0;

    while let Some(line) = entries.get(index) {
        index += 1;
        if line.len() < 4 {
            continue;
        }
        let xy = &line[0..2];
        let path = line[3..].to_string();
        if matches!(xy.chars().next(), Some('R' | 'C'))
            || matches!(xy.chars().nth(1), Some('R' | 'C'))
        {
            index += 1;
        }
        if !is_unmerged_status(xy) {
            continue;
        }
        files.insert(path.clone(), conflict_file(repo, &path, xy));
    }

    Ok(files.into_values().collect())
}

fn is_unmerged_status(xy: &str) -> bool {
    matches!(xy, "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU") || xy.contains('U')
}

fn conflict_file(repo: &str, path: &str, xy: &str) -> ConflictFile {
    let (kind, kind_label) = conflict_kind(xy);
    let has_base = stage_exists(repo, path, 1);
    let has_ours = stage_exists(repo, path, 2);
    let has_theirs = stage_exists(repo, path, 3);
    let binary = side_is_binary(repo, path, 1)
        || side_is_binary(repo, path, 2)
        || side_is_binary(repo, path, 3)
        || worktree_is_binary(repo, path);

    ConflictFile {
        path: path.into(),
        status: xy.into(),
        kind,
        kind_label,
        binary,
        has_base,
        has_ours,
        has_theirs,
    }
}

fn fallback_conflict_file(path: &str) -> ConflictFile {
    ConflictFile {
        path: path.into(),
        status: "UU".into(),
        kind: "both_modified".into(),
        kind_label: "Both modified".into(),
        binary: false,
        has_base: false,
        has_ours: false,
        has_theirs: false,
    }
}

fn conflict_kind(xy: &str) -> (String, String) {
    let pair = match xy {
        "UU" => ("both_modified", "Both modified"),
        "AA" => ("add_add", "Add/add"),
        "DU" => ("deleted_by_us", "Deleted by us, modified by them"),
        "UD" => ("deleted_by_them", "Modified by us, deleted by them"),
        "AU" => ("added_by_us", "Added by us"),
        "UA" => ("added_by_them", "Added by them"),
        "DD" => ("both_deleted", "Both deleted"),
        value if value.contains('R') => ("rename", "Rename conflict"),
        _ => ("unmerged", "Unmerged"),
    };
    (pair.0.into(), pair.1.into())
}

fn stage_exists(repo: &str, path: &str, stage: u8) -> bool {
    git_bytes(repo, &["show", &format!(":{stage}:{path}")]).is_ok()
}

fn stage_preview(repo: &str, path: &str, stage: u8, label: &str) -> ConflictPreviewSide {
    match git_bytes(repo, &["show", &format!(":{stage}:{path}")]) {
        Ok(bytes) => bytes_preview(label, bytes),
        Err(_) => ConflictPreviewSide {
            label: label.into(),
            available: false,
            binary: false,
            truncated: false,
            lines: Vec::new(),
            message: format!("No {label} version exists for this conflict."),
        },
    }
}

fn worktree_preview(repo: &str, path: &str, label: &str) -> ConflictPreviewSide {
    match fs::read(Path::new(repo).join(path)) {
        Ok(bytes) => bytes_preview(label, bytes),
        Err(_) => ConflictPreviewSide {
            label: label.into(),
            available: false,
            binary: false,
            truncated: false,
            lines: Vec::new(),
            message: "No working-tree file exists. If deletion is the intended resolution, mark it resolved.".into(),
        },
    }
}

fn bytes_preview(label: &str, bytes: Vec<u8>) -> ConflictPreviewSide {
    let truncated_bytes = bytes.len() > PREVIEW_MAX_BYTES;
    let slice = if truncated_bytes {
        &bytes[..PREVIEW_MAX_BYTES]
    } else {
        &bytes[..]
    };
    match std::str::from_utf8(slice) {
        Ok(text) => {
            let mut lines = text
                .lines()
                .take(PREVIEW_MAX_LINES + 1)
                .map(str::to_string)
                .collect::<Vec<_>>();
            let truncated_lines = lines.len() > PREVIEW_MAX_LINES;
            if truncated_lines {
                lines.truncate(PREVIEW_MAX_LINES);
            }
            ConflictPreviewSide {
                label: label.into(),
                available: true,
                binary: false,
                truncated: truncated_bytes || truncated_lines,
                lines,
                message: if truncated_bytes || truncated_lines {
                    "Preview truncated for safety.".into()
                } else {
                    String::new()
                },
            }
        }
        Err(_) => ConflictPreviewSide {
            label: label.into(),
            available: true,
            binary: true,
            truncated: false,
            lines: Vec::new(),
            message:
                "Binary content preview skipped. Use an external editor or Git tool to resolve."
                    .into(),
        },
    }
}

fn side_is_binary(repo: &str, path: &str, stage: u8) -> bool {
    git_bytes(repo, &["show", &format!(":{stage}:{path}")])
        .map(|bytes| std::str::from_utf8(&bytes).is_err())
        .unwrap_or(false)
}

fn worktree_is_binary(repo: &str, path: &str) -> bool {
    fs::read(Path::new(repo).join(path))
        .map(|bytes| std::str::from_utf8(&bytes).is_err())
        .unwrap_or(false)
}

fn git_bytes(repo: &str, args: &[&str]) -> Result<Vec<u8>, String> {
    let executable = git_executable();
    let output = Command::new(&executable)
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Git command failed".into()
        } else {
            stderr
        })
    }
}
