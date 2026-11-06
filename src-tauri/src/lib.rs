mod media;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            media::probe_media,
            media::read_artwork,
            media::read_subtitle
        ])
        .run(tauri::generate_context!())
        .expect("error while running VANTA");
}
