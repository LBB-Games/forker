use std::collections::HashMap;

use crate::{
    changes::{changed_file, parse_line_stats},
    diff::parse_unified_diff_rows,
    git_process::{git, repo_root},
    jobs::{ensure_not_cancelled, queued_git, GitJobQueue},
    models::{ChangedFile, RepoSnapshot, StashDiffInfo, StashInfo},
    snapshot::snapshot,
};

pub(crate) fn git_reset_branch_impl(
    path: String,
    target: String,
    mode: String,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let reset_mode = match mode.as_str() {
        "soft" => "--soft",
        "mixed" => "--mixed",
        "hard" => "--hard",
        _ => return Err("Reset mode must be soft, mixed, or hard.".into()),
    };
    let target = target.trim();
    if target.is_empty() {
        return Err("Reset target is required.".into());
    }
    git(&root, &["reset", reset_mode, target])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_reset_branch(
    path: String,
    target: String,
    mode: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Reset branch", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_reset_branch_impl(path, target, mode)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_delete_branch(
    path: String,
    branch_name: String,
    remote: Option<String>,
    force: bool,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Delete branch", move |cancel| {
        let root = repo_root(&path)?;
        let branch_name = branch_name.trim();
        if branch_name.is_empty() {
            return Err("Branch name is required.".into());
        }
        ensure_not_cancelled(&cancel)?;
        if let Some(remote_name) = remote
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            git(&root, &["push", remote_name, "--delete", branch_name])?;
        } else {
            let flag = if force { "-D" } else { "-d" };
            git(&root, &["branch", flag, branch_name])?;
        }
        snapshot(&root)
    })
    .await
}

pub(crate) fn git_checkout_impl(path: String, reference: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["checkout", &reference])?;
    snapshot(&root)
}

pub(crate) fn git_checkout_remote_impl(
    path: String,
    remote_branch: String,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    let remote_branch = remote_branch.trim();
    if remote_branch.is_empty() {
        return Err("Remote branch is required.".into());
    }
    if remote_branch.ends_with("/HEAD") {
        return Err("Choose a concrete remote branch, not the remote HEAD pointer.".into());
    }

    let (_, local_branch) = remote_branch.split_once('/').ok_or_else(|| {
        "Remote branch must include a remote name, for example origin/feature.".to_string()
    })?;
    if local_branch.trim().is_empty() {
        return Err("Remote branch must include a branch name.".into());
    }

    let remote_ref = format!("refs/remotes/{remote_branch}");
    git(&root, &["show-ref", "--verify", &remote_ref])?;

    let local_ref = format!("refs/heads/{local_branch}");
    if git(&root, &["show-ref", "--verify", &local_ref]).is_ok() {
        git(&root, &["checkout", local_branch])?;
    } else {
        git(
            &root,
            &["checkout", "-b", local_branch, "--track", remote_branch],
        )?;
    }
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_checkout_remote(
    path: String,
    remote_branch: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Checkout remote branch", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_checkout_remote_impl(path, remote_branch)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_checkout(
    path: String,
    reference: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Checkout", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_checkout_impl(path, reference)
    })
    .await
}

pub(crate) fn git_create_branch_impl(
    path: String,
    name: String,
    checkout: bool,
) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    if name.trim().is_empty() {
        return Err("Branch name is required".into());
    }
    if checkout {
        git(&root, &["checkout", "-b", name.trim()])?;
    } else {
        git(&root, &["branch", name.trim()])?;
    }
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_create_branch(
    path: String,
    name: String,
    checkout: bool,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Create branch", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_create_branch_impl(path, name, checkout)
    })
    .await
}

pub(crate) fn git_stash_impl(path: String) -> Result<RepoSnapshot, String> {
    let root = repo_root(&path)?;
    git(&root, &["stash", "push", "-u"])?;
    snapshot(&root)
}

#[tauri::command]
pub(crate) async fn git_stash(
    path: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Stash", move |cancel| {
        ensure_not_cancelled(&cancel)?;
        git_stash_impl(path)
    })
    .await
}

pub(crate) fn git_stash_list_impl(path: &str) -> Result<Vec<StashInfo>, String> {
    let root = repo_root(path)?;
    let output = git(
        &root,
        &[
            "stash",
            "list",
            "--date=format:%m/%d/%y %H:%M",
            "--format=%H%x1f%h%x1f%cd%x1f%gs",
        ],
    )?;

    Ok(output
        .lines()
        .take(30)
        .enumerate()
        .filter_map(|(index, line)| parse_stash_list_line(&root, index, line))
        .collect())
}

