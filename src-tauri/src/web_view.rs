use std::{collections::HashSet, sync::Mutex};

use serde::Deserialize;
use tauri::{
    Emitter, LogicalPosition, LogicalSize, Manager, Runtime, State, Url, Webview, WebviewBuilder,
    WebviewUrl, WebviewWindowBuilder, Window,
};

/// The child web view laid over the app's Web View slot.
const LABEL: &str = "academy";
/// The separate window courses open in when the user prefers windows.
const COURSE_WINDOW_LABEL: &str = "course";
const HOME_URL: &str = "https://academy.zerotomastery.io/";
/// Hides the site's sidebar and reports fullscreen changes (see academy_init.js).
const INIT_SCRIPT: &str = include_str!("academy_init.js");
/// Tells the main window that the embedded web view entered or left fullscreen.
const FULLSCREEN_EVENT: &str = "web-view-fullscreen";

/// Where the web view should sit, in CSS (logical) pixels from the window's top-left.
#[derive(Clone, Copy, Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Labels of windows the app made fullscreen for a page, so leaving page fullscreen
/// only restores windows the user had not made fullscreen themselves.
#[derive(Default)]
pub struct FullscreenWindows(Mutex<HashSet<String>>);

/// Only https pages on zerotomastery.io may be opened in the app's web views.
fn course_url(url: &str) -> Result<Url, String> {
    let url = Url::parse(url).map_err(|error| format!("Invalid course URL: {error}"))?;
    let host = url.host_str().unwrap_or_default();
    let trusted = host == "zerotomastery.io" || host.ends_with(".zerotomastery.io");
    if url.scheme() != "https" || !trusted {
        return Err(format!(
            "Refusing to open {url}: not a Zero To Mastery page."
        ));
    }
    Ok(url)
}

/// Creates the academy web view on first use, then places and shows it. When `url` is
/// given the web view loads it, otherwise it keeps its current page (or the home page).
#[tauri::command]
pub async fn show_web_view<R: Runtime>(
    window: Window<R>,
    bounds: Bounds,
    url: Option<String>,
) -> Result<(), String> {
    let url = url.as_deref().map(course_url).transpose()?;
    let webview = match window.get_webview(LABEL) {
        Some(webview) => {
            if let Some(url) = url {
                webview.navigate(url).map_err(|e| e.to_string())?;
            }
            webview
        }
        None => {
            let url = match url {
                Some(url) => url,
                None => HOME_URL.parse().map_err(|e| format!("{e}"))?,
            };
            let builder = WebviewBuilder::new(LABEL, WebviewUrl::External(url))
                .initialization_script(INIT_SCRIPT);
            window
                .add_child(
                    builder,
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
pub async fn set_web_view_bounds<R: Runtime>(
    window: Window<R>,
    bounds: Bounds,
) -> Result<(), String> {
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

/// Opens `url` in the course window, creating it on first use and reusing it after.
#[tauri::command]
pub async fn open_course_window<R: Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
) -> Result<(), String> {
    let url = course_url(&url)?;
    if let Some(window) = app.get_webview_window(COURSE_WINDOW_LABEL) {
        window.navigate(url).map_err(|e| e.to_string())?;
        // Best effort: bringing the window forward should not fail the navigation.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, COURSE_WINDOW_LABEL, WebviewUrl::External(url))
        .title("ZTM Academy")
        .inner_size(1280.0, 800.0)
        .min_inner_size(480.0, 360.0)
        .initialization_script(INIT_SCRIPT)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Called by academy_init.js when the page enters or leaves fullscreen. The window goes
/// fullscreen, and the main window is told so it can stretch the embedded web view over
/// the whole window instead of leaving the app's sidebar and header visible.
#[tauri::command]
pub async fn web_view_fullscreen<R: Runtime>(
    webview: Webview<R>,
    fullscreen: bool,
    entered: State<'_, FullscreenWindows>,
) -> Result<(), String> {
    let label = webview.label();
    if label != LABEL && label != COURSE_WINDOW_LABEL {
        return Err(format!("web view {label} cannot request fullscreen"));
    }
    let window = webview.window();
    {
        let mut entered = entered.0.lock().map_err(|e| e.to_string())?;
        if fullscreen {
            // Some engines (WebKitGTK) already fullscreen the window themselves.
            if !window.is_fullscreen().map_err(|e| e.to_string())? {
                window.set_fullscreen(true).map_err(|e| e.to_string())?;
                entered.insert(window.label().to_owned());
            }
        } else if entered.remove(window.label()) {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
        }
    }
    if label == LABEL {
        webview
            .emit_to(window.label(), FULLSCREEN_EVENT, fullscreen)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::course_url;

    #[test]
    fn accepts_only_https_zero_to_mastery_pages() {
        for url in [
            "https://academy.zerotomastery.io/courses/enrolled/697434",
            "https://zerotomastery.io/courses/learn-rust/",
        ] {
            assert!(course_url(url).is_ok(), "{url}");
        }
        for url in [
            "http://academy.zerotomastery.io/",
            "https://evilzerotomastery.io/",
            "https://zerotomastery.io.example.com/",
            "javascript:alert(1)",
            "not a url",
        ] {
            assert!(course_url(url).is_err(), "{url}");
        }
    }
}
