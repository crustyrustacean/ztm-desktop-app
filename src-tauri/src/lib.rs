mod academy;
mod images;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(images::CourseImages::default())
        .register_asynchronous_uri_scheme_protocol(images::SCHEME, |ctx, request, responder| {
            images::handle_request(ctx.app_handle().clone(), request, responder)
        })
        .invoke_handler(tauri::generate_handler![
            academy::load_courses,
            academy::sync_courses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
