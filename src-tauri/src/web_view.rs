use serde::Deserialize;
use tauri::{LogicalPosition, LogicalSize, Manager, Runtime, Webview, WebviewBuilder, WebviewUrl, Window};

const LABEL: &str = "academy";
const URL: &str = "https://academy.zerotomastery.io/";

/// Where the web view should sit, in CSS (logical) pixels from the window's top-left.
#[derive(Clone, Copy, Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Creates the academy web view on first use, then places and shows it.
#[tauri::command]
pub async fn show_web_view<R: Runtime>(window: Window<R>, bounds: Bounds) -> Result<(), String> {
    let webview = match window.get_webview(LABEL) {
        Some(webview) => webview,
        None => {
            let url = WebviewUrl::External(URL.parse().map_err(|e| format!("{e}"))?);
            window
                .add_child(
                    WebviewBuilder::new(LABEL, url),
                    LogicalPosition::new(bounds.x, bounds.y),
                    LogicalSize::new(bounds.width, bounds.height),
                )
                .map_err(|e| e.to_string())?
        }
    };
    place(&webview, bounds)?;
    webview.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_web_view_bounds<R: Runtime>(window: Window<R>, bounds: Bounds) -> Result<(), String> {
    match window.get_webview(LABEL) {
        Some(webview) => place(&webview, bounds),
        None => Ok(()),
    }
}

#[tauri::command]
pub async fn hide_web_view<R: Runtime>(window: Window<R>) -> Result<(), String> {
    match window.get_webview(LABEL) {
        Some(webview) => webview.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

#[cfg(not(target_os = "linux"))]
fn place<R: Runtime>(webview: &Webview<R>, bounds: Bounds) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .and_then(|_| webview.set_size(LogicalSize::new(bounds.width, bounds.height)))
        .map_err(|e| e.to_string())
}

// On Linux Tauri packs child webviews into the window's GtkBox, so the box splits the
// window between them and ignores position/size. Move the child into a GtkOverlay on
// top of the main webview and position it with margins instead.
#[cfg(target_os = "linux")]
fn place<R: Runtime>(webview: &Webview<R>, bounds: Bounds) -> Result<(), String> {
    use gtk::prelude::*;

    webview
        .with_webview(move |platform| {
            let child: gtk::Widget = platform.inner().upcast();
            if let Err(error) = attach_overlay(&child) {
                eprintln!("web view: {error}");
                return;
            }
            child.set_halign(gtk::Align::Start);
            child.set_valign(gtk::Align::Start);
            child.set_margin_start(bounds.x.round() as i32);
            child.set_margin_top(bounds.y.round() as i32);
            child.set_size_request(bounds.width.round() as i32, bounds.height.round() as i32);
        })
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn attach_overlay(child: &gtk::Widget) -> Result<(), &'static str> {
    use gtk::prelude::*;

    let parent = child.parent().ok_or("web view has no parent")?;
    if parent.is::<gtk::Overlay>() {
        return Ok(());
    }
    let vbox = parent
        .downcast::<gtk::Box>()
        .map_err(|_| "web view parent is not a GtkBox")?;
    let main = vbox
        .children()
        .into_iter()
        .find(|widget| widget != child && widget.is::<webkit2gtk::WebView>())
        .ok_or("main webview not found")?;

    // The local handles keep both webviews alive while they are out of a container.
    let overlay = gtk::Overlay::new();
    vbox.remove(child);
    vbox.remove(&main);
    overlay.add(&main);
    overlay.add_overlay(child);
    vbox.pack_start(&overlay, true, true, 0);
    overlay.show();
    Ok(())
}
