mod changes;
mod commands;
mod conflicts;
mod diff;
mod filesystem;
mod git_process;
mod jobs;
mod models;
mod repository_group;
mod settings;
mod snapshot;
mod watcher;

use commands::*;
use filesystem::*;
use jobs::GitJobQueue;
use settings::*;
use tauri::Manager;
use watcher::{unwatch_repository, watch_repository, RepositoryWatcher};

#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GitJobQueue::default())
        .manage(RepositoryWatcher::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let icon = match app.default_window_icon().cloned() {
                    Some(icon) => icon,
                    None => tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?,
                };
                window.set_icon(icon)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_repository,
            open_repository_group,
            clone_repository,
            clone_standard_repository,
            prepare_bare_clone,
            prepare_meta_clone,
            complete_first_worktree,
            list_worktrees,
            create_worktree,
            remove_worktree,
            prune_worktrees,
            select_worktree,
            git_refresh,
            git_job_status,
            git_cancel_job,
            git_installation,
            watch_repository,
            unwatch_repository,
            git_file_diff,
            git_conflict_preview,
            git_mark_conflict_resolved,
            git_conflict_continue,
            git_conflict_abort,
            git_stage_hunk,
            git_unstage_hunk,
            git_commit_details,
            git_commit_diff,
            git_file_history,
            git_branch_history,
            list_directory,
            is_git_repository,
            home_directory,
            common_directories,
            load_app_settings,
            save_app_settings,
            open_external_tool,
            git_fetch,
            git_pull,
            git_push,
            git_push_upstream,
            git_force_push,
            git_reset_branch,
            git_delete_branch,
            git_stage,
            git_stage_tracked,
            git_stage_paths,
            git_unstage,
            git_unstage_paths,
            git_discard,
            git_discard_paths,
            git_commit,
            git_checkout,
            git_checkout_remote,
            git_create_branch,
            git_stash,
            git_stash_list,
            git_stash_diff,
            git_stash_apply,
            git_stash_pop,
            git_stash_drop
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
