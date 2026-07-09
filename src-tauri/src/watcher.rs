use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::Emitter;

use crate::{
    git_process::{git_in_bare_repo, repo_root},
    models::RepositoryChangedEvent,
};

#[derive(Default)]
pub(crate) struct RepositoryWatcher {
    active: Mutex<Option<ActiveRepositoryWatcher>>,
}

struct ActiveRepositoryWatcher {
    path: String,
    stop: Arc<AtomicBool>,
}

#[tauri::command]
pub(crate) fn watch_repository(
    path: String,
    app: tauri::AppHandle,
    watcher: tauri::State<'_, RepositoryWatcher>,
) -> Result<(), String> {
    let root = watch_root(&path)?;
    let mut active = watcher
        .active
        .lock()
        .map_err(|_| "Repository watcher lock is poisoned".to_string())?;
    if active.as_ref().map(|watch| watch.path.as_str()) == Some(root.as_str()) {
        return Ok(());
    }
    if let Some(watch) = active.take() {
        watch.stop.store(true, Ordering::Relaxed);
    }

    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop);
    let thread_root = root.clone();
    thread::spawn(move || repository_watch_loop(app, thread_root, thread_stop));
    *active = Some(ActiveRepositoryWatcher { path: root, stop });
    Ok(())
}

#[tauri::command]
pub(crate) fn unwatch_repository(
    watcher: tauri::State<'_, RepositoryWatcher>,
) -> Result<(), String> {
    let mut active = watcher
        .active
        .lock()
        .map_err(|_| "Repository watcher lock is poisoned".to_string())?;
    if let Some(watch) = active.take() {
        watch.stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}

fn watch_root(path: &str) -> Result<String, String> {
    let candidate = Path::new(path);
    let common_git_dir = candidate.join(".git");
    if common_git_dir.is_dir()
        && git_in_bare_repo(
            &common_git_dir.to_string_lossy(),
            &["rev-parse", "--is-bare-repository"],
        )
        .map(|value| value.trim() == "true")
        .unwrap_or(false)
    {
        return Ok(candidate.to_string_lossy().to_string());
    }
    repo_root(path)
}

fn repository_watch_loop(app: tauri::AppHandle, root: String, stop: Arc<AtomicBool>) {
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
    let mut watcher = match RecommendedWatcher::new(
        move |result| {
            let _ = tx.send(result);
        },
        Config::default(),
    ) {
        Ok(watcher) => watcher,
        Err(error) => {
            let _ = app.emit(
                "repository-changed",
                RepositoryChangedEvent {
                    path: root,
                    reason: format!("Repository watcher unavailable: {error}"),
                },
            );
            return;
        }
    };

    if let Err(error) = watcher.watch(Path::new(&root), RecursiveMode::Recursive) {
        let _ = app.emit(
            "repository-changed",
            RepositoryChangedEvent {
                path: root,
                reason: format!("Unable to watch repository: {error}"),
            },
        );
        return;
    }

    let debounce = Duration::from_millis(700);
    let mut pending_reason: Option<String> = None;
    let mut last_event = Instant::now();

    while !stop.load(Ordering::Relaxed) {
        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(Ok(event)) => {
                if should_refresh_for_event(&root, &event) {
                    pending_reason = Some(repository_event_reason(&event));
                    last_event = Instant::now();
                }
            }
            Ok(Err(error)) => {
                pending_reason = Some(format!("Repository watcher error: {error}"));
                last_event = Instant::now();
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }

        if pending_reason.is_some() && last_event.elapsed() >= debounce {
            let reason = pending_reason
                .take()
                .unwrap_or_else(|| "Repository changed".into());
            let _ = app.emit(
                "repository-changed",
                RepositoryChangedEvent {
                    path: root.clone(),
                    reason,
                },
            );
        }
    }
}

fn should_refresh_for_event(root: &str, event: &Event) -> bool {
    if matches!(event.kind, EventKind::Access(_)) {
        return false;
    }
    event
        .paths
        .iter()
        .any(|path| is_relevant_repo_path(root, path))
}

fn is_relevant_repo_path(root: &str, path: &Path) -> bool {
    let Ok(relative) = path.strip_prefix(root) else {
        return true;
    };
    let mut components = relative.components();
    let Some(first) = components.next() else {
        return true;
    };
    let first = first.as_os_str().to_string_lossy();

    if matches!(first.as_ref(), "node_modules" | "target" | ".DS_Store") {
        return false;
    }

    if first != ".git" {
        return true;
    }

    let Some(second) = components.next() else {
        return false;
    };
    let second = second.as_os_str().to_string_lossy();
    if second.ends_with(".lock") || second == "logs" || second == "objects" {
        return false;
    }
    matches!(
        second.as_ref(),
        "HEAD"
            | "index"
            | "refs"
            | "worktrees"
            | "packed-refs"
            | "MERGE_HEAD"
            | "REBASE_HEAD"
            | "CHERRY_PICK_HEAD"
            | "BISECT_LOG"
            | "rebase-merge"
            | "rebase-apply"
    )
}

fn repository_event_reason(event: &Event) -> String {
    match event.kind {
        EventKind::Create(_) => "Repository files created".into(),
        EventKind::Modify(_) => "Repository files modified".into(),
        EventKind::Remove(_) => "Repository files removed".into(),
        EventKind::Any | EventKind::Other => "Repository changed".into(),
        EventKind::Access(_) => "Repository accessed".into(),
    }
}
