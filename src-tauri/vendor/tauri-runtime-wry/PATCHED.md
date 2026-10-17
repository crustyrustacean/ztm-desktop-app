# Patched Tauri runtime

This spike vendors `tauri-runtime-wry` 2.12.1 so Linux webviews can be mounted
in a `gtk::Fixed` container and retain child-webview geometry. It investigates
[tauri-apps/tauri#16132](https://github.com/tauri-apps/tauri/issues/16132).

The unmodified upstream source came from Cargo's registry cache. Keep Linux-only
experiments behind target configuration so Windows and macOS behavior is unchanged.
