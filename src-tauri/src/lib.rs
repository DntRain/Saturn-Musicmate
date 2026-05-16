pub mod ai;
pub mod commands;
pub mod library;
pub mod media;
pub mod online;
pub mod player;
pub mod qq_login;
pub mod settings;
pub mod sidecar;
pub mod spectrum;
pub mod tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(sidecar::SidecarState::default())
        .setup(|app| {
            settings::hydrate_env(&app.handle());
            commands::register(&app.handle());
            sidecar::spawn_async(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_library,
            commands::set_playlist,
            commands::play_index,
            commands::toggle_playback,
            commands::next_track,
            commands::prev_track,
            commands::set_volume,
            commands::seek,
            commands::queue_append,
            commands::queue_insert_next,
            commands::queue_remove_at,
            commands::get_cover,
            commands::get_cover_palette,
            commands::get_lyrics,
            commands::search_online,
            commands::fetch_online_lyrics,
            commands::fetch_track_comments,
            commands::fetch_hot_chart,
            commands::play_online,
            commands::generate_host_line,
            commands::chat_with_host,
            commands::plan_host_action,
            commands::speak_line,
            qq_login::open_qq_login,
            qq_login::import_qq_cookies,
            qq_login::close_qq_login,
            settings::settings_get,
            settings::settings_save,
            settings::settings_test_deepseek,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Musicmate")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                sidecar::shutdown(app_handle);
            }
        });
}
