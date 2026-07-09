mod branch;
mod remote;
mod working_tree;
pub(crate) use branch::*;
pub(crate) use remote::*;
pub(crate) use working_tree::*;

use std::{
    path::PathBuf,
    process::{Command, Stdio},
};

use crate::{
    changes::{branch_history, commit_details, commit_diff_info, file_history},
    conflicts::{
        abort_conflict_operation, conflict_preview, continue_conflict_operation,
        mark_conflict_resolved,
    },
    diff::{file_diff, hunk_patch},
    git_process::{git, git_installation_impl, git_with_input, repo_root},
    jobs::{ensure_not_cancelled, queued_git, GitJobQueue},
    models::{
        BranchHistoryInfo, ClonePreparation, CommitDetailsInfo, CommitDiffInfo,
        ConflictFilePreview, FileHistoryInfo, GitInstallation, GitJobStatus, RepoSnapshot,
        RepositoryGroupSnapshot, WorktreeInfo,
    },
    repository_group::{
        clone_standard_repository_impl, complete_first_worktree_impl, create_worktree_impl,
        open_group_snapshot, prepare_bare_clone_impl, prepare_meta_clone_impl,
        prune_worktrees_impl, remove_worktree_impl,
    },
    snapshot::snapshot,
};

#[tauri::command]
pub(crate) fn git_installation() -> GitInstallation {
    git_installation_impl()
}

#[tauri::command]
pub(crate) async fn open_repository(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Open repository", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        snapshot(&path)
    })
    .await
}

#[tauri::command]
pub(crate) async fn open_repository_group(
    root_path: String,
    active_worktree_path: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Open repository group", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        open_group_snapshot(&root_path, active_worktree_path.as_deref())
    })
    .await
}

#[tauri::command]
pub(crate) async fn clone_standard_repository(
    remote_url: String,
    parent_path: String,
    directory_name: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Clone repository", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        clone_standard_repository_impl(&remote_url, &parent_path, directory_name.as_deref())
    })
    .await
}

#[tauri::command]
pub(crate) async fn prepare_bare_clone(
    remote_url: String,
    parent_path: String,
    directory_name: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<ClonePreparation, String> {
    queued_git(queue, "Prepare bare clone", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        prepare_bare_clone_impl(&remote_url, &parent_path, directory_name.as_deref())
    })
    .await
}

#[tauri::command]
pub(crate) async fn prepare_meta_clone(
    remote_url: String,
    parent_path: String,
    directory_name: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<ClonePreparation, String> {
    queued_git(queue, "Prepare repo.meta clone", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        prepare_meta_clone_impl(&remote_url, &parent_path, directory_name.as_deref())
    })
    .await
}

#[tauri::command]
pub(crate) async fn complete_first_worktree(
    root_path: String,
    selected_remote_branch: String,
    local_branch_name: Option<String>,
    worktree_name: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Create first worktree", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        complete_first_worktree_impl(
            &root_path,
            &selected_remote_branch,
            local_branch_name.as_deref(),
            worktree_name.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn list_worktrees(
    root_path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<Vec<WorktreeInfo>, String> {
    queued_git(queue, "List worktrees", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        let snapshot = open_group_snapshot(&root_path, None)?;
        Ok(snapshot.worktrees)
    })
    .await
}

#[tauri::command]
pub(crate) async fn create_worktree(
    root_path: String,
    branch_name: String,
    worktree_name: String,
    start_point: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Create worktree", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        create_worktree_impl(
            &root_path,
            &branch_name,
            &worktree_name,
            start_point.as_deref(),
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn remove_worktree(
    root_path: String,
    worktree_path: String,
    force: bool,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Remove worktree", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        remove_worktree_impl(&root_path, &worktree_path, force)
    })
    .await
}

#[tauri::command]
pub(crate) async fn prune_worktrees(
    root_path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Prune worktrees", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        prune_worktrees_impl(&root_path)
    })
    .await
}

#[tauri::command]
pub(crate) async fn select_worktree(
    root_path: String,
    worktree_path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Select worktree", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        open_group_snapshot(&root_path, Some(&worktree_path))
    })
    .await
}

#[tauri::command]
pub(crate) async fn clone_repository(
    remote_url: String,
    parent_path: String,
    directory_name: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepositoryGroupSnapshot, String> {
    queued_git(queue, "Clone repository", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        let preparation =
            prepare_bare_clone_impl(&remote_url, &parent_path, directory_name.as_deref())?;
        ensure_not_cancelled(&cancel)?;
        let selected = preparation
            .default_branch
            .clone()
            .or_else(|| preparation.remote_branches.first().cloned())
            .ok_or_else(|| {
                "Remote repository has no branches to create a first worktree from.".to_string()
            })?;
        let local_branch = selected.trim_start_matches("origin/").to_string();
        complete_first_worktree_impl(
            &preparation.root_path,
            &selected,
            Some(&local_branch),
            Some(&local_branch.replace(['/', ' '], "-")),
        )
    })
    .await
}

