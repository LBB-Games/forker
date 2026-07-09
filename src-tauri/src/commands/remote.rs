use crate::{
    git_process::{current_branch, default_remote, git, repo_root},
    jobs::{ensure_not_cancelled, queued_git, GitJobQueue},
    models::RepoSnapshot,
    snapshot::snapshot,
};

fn fetch_all_args(prune_deleted_remote_branches: bool) -> Vec<&'static str> {
    if prune_deleted_remote_branches {
        vec!["fetch", "--all", "--prune"]
    } else {
        vec!["fetch", "--all"]
    }
}

pub(crate) fn git_fetch_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let settings = crate::settings::current_app_settings();
    let args = fetch_all_args(settings.prune_deleted_remote_branches);
    git(&root, &args)?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_fetch(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Fetch", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        let snapshot = git_fetch_impl(path)?;
        ensure_not_cancelled(&cancel)?;
        Ok(snapshot)
    })
    .await
}

pub(crate) fn git_pull_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["pull", "--ff-only"])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_pull(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Pull", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_pull_impl(path)
    })
    .await
}

pub(crate) fn git_push_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["push"])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_push(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Push", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_push_impl(path)
    })
    .await
}

pub(crate) fn git_push_upstream_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let branch = current_branch(&root);
    if branch.is_empty() || branch == "detached" {
        return Err("Cannot create an upstream for a detached HEAD.".into());
    }
    let remote = default_remote(&root)?;
    git(&root, &["push", "--set-upstream", &remote, &branch])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_push_upstream(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Publish branch", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_push_upstream_impl(path)
    })
    .await
}

pub(crate) fn git_force_push_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["push", "--force-with-lease"])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_force_push(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Force push", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_force_push_impl(path)
    })
    .await
}
