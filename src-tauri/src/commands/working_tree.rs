use crate::{
    git_process::{git, repo_root},
    jobs::{ensure_not_cancelled, queued_git, GitJobQueue},
    models::RepoSnapshot,
    snapshot::snapshot,
};

pub(crate) fn git_stage_impl(
    path: String,
    file_path: Option<String>,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    match file_path {
        Some(file) => git(&root, &["add", "--", &file])?,
        None => git(&root, &["add", "-A"])?,
    };
    snapshot(&root)
}

pub(crate) fn git_stage_paths_impl(
    path: String,
    file_paths: Vec<String>,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    if file_paths.is_empty() {
        return snapshot(&root);
    }

    let mut args = vec!["add", "--"];
    args.extend(file_paths.iter().map(String::as_str));
    git(&root, &args)?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_stage_tracked(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Stage tracked", move |cancel| {
        let root = repo_root(&path)?;
        ensure_not_cancelled(&cancel)?;
        git(&root, &["add", "-u"])?;
        snapshot(&root)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_stage(
    path: String,
    file_path: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Stage", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_stage_impl(path, file_path)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_stage_paths(
    path: String,
    file_paths: Vec<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Stage files", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_stage_paths_impl(path, file_paths)
    })
    .await
}

pub(crate) fn git_unstage_impl(
    path: String,
    file_path: Option<String>,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    match file_path {
        Some(file) => git(&root, &["restore", "--staged", "--", &file])?,
        None => git(&root, &["restore", "--staged", "."])?,
    };
    snapshot(&root)
}

pub(crate) fn git_unstage_paths_impl(
    path: String,
    file_paths: Vec<String>,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    if file_paths.is_empty() {
        return snapshot(&root);
    }

    let mut args = vec!["restore", "--staged", "--"];
    args.extend(file_paths.iter().map(String::as_str));
    git(&root, &args)?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_unstage(
    path: String,
    file_path: Option<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Unstage", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_unstage_impl(path, file_path)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_unstage_paths(
    path: String,
    file_paths: Vec<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Unstage files", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_unstage_paths_impl(path, file_paths)
    })
    .await
}

pub(crate) fn git_discard_impl(path: String, file_path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["restore", "--worktree", "--", &file_path])
        .or_else(|_| git(&root, &["clean", "-f", "--", &file_path]))?;
    snapshot(&root)
}

pub(crate) fn git_discard_paths_impl(
    path: String,
    file_paths: Vec<String>,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    for file_path in file_paths {
        git(&root, &["restore", "--worktree", "--", &file_path])
            .or_else(|_| git(&root, &["clean", "-f", "--", &file_path]))?;
    }
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_discard(
    path: String,
    file_path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Discard", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_discard_impl(path, file_path)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_discard_paths(
    path: String,
    file_paths: Vec<String>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Discard files", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_discard_paths_impl(path, file_paths)
    })
    .await
}

pub(crate) fn git_commit_impl(
    path: String,
    summary: String,
    description: String,
    amend: bool,
    sign: bool,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    if summary.trim().is_empty() {
        return Err("Commit summary is required".into());
    }
    let mut args = vec!["commit", "-m", summary.trim()];
    let desc = description.trim();
    if !desc.is_empty() {
        args.push("-m");
        args.push(desc);
    }
    if amend {
        args.push("--amend");
    }
    if sign {
        args.push("-S");
    }
    git(&root, &args)?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_commit(
    path: String,
    summary: String,
    description: String,
    amend: bool,
    sign: Option<bool>,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Commit", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_commit_impl(path, summary, description, amend, sign.unwrap_or(false))
    })
    .await
}
