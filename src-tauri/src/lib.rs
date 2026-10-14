mod academy;
mod app_state;
mod web_view;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            academy::load_courses,
            academy::sync_courses,
            app_state::load_state,
            app_state::save_state,
            web_view::show_web_view,
            web_view::set_web_view_bounds,
            web_view::hide_web_view
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
