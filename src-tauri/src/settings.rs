use std::{
    fs,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

static RUNTIME_SETTINGS: OnceLock<Mutex<AppSettings>> = OnceLock::new();

fn runtime_settings() -> &'static Mutex<AppSettings> {
    RUNTIME_SETTINGS.get_or_init(|| Mutex::new(AppSettings::default()))
}

pub(crate) fn current_app_settings() -> AppSettings {
    runtime_settings()
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default()
}

fn update_runtime_settings(settings: &AppSettings) {
    if let Ok(mut current) = runtime_settings().lock() {
        *current = settings.clone();
    }
}

use tauri::Manager;

use crate::models::AppSettings;

#[tauri::command]
pub(crate) fn load_app_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = app_settings_path(&app)?;
    if !path.exists() {
        let settings = AppSettings::default();
        update_runtime_settings(&settings);
        return Ok(settings);
    }
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Unable to read settings {}: {e}", path.display()))?;
    let settings: AppSettings =
        serde_json::from_str(&contents).map_err(|e| format!("Unable to parse settings: {e}"))?;
    update_runtime_settings(&settings);
    Ok(settings)
}

#[tauri::command]
pub(crate) fn save_app_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    let path = app_settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Unable to create settings directory {}: {e}",
                parent.display()
            )
        })?;
    }
    update_runtime_settings(&settings);
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Unable to serialize settings: {e}"))?;
    fs::write(&path, contents)
        .map_err(|e| format!("Unable to write settings {}: {e}", path.display()))
}

fn app_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Unable to locate app config directory: {e}"))?;
    Ok(dir.join("settings.json"))
}
