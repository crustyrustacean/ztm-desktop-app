# Patched Tauri runtime

This spike vendors `tauri-runtime-wry` 2.12.1 so Linux window-content and child
webviews can share a `gtk::Overlay` while child webviews retain explicit geometry.
It investigates
[tauri-apps/tauri#16132](https://github.com/tauri-apps/tauri/issues/16132).

The overlay is packed into Tauri's default vbox. The window-content webview is its
main child and fills the allocation without a size request. Positioned child
webviews live in one pass-through `gtk::Fixed` overlay layer; bounds updates move
and size only those children. This avoids the requisition feedback loop caused by
setting an allocation-sized minimum request on the window-content webview.

The unmodified upstream source came from Cargo's registry cache. Keep Linux-only
experiments behind target configuration so Windows and macOS behavior is unchanged.
