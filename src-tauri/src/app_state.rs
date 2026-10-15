use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::academy::write_atomic;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
}

/// User choices persisted across launches. Unset fields fall back to defaults in the UI.
#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppState {
    theme: Option<Theme>,
    /// Uuids of courses the user has starred.
    favourites: Vec<String>,
    /// Name used to greet the user on the Dashboard.
    name: Option<String>,
    /// Whether the user has a ZTM Academy membership. Unset means a member.
    academy_member: Option<bool>,
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join("data").join("state.json"))
        .map_err(|error| format!("Could not locate the app data folder: {error}"))
}

fn read_state(path: &Path) -> AppState {
    // A missing or unreadable file only means the defaults are used.
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write_state(path: &Path, state: &AppState) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not serialise app state: {error}"))?;
    write_atomic(path, &bytes)
}

#[tauri::command]
pub async fn load_state(app: tauri::AppHandle) -> Result<AppState, String> {
    let path = state_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || read_state(&path))
        .await
        .map_err(|error| format!("App state task failed: {error}"))
}

#[tauri::command]
pub async fn save_state(app: tauri::AppHandle, state: AppState) -> Result<(), String> {
    let path = state_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || write_state(&path, &state))
        .await
        .map_err(|error| format!("App state task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_or_invalid_state_uses_defaults() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("state.json");
        assert_eq!(read_state(&path), AppState::default());
        fs::write(&path, b"not json").unwrap();
        assert_eq!(read_state(&path), AppState::default());
    }

    #[test]
    fn round_trips_state() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data").join("state.json");
        let state = AppState {
            theme: Some(Theme::Dark),
            favourites: vec!["39fcbbb8".into()],
            name: Some("Mark".into()),
            academy_member: Some(false),
        };
        write_state(&path, &state).unwrap();
        assert_eq!(read_state(&path), state);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&fs::read(&path).unwrap()).unwrap(),
            serde_json::json!({ "theme": "dark", "favourites": ["39fcbbb8"], "name": "Mark", "academyMember": false })
        );
    }

    #[test]
    fn ignores_unknown_fields() {
        let state: AppState = serde_json::from_str(r#"{"theme":"light","extra":1}"#).unwrap();
        assert_eq!(state.theme, Some(Theme::Light));
    }
}
