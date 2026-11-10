mod media;

use std::{collections::HashSet, path::PathBuf, sync::Mutex};

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow,
};

const OPEN_FILES_EVENT: &str = "vanta-open-files";
const DEFAULT_WINDOW_SIZE: LogicalSize<f64> = LogicalSize::new(1360.0, 880.0);
const WINDOW_MARGIN: f64 = 32.0;

#[derive(Default)]
struct LaunchState(Mutex<Vec<String>>);

#[derive(Clone, Copy)]
struct WindowedBounds {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    maximized: bool,
}

/// Remembers the windowed geometry so leaving fullscreen can always return to a
/// real, visible window instead of a stuck borderless screen.
#[derive(Default)]
struct WindowModeState(Mutex<Option<WindowedBounds>>);

fn fitted_window_size(window: &WebviewWindow) -> LogicalSize<f64> {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return DEFAULT_WINDOW_SIZE;
    };

    let scale = monitor.scale_factor();
    let work_area = monitor.work_area().size;

    LogicalSize::new(
        (work_area.width as f64 / scale - WINDOW_MARGIN).clamp(480.0, DEFAULT_WINDOW_SIZE.width),
        (work_area.height as f64 / scale - WINDOW_MARGIN).clamp(320.0, DEFAULT_WINDOW_SIZE.height),
    )
}

fn apply_fullscreen(
    window: &WebviewWindow,
    state: &WindowModeState,
    fullscreen: bool,
) -> Result<(), String> {
    if fullscreen {
        if window.is_fullscreen().unwrap_or(false) {
            return Ok(());
        }

        let maximized = window.is_maximized().unwrap_or(false);
        let position = window.outer_position().ok();
        let size = window.inner_size().ok();

        if let (Some(position), Some(size)) = (position, size) {
            if let Ok(mut saved) = state.0.lock() {
                *saved = Some(WindowedBounds {
                    position,
                    size,
                    maximized,
                });
            }
        }

        return window
            .set_fullscreen(true)
            .map_err(|error| error.to_string());
    }

    let saved = state.0.lock().ok().and_then(|mut bounds| bounds.take());

    window
        .set_fullscreen(false)
        .map_err(|error| error.to_string())?;

    // Windows can keep a borderless fullscreen window hidden or unfocused after
    // leaving fullscreen. Force it back into a normal, interactive state.
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();

    match saved {
        Some(bounds) if bounds.maximized => {
            let _ = window.maximize();
        }
        Some(bounds) => {
            let _ = window.unmaximize();
            let _ = window.set_size(bounds.size);
            let _ = window.set_position(bounds.position);
        }
        None => {
            // No geometry was captured (for example when a previous build
            // started directly in fullscreen), so fall back to a centered
            // window that fits the monitor's work area.
            let _ = window.unmaximize();
            let _ = window.set_size(fitted_window_size(window));
            let _ = window.center();
        }
    }

    Ok(())
}

#[tauri::command]
fn toggle_fullscreen(
    window: WebviewWindow,
    state: tauri::State<'_, WindowModeState>,
) -> Result<bool, String> {
    let fullscreen = !window.is_fullscreen().unwrap_or(false);
    apply_fullscreen(&window, &state, fullscreen)?;
    Ok(fullscreen)
}

fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn media_paths_from_args<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut seen = HashSet::new();

    args.into_iter()
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            let path = PathBuf::from(&arg);

            if !path.is_file() {
                return None;
            }

            let key = arg.to_lowercase();
            if !seen.insert(key) {
                return None;
            }

            Some(path.to_string_lossy().into_owned())
        })
        .collect()
}

fn queue_launch_paths(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    if let Some(state) = app.try_state::<LaunchState>() {
        if let Ok(mut queued) = state.0.lock() {
            for path in paths {
                if !queued
                    .iter()
                    .any(|existing| existing.eq_ignore_ascii_case(&path))
                {
                    queued.push(path);
                }
            }
        }
    }

    let _ = app.emit(OPEN_FILES_EVENT, ());
}

#[tauri::command]
fn take_launch_paths(state: tauri::State<'_, LaunchState>) -> Vec<String> {
    match state.0.lock() {
        Ok(mut paths) => std::mem::take(&mut *paths),
        Err(_) => Vec::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = media_paths_from_args(argv.into_iter().skip(1));
            queue_launch_paths(app, paths);
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let paths = media_paths_from_args(
                std::env::args_os()
                    .skip(1)
                    .map(|arg| arg.to_string_lossy().into_owned()),
            );
            app.manage(LaunchState(Mutex::new(paths)));
            app.manage(WindowModeState::default());

            // VANTA always starts windowed. Fullscreen is opt-in through the
            // fullscreen control or the F/Escape shortcuts.
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            media::probe_media,
            media::read_artwork,
            media::read_subtitle,
            take_launch_paths,
            toggle_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running VANTA");
}
