use std::{
    env, fs,
    path::{Path, PathBuf},
};

use crate::models::DirectoryEntry;

#[tauri::command]
pub(crate) fn list_directory(
    path: String,
    show_hidden: Option<bool>,
) -> Result<Vec<DirectoryEntry>, String> {
    let dir = expand_home(&path);
    let read_dir =
        fs::read_dir(&dir).map_err(|e| format!("Unable to read {}: {e}", dir.display()))?;
    let mut entries = Vec::new();

    for item in read_dir {
        let Ok(item) = item else {
            continue;
        };
        let path = item.path();
        let Ok(file_type) = item.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let name = item.file_name().to_string_lossy().to_string();
        let is_hidden = name.starts_with('.');
        if is_hidden && !show_hidden.unwrap_or(false) {
            continue;
        }
        entries.push(DirectoryEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: true,
            is_git_repo: path.join(".git").exists(),
            is_hidden,
        });
    }
    entries.sort_by(|a, b| {
        b.is_git_repo
            .cmp(&a.is_git_repo)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries.truncate(500);
    Ok(entries)
}

#[tauri::command]
pub(crate) fn is_git_repository(path: String) -> bool {
    expand_home(&path).join(".git").exists()
}

#[tauri::command]
pub(crate) fn home_directory() -> Result<String, String> {
    home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Unable to locate home directory".into())
}

#[tauri::command]
pub(crate) fn common_directories() -> Result<Vec<DirectoryEntry>, String> {
    let mut entries = Vec::new();
    let Some(home) = home_dir() else {
        return Ok(entries);
    };
    let candidates = [
        ("Home".to_string(), home.clone()),
        ("Desktop".to_string(), home.join("Desktop")),
        ("Documents".to_string(), home.join("Documents")),
        ("Downloads".to_string(), home.join("Downloads")),
        ("Projects".to_string(), home.join("Projects")),
        ("Code".to_string(), home.join("Code")),
        ("Workspace".to_string(), home.join("Workspace")),
    ];
    for (name, path) in candidates {
        if path.is_dir() {
            entries.push(DirectoryEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                is_git_repo: path.join(".git").exists(),
                is_hidden: false,
            });
        }
    }
    #[cfg(unix)]
    if Path::new("/").is_dir() {
        entries.push(DirectoryEntry {
            name: "Computer".into(),
            path: "/".into(),
            is_dir: true,
            is_git_repo: false,
            is_hidden: false,
        });
    }
    Ok(entries)
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn expand_home(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(path));
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}
