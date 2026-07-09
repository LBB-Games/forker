use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};

use crate::models::GitJobStatus;

#[derive(Default)]
pub(crate) struct GitJobQueue {
    next_id: AtomicU64,
    active: Mutex<Option<ActiveGitJob>>,
}

struct ActiveGitJob {
    id: u64,
    label: String,
    cancel_requested: Arc<AtomicBool>,
}

pub(crate) async fn queued_git<T, F>(
    queue: tauri::State<'_, GitJobQueue>,
    label: &str,
    task: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(Arc<AtomicBool>) -> Result<T, String> + Send + 'static,
{
    let id = queue.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let cancel_requested = Arc::new(AtomicBool::new(false));
    {
        let mut active = queue
            .active
            .lock()
            .map_err(|_| "Git job queue lock is poisoned".to_string())?;
        if let Some(job) = active.as_ref() {
            return Err(format!("Git job '{}' is already running.", job.label));
        }
        *active = Some(ActiveGitJob {
            id,
            label: label.to_string(),
            cancel_requested: Arc::clone(&cancel_requested),
        });
    }

    let result = tauri::async_runtime::spawn_blocking(move || task(cancel_requested))
        .await
        .map_err(|e| format!("Background Git task failed: {e}"))?;

    if let Ok(mut active) = queue.active.lock() {
        if active.as_ref().map(|job| job.id) == Some(id) {
            *active = None;
        }
    }
    result
}

pub(crate) fn ensure_not_cancelled(cancel_requested: &AtomicBool) -> Result<(), String> {
    if cancel_requested.load(Ordering::Relaxed) {
        Err("Git job cancelled".into())
    } else {
        Ok(())
    }
}

pub(crate) fn status(queue: tauri::State<'_, GitJobQueue>) -> Result<GitJobStatus, String> {
    let active = queue
        .active
        .lock()
        .map_err(|_| "Git job queue lock is poisoned".to_string())?;
    Ok(match active.as_ref() {
        Some(job) => GitJobStatus {
            id: Some(job.id),
            label: Some(job.label.clone()),
            running: true,
            cancel_requested: job.cancel_requested.load(Ordering::Relaxed),
        },
        None => GitJobStatus {
            id: None,
            label: None,
            running: false,
            cancel_requested: false,
        },
    })
}

pub(crate) fn cancel(queue: tauri::State<'_, GitJobQueue>) -> Result<GitJobStatus, String> {
    let active = queue
        .active
        .lock()
        .map_err(|_| "Git job queue lock is poisoned".to_string())?;
    if let Some(job) = active.as_ref() {
        job.cancel_requested.store(true, Ordering::Relaxed);
        return Ok(GitJobStatus {
            id: Some(job.id),
            label: Some(job.label.clone()),
            running: true,
            cancel_requested: true,
        });
    }
    Ok(GitJobStatus {
        id: None,
        label: None,
        running: false,
        cancel_requested: false,
    })
}