#[tauri::command]
pub(crate) fn git_stash_list(path: String) -> Result<Vec<StashInfo>, String> {
    git_stash_list_impl(&path)
}

#[tauri::command]
pub(crate) fn git_stash_diff(
    path: String,
    stash_ref: String,
    file_path: Option<String>,
    context_lines: Option<usize>,
) -> Result<StashDiffInfo, String> {
    let root = repo_root(&path)?;
    let stash_ref = normalize_stash_ref(&stash_ref)?;
    stash_diff_info(&root, &stash_ref, file_path.as_deref(), context_lines)
}

#[tauri::command]
pub(crate) async fn git_stash_apply(
    path: String,
    stash_ref: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Apply stash", move |cancel| {
        let root = repo_root(&path)?;
        let stash_ref = normalize_stash_ref(&stash_ref)?;
        ensure_not_cancelled(&cancel)?;
        git(&root, &["stash", "apply", &stash_ref])?;
        snapshot(&root)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_stash_pop(
    path: String,
    stash_ref: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Pop stash", move |cancel| {
        let root = repo_root(&path)?;
        let stash_ref = normalize_stash_ref(&stash_ref)?;
        ensure_not_cancelled(&cancel)?;
        git(&root, &["stash", "pop", &stash_ref])?;
        snapshot(&root)
    })
    .await
}

#[tauri::command]
pub(crate) async fn git_stash_drop(
    path: String,
    stash_ref: String,
    queue: tauri::State<'_, GitJobQueue>,
) -> Result<RepoSnapshot, String> {
    queued_git(queue, "Drop stash", move |cancel| {
        let root = repo_root(&path)?;
        let stash_ref = normalize_stash_ref(&stash_ref)?;
        ensure_not_cancelled(&cancel)?;
        git(&root, &["stash", "drop", &stash_ref])?;
        snapshot(&root)
    })
    .await
}

fn parse_stash_list_line(repo: &str, index: usize, line: &str) -> Option<StashInfo> {
    let mut fields = line.split('\u{1f}');
    let full_id = fields.next()?.trim();
    if full_id.is_empty() {
        return None;
    }
    let reference = format!("stash@{{{index}}}");
    let short_id = fields.next().unwrap_or_default().trim().to_string();
    let date = fields.next().unwrap_or_default().trim().to_string();
    let subject = fields.next().unwrap_or_default().trim().to_string();
    let (branch, message) = parse_stash_subject(&subject);
    let changed_files = stash_changed_file_count(repo, &reference);

    Some(StashInfo {
        reference,
        short_id,
        message,
        subject,
        branch,
        date,
        changed_files,
    })
}

fn parse_stash_subject(subject: &str) -> (String, String) {
    let subject = subject.trim();
    if let Some(rest) = subject.strip_prefix("On ") {
        if let Some((branch, message)) = rest.split_once(": ") {
            return (branch.trim().to_string(), message.trim().to_string());
        }
    }
    if let Some(rest) = subject.strip_prefix("WIP on ") {
        if let Some((branch, message)) = rest.split_once(": ") {
            return (branch.trim().to_string(), message.trim().to_string());
        }
    }
    (String::new(), subject.to_string())
}

fn stash_changed_file_count(repo: &str, stash_ref: &str) -> usize {
    stash_show(repo, &["--name-only"], stash_ref, None)
        .unwrap_or_default()
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count()
}

fn stash_diff_info(
    repo: &str,
    stash_ref: &str,
    file_path: Option<&str>,
    context_lines: Option<usize>,
) -> Result<StashDiffInfo, String> {
    let stashes = git_stash_list_impl(repo)?;
    let stash = stashes
        .into_iter()
        .find(|stash| stash.reference == stash_ref)
        .ok_or_else(|| format!("Stash {stash_ref} was not found."))?;
    let changed_paths = stash_changed_files(repo, stash_ref)?;
    let selected_file_path = file_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| changed_paths.first().map(|file| file.path.clone()));
    let diff_rows = if let Some(path) = selected_file_path.as_deref() {
        let patch = stash_patch(repo, stash_ref, path, context_lines)?;
        parse_unified_diff_rows(&patch)
    } else {
        Vec::new()
    };
    let files = changed_paths.len();
    let (insertions, deletions) = changed_paths.iter().fold((0, 0), |totals, file| {
        parse_line_stats(&file.lines)
            .map(|stats| (totals.0 + stats.0, totals.1 + stats.1))
            .unwrap_or(totals)
    });

    Ok(StashDiffInfo {
        stash,
        selected_file_path,
        changed_paths,
        diff_rows,
        files,
        insertions,
        deletions,
    })
}