#[tauri::command]
pub(crate) fn open_external_tool(
    command_template: String,
    repo_path: String,
    file_path: Option<String>,
) -> Result<(), String> {
    let repo_path = repo_path.trim();
    if repo_path.is_empty() {
        return Err("Open a repository before launching an external tool.".into());
    }
    let absolute_file_path = file_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|file| PathBuf::from(repo_path).join(file).display().to_string());
    let command = command_template
        .replace("{repo}", repo_path)
        .replace("{file}", absolute_file_path.as_deref().unwrap_or(""));
    let mut parts = split_command_line(&command);
    if let Some(file) = absolute_file_path {
        if !command_template.contains("{file}") {
            parts.push(file);
        }
    }
    let (program, args) = parts
        .split_first()
        .ok_or_else(|| "External tool command is empty.".to_string())?;
    Command::new(program)
        .args(args)
        .current_dir(repo_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Unable to launch external tool: {e}"))
}

fn split_command_line(command: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for ch in command.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if quote == Some(ch) {
            quote = None;
        } else if quote.is_none() && (ch == '\'' || ch == '"') {
            quote = Some(ch);
        } else if quote.is_none() && ch.is_whitespace() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        parts.push(current);
    }
    parts
}

#[tauri::command]
pub(crate) async fn git_refresh(
    path: String,
    update_remotes: Option<bool>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Refresh", move |cancel| {
        let root = repo_root(&path)?;
        ensure_not_cancelled(&cancel)?;
        if update_remotes.unwrap_or(false) {
            let settings = crate::settings::current_app_settings();
            let args = if settings.prune_deleted_remote_branches {
                ["fetch", "--all", "--prune"].as_slice()
            } else {
                ["fetch", "--all"].as_slice()
            };
            git(&root, args)?;
            ensure_not_cancelled(&cancel)?;
        }
        snapshot(&root)
    })
    .await
}

#[tauri::command]
pub(crate) fn git_job_status(queue: tauri::State<'_, GitJobQueue>) -> Result<GitJobStatus, String> {
    crate::jobs::status(queue)
}

#[tauri::command]
pub(crate) fn git_cancel_job(queue: tauri::State<'_, GitJobQueue>) -> Result<GitJobStatus, String> {
    crate::jobs::cancel(queue)
}

#[tauri::command]
pub(crate) fn git_file_diff(
    path: String,
    file_path: String,
    staged: bool,
    status: String,
    context_lines: Option<usize>,
) -> Result<Vec<serde_json::Value>, String> {
    let root = repo_root(&path)?;
    file_diff(&root, &file_path, staged, &status, context_lines)
}

#[tauri::command]
pub(crate) fn git_conflict_preview(
    path: String,
    file_path: String,
) -> Result<ConflictFilePreview, String> {
    conflict_preview(&path, &file_path)
}

#[tauri::command]
pub(crate) fn git_mark_conflict_resolved(
    path: String,
    file_path: String,
) -> Result<RepoSnapshot, String> {
    mark_conflict_resolved(path, file_path)
}

#[tauri::command]
pub(crate) fn git_conflict_continue(path: String) -> Result<RepoSnapshot, String> {
    continue_conflict_operation(path)
}

#[tauri::command]
pub(crate) fn git_conflict_abort(path: String) -> Result<RepoSnapshot, String> {
    abort_conflict_operation(path)
}

#[tauri::command]
pub(crate) fn git_stage_hunk(
    path: String,
    file_path: String,
    hunk_index: usize,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let patch = hunk_patch(&root, &file_path, false, hunk_index)?;
    git_with_input(&root, &["apply", "--cached", "--unidiff-zero", "-"], &patch)?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) fn git_unstage_hunk(
    path: String,
    file_path: String,
    hunk_index: usize,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let patch = hunk_patch(&root, &file_path, true, hunk_index)?;
    git_with_input(
        &root,
        &["apply", "--cached", "--reverse", "--unidiff-zero", "-"],
        &patch,
    )?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) fn git_commit_details(path: String, id: String) -> Result<CommitDetailsInfo, String> {
    let root = repo_root(&path)?;
    commit_details(&root, &id)
}

#[tauri::command]
pub(crate) fn git_commit_diff(
    path: String,
    commit_id: String,
    file_path: Option<String>,
    context_lines: Option<usize>,
) -> Result<CommitDiffInfo, String> {
    let root = repo_root(&path)?;
    commit_diff_info(&root, &commit_id, file_path.as_deref(), context_lines)
}

#[tauri::command]
pub(crate) fn git_file_history(
    path: String,
    file_path: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<FileHistoryInfo, String> {
    let root = repo_root(&path)?;
    file_history(&root, &file_path, limit, skip)
}

#[tauri::command]
pub(crate) fn git_branch_history(
    path: String,
    branch_name: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<BranchHistoryInfo, String> {
    let root = repo_root(&path)?;
    branch_history(&root, &branch_name, limit, skip)
}
