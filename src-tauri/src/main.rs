#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod media;
mod memory;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            memory::initialize(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            memory::desktop_info,
            memory::desktop_memory_count,
            memory::desktop_memory_save_turn,
            memory::desktop_memory_recent,
            memory::desktop_memory_save_episode,
            memory::desktop_memory_save_affect,
            memory::desktop_memory_recall,
            memory::desktop_memory_clear,
            memory::desktop_memory_import_turns,
            memory::desktop_memory_export,
            memory::desktop_permission_get,
            memory::desktop_permission_set,
            media::desktop_media_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mira desktop");
}