fn stash_changed_files(repo: &str, stash_ref: &str) -> Result<Vec<ChangedFile>, String> {
    let name_status = stash_show(repo, &["--name-status", "-M"], stash_ref, None)?;
    let stats = stash_numstat(repo, stash_ref);
    Ok(name_status
        .lines()
        .filter_map(|line| {
            let cols = line.split('\t').collect::<Vec<_>>();
            let status = cols.first()?.chars().next().unwrap_or('M');
            let path = cols.last()?.trim();
            if path.is_empty() {
                None
            } else {
                Some(changed_file(path, status, "stash", stats.get(path)))
            }
        })
        .collect())
}

fn stash_numstat(repo: &str, stash_ref: &str) -> HashMap<String, (usize, usize)> {
    stash_show(repo, &["--numstat", "--find-renames"], stash_ref, None)
        .map(|output| parse_numstat(&output))
        .unwrap_or_default()
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

fn stash_patch(
    repo: &str,
    stash_ref: &str,
    file_path: &str,
    context_lines: Option<usize>,
) -> Result<String, String> {
    let context_arg = format!("-U{}", context_lines.unwrap_or(3).min(20));
    let base_ref = format!("{stash_ref}^1");
    let patch = git(
        repo,
        &[
            "diff",
            "--find-renames",
            context_arg.as_str(),
            &base_ref,
            stash_ref,
            "--",
            file_path,
        ],
    )?;
    if !patch.trim().is_empty() {
        return Ok(patch);
    }
    stash_untracked_patch(repo, stash_ref, file_path)
}

fn stash_untracked_patch(repo: &str, stash_ref: &str, file_path: &str) -> Result<String, String> {
    let object_ref = format!("{stash_ref}^3:{file_path}");
    let contents = git(repo, &["show", &object_ref])?;
    let preview_lines = contents.lines().take(800).collect::<Vec<_>>();
    let mut patch = format!("diff --git a/{file_path} b/{file_path}\nnew file mode 100644\n--- /dev/null\n+++ b/{file_path}\n@@ -0,0 +1,{} @@\n", preview_lines.len());
    for line in preview_lines {
        patch.push('+');
        patch.push_str(line);
        patch.push('\n');
    }
    Ok(patch)
}

fn stash_show(
    repo: &str,
    diff_args: &[&str],
    stash_ref: &str,
    file_path: Option<&str>,
) -> Result<String, String> {
    let mut args = vec![
        "stash".to_string(),
        "show".to_string(),
        "--include-untracked".to_string(),
    ];
    args.extend(diff_args.iter().map(|arg| arg.to_string()));
    args.push(stash_ref.to_string());
    if let Some(path) = file_path.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--".to_string());
        args.push(path.to_string());
    }
    let arg_refs = args.iter().map(String::as_str).collect::<Vec<_>>();

    git(repo, &arg_refs).or_else(|first_error| {
        let fallback_args = args
            .iter()
            .filter(|arg| arg.as_str() != "--include-untracked")
            .map(String::as_str)
            .collect::<Vec<_>>();
        if fallback_args.is_empty() {
            return Err(first_error);
        }
        git(repo, &fallback_args).map_err(|_| first_error)
    })
}

fn normalize_stash_ref(stash_ref: &str) -> Result<String, String> {
    let trimmed = stash_ref.trim();
    let Some(index) = trimmed
        .strip_prefix("stash@{")
        .and_then(|rest| rest.strip_suffix('}'))
    else {
        return Err("Choose a stash from the stash list before running this action.".into());
    };
    if index.is_empty() || !index.chars().all(|ch| ch.is_ascii_digit()) {
        return Err("Stash reference must look like stash@{0}.".into());
    }
    Ok(trimmed.to_string())
}
