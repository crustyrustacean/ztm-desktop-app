use std::{
    collections::HashSet,
    sync::{Arc, Mutex},
};

use serde::{Deserialize, Serialize};
use tauri::{
    Emitter, LogicalPosition, LogicalSize, Manager, Runtime, State, Url, Webview, WebviewBuilder,
    WebviewUrl, WebviewWindowBuilder, Window, WindowEvent,
};

/// The child web view laid over the app's Web View slot.
const LABEL: &str = "academy";
/// The separate window courses open in when the user prefers windows.
const COURSE_WINDOW_LABEL: &str = "course";
/// A disposable copy of the embedded page used for fullscreen.
const FULLSCREEN_WINDOW_LABEL: &str = "academy-fullscreen";
/// Tells the shell to return to its dashboard after the embedded view is promoted.
const PROMOTED_EVENT: &str = "web-view-promoted";
/// Returns the standalone page's current session to the embedded view.
const DEMOTED_EVENT: &str = "web-view-demoted";
const MAIN_WINDOW_LABEL: &str = "main";
const HOME_URL: &str = "https://academy.zerotomastery.io/";
/// Hides the site's sidebar and handles fullscreen changes (see academy_init.js).
const INIT_SCRIPT: &str = include_str!("academy_init.js");

fn init_script(view: &str, session: Option<&PageSession>, theme: WebTheme) -> String {
    let session = serde_json::to_string(&session).expect("page session serializes");
    let theme = theme.script();
    format!(
        "window.__ZTM_DESKTOP_VIEW__ = {view:?};\n\
         window.__ZTM_DESKTOP_THEME__ = {theme:?};\n\
         window.__ZTM_DESKTOP_RESTORE__ = {session};\n{INIT_SCRIPT}"
    )
}

#[derive(Clone, Copy, Debug, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WebTheme {
    #[default]
    Light,
    Dark,
}

impl WebTheme {
    fn tauri(self) -> tauri::Theme {
        match self {
            Self::Light => tauri::Theme::Light,
            Self::Dark => tauri::Theme::Dark,
        }
    }

    fn script(self) -> &'static str {
        match self {
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

#[cfg(target_os = "windows")]
fn set_webview_native_theme<R: Runtime>(
    webview: &Webview<R>,
    theme: WebTheme,
) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK, COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT,
        ICoreWebView2_13,
    };
    use windows_core::Interface;

    webview
        .with_webview(move |platform| unsafe {
            let result = (|| {
                let core = platform.controller().CoreWebView2()?;
                let core: ICoreWebView2_13 = core.cast()?;
                let profile = core.Profile()?;
                profile.SetPreferredColorScheme(match theme {
                    WebTheme::Light => COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT,
                    WebTheme::Dark => COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK,
                })
            })();
            if let Err(error) = result {
                eprintln!("failed to set child webview theme: {error}");
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "windows"))]
fn set_webview_native_theme<R: Runtime>(
    _webview: &Webview<R>,
    _theme: WebTheme,
) -> Result<(), String> {
    Ok(())
}

#[derive(Default)]
pub struct WebViewTheme(Mutex<WebTheme>);

fn destroy_fullscreen<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(FULLSCREEN_WINDOW_LABEL) {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Where the web view should sit, in CSS (logical) pixels from the window's top-left.
#[derive(Clone, Copy, Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSession {
    url: String,
    scroll_x: f64,
    scroll_y: f64,
    media_time: Option<f64>,
    media_paused: Option<bool>,
    playback_rate: Option<f64>,
}

impl PageSession {
    fn at_url(url: Url) -> Self {
        Self {
            url: url.to_string(),
            scroll_x: 0.0,
            scroll_y: 0.0,
            media_time: None,
            media_paused: None,
            playback_rate: None,
        }
    }
}

/// Labels of windows the app made fullscreen for a page, so leaving page fullscreen
/// only restores windows the user had not made fullscreen themselves.
#[derive(Default)]
pub struct FullscreenWindows(Mutex<HashSet<String>>);

/// Prevents the DOM event and native window event from promoting the same child twice.
#[derive(Default)]
pub struct PromotionState(Mutex<bool>);

/// A fullscreen window can emit startup resize events before the platform reports it
/// as fullscreen. It may only be disposed after fullscreen has actually been observed.
#[derive(Default)]
struct FullscreenWindowLifecycle {
    entered: bool,
}

impl FullscreenWindowLifecycle {
    fn observe(&mut self, fullscreen: bool) -> bool {
        if fullscreen {
            self.entered = true;
            false
        } else {
            self.entered
        }
    }
}

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

fn is_academy_exit_navigation(url: &Url) -> bool {
    if url.scheme() != "https" || url.host_str() != Some("academy.zerotomastery.io") {
        return false;
    }
    let segments: Vec<_> = url
        .path_segments()
        .map(|segments| segments.filter(|segment| !segment.is_empty()).collect())
        .unwrap_or_default();
    segments.is_empty()
        || (segments.len() == 2 && segments[0] == "courses" && !segments[1].is_empty())
}

/// Creates the academy web view on first use, then places and shows it. When `url` is
/// given the web view loads it, otherwise it keeps its current page (or the home page).
#[tauri::command]
pub async fn show_web_view<R: Runtime>(
    window: Window<R>,
    bounds: Bounds,
    url: Option<String>,
    session: Option<PageSession>,
    theme: State<'_, WebViewTheme>,
) -> Result<(), String> {
    destroy_fullscreen(window.app_handle())?;
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
            let theme = *theme.0.lock().map_err(|e| e.to_string())?;
            let builder = WebviewBuilder::new(LABEL, WebviewUrl::External(url))
                .initialization_script(init_script("embedded", session.as_ref(), theme));
            window
                .add_child(
                    builder,
                    LogicalPosition::new(bounds.x, bounds.y),
                    LogicalSize::new(bounds.width, bounds.height),
                )
                .map_err(|e| e.to_string())?
        }
    };
    let theme = *theme.0.lock().map_err(|e| e.to_string())?;
    set_webview_native_theme(&webview, theme)?;
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
pub async fn dispose_web_view<R: Runtime>(window: Window<R>) -> Result<(), String> {
    if let Some(webview) = window.get_webview(LABEL) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Opens `url` in the course window, creating it on first use and reusing it after.
#[tauri::command]
pub async fn open_course_window<R: Runtime>(
    app: tauri::AppHandle<R>,
    url: String,
    theme: State<'_, WebViewTheme>,
) -> Result<(), String> {
    destroy_fullscreen(&app)?;
    let url = course_url(&url)?;
    if let Some(window) = app.get_webview_window(COURSE_WINDOW_LABEL) {
        window.navigate(url).map_err(|e| e.to_string())?;
        // Best effort: bringing the window forward should not fail the navigation.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    let theme = *theme.0.lock().map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, COURSE_WINDOW_LABEL, WebviewUrl::External(url))
        .title("ZTM Academy")
        .inner_size(1280.0, 800.0)
        .min_inner_size(480.0, 360.0)
        .theme(Some(theme.tauri()))
        .initialization_script(init_script("window", None, theme))
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Called by academy_init.js when a page enters or leaves fullscreen. Embedded pages
/// are copied into a dedicated fullscreen window; standalone course windows can make
/// their own window fullscreen without exposing the app dashboard.
fn promote_embedded<R: Runtime>(
    webview: Webview<R>,
    session: Option<PageSession>,
    theme: WebTheme,
) -> Result<(), String> {
    let window = webview.window();
    let url = course_url(webview.url().map_err(|e| e.to_string())?.as_str())?;
    let app = window.app_handle();
    destroy_fullscreen(app)?;

    // End fullscreen in the child before hiding it. Otherwise the native child
    // remains above the app shell even after the replica window opens.
    webview
        .eval(
            "if (document.fullscreenElement) document.exitFullscreen();\
                 else if (document.webkitFullscreenElement) document.webkitExitFullscreen();",
        )
        .map_err(|e| e.to_string())?;
    webview.hide().map_err(|e| e.to_string())?;
    // Tauri's Windows runtime automatically fullscreens the parent window when
    // WebView2 reports a fullscreen element. Counter that native transition; the
    // dedicated replica below is the only window that should become fullscreen.
    window.set_fullscreen(false).map_err(|e| e.to_string())?;

    let fullscreen_init = init_script("fullscreen", session.as_ref(), theme);
    let fallback_session = session.unwrap_or_else(|| PageSession::at_url(url.clone()));
    let navigation_app = app.clone();
    let fullscreen_window =
        match WebviewWindowBuilder::new(app, FULLSCREEN_WINDOW_LABEL, WebviewUrl::External(url))
            .title("ZTM Academy")
            .fullscreen(true)
            .theme(Some(theme.tauri()))
            .initialization_script(fullscreen_init)
            .on_navigation(move |requested| {
                if !is_academy_exit_navigation(requested) {
                    return true;
                }

                // This is a native backstop for Academy replacing or bypassing
                // the injected click handler. Never let its logo strand the
                // promoted window on the Academy home route.
                let _ = navigation_app.emit_to(
                    MAIN_WINDOW_LABEL,
                    DEMOTED_EVENT,
                    fallback_session.clone(),
                );
                if let Some(window) = navigation_app.get_webview_window(FULLSCREEN_WINDOW_LABEL) {
                    let _ = window.destroy();
                }
                false
            })
            .build()
        {
            Ok(window) => window,
            Err(error) => {
                let _ = webview.show();
                return Err(error.to_string());
            }
        };
    // Building the new native window gives any queued WebView2 fullscreen event
    // time to reach Tauri. Restore the parent again after that event is drained.
    window.set_fullscreen(false).map_err(|e| e.to_string())?;

    // The standalone fullscreen window now owns the Academy page. Close the child
    // webview instead of retaining a hidden duplicate, then return the app shell
    // to its dashboard behind the fullscreen window.
    webview.close().map_err(|e| e.to_string())?;
    window.emit(PROMOTED_EVENT, ()).map_err(|e| e.to_string())?;

    // Ignore startup resizes until the platform has confirmed that this window
    // really entered fullscreen. Otherwise WebView2 can destroy it immediately.
    let observed_window = fullscreen_window.clone();
    let lifecycle = Arc::new(Mutex::new(FullscreenWindowLifecycle::default()));
    if let Ok(fullscreen) = fullscreen_window.is_fullscreen() {
        lifecycle
            .lock()
            .map_err(|e| e.to_string())?
            .observe(fullscreen);
    }
    fullscreen_window.on_window_event(move |event| {
        if !matches!(event, WindowEvent::Resized(_)) {
            return;
        }
        let Ok(fullscreen) = observed_window.is_fullscreen() else {
            return;
        };
        let should_destroy = lifecycle
            .lock()
            .map(|mut lifecycle| lifecycle.observe(fullscreen))
            .unwrap_or(false);
        if should_destroy {
            if let Ok(url) = observed_window.url() {
                let session = PageSession::at_url(url);
                let _ =
                    observed_window
                        .app_handle()
                        .emit_to(MAIN_WINDOW_LABEL, DEMOTED_EVENT, session);
            }
            let _ = observed_window.destroy();
        }
    });
    Ok(())
}

fn promote_once<R: Runtime>(
    webview: Webview<R>,
    session: Option<PageSession>,
    state: &PromotionState,
    theme: WebTheme,
) -> Result<(), String> {
    {
        let mut promoting = state.0.lock().map_err(|e| e.to_string())?;
        if *promoting {
            return Ok(());
        }
        *promoting = true;
    }
    let result = promote_embedded(webview, session, theme);
    if let Ok(mut promoting) = state.0.lock() {
        *promoting = false;
    }
    result
}

/// Native fallback for WebView2, which can fullscreen the parent window without the
/// page-level fullscreen event reliably crossing an embedded video iframe boundary.
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !matches!(event, WindowEvent::Resized(_)) || !matches!(window.is_fullscreen(), Ok(true)) {
        return;
    }
    let Some(webview) = window.get_webview(LABEL) else {
        return;
    };
    let state = window.state::<PromotionState>();
    let theme = window.state::<WebViewTheme>();
    let theme = theme.0.lock().map(|theme| *theme).unwrap_or_default();
    if let Err(error) = promote_once(webview, None, &state, theme) {
        eprintln!("web view fullscreen promotion failed: {error}");
    }
}

#[tauri::command]
pub fn web_view_fullscreen<R: Runtime>(
    webview: Webview<R>,
    fullscreen: bool,
    session: Option<PageSession>,
    entered: State<'_, FullscreenWindows>,
    promotion: State<'_, PromotionState>,
    theme: State<'_, WebViewTheme>,
) -> Result<(), String> {
    let label = webview.label();
    if label != LABEL && label != COURSE_WINDOW_LABEL && label != FULLSCREEN_WINDOW_LABEL {
        return Err(format!("web view {label} cannot request fullscreen"));
    }
    let window = webview.window();

    if label == LABEL {
        if fullscreen {
            let theme = *theme.0.lock().map_err(|e| e.to_string())?;
            return promote_once(webview, session, &promotion, theme);
        }
        return Ok(());
    }

    if label == FULLSCREEN_WINDOW_LABEL && !fullscreen {
        let session = match session {
            Some(session) => session,
            None => PageSession::at_url(webview.url().map_err(|e| e.to_string())?),
        };
        window
            .app_handle()
            .emit_to(MAIN_WINDOW_LABEL, DEMOTED_EVENT, session)
            .map_err(|e| e.to_string())?;
        window.destroy().map_err(|e| e.to_string())?;
        return Ok(());
    }

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
    Ok(())
}

#[tauri::command]
pub fn set_web_view_theme<R: Runtime>(
    app: tauri::AppHandle<R>,
    theme: WebTheme,
    reset: bool,
    current: State<'_, WebViewTheme>,
) -> Result<(), String> {
    *current.0.lock().map_err(|e| e.to_string())? = theme;

    for label in [
        MAIN_WINDOW_LABEL,
        COURSE_WINDOW_LABEL,
        FULLSCREEN_WINDOW_LABEL,
    ] {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_theme(Some(theme.tauri()))
                .map_err(|e| e.to_string())?;
            if label != MAIN_WINDOW_LABEL {
                window
                    .eval(format!(
                        "window.__ZTM_DESKTOP_SET_THEME__?.({:?})",
                        theme.script()
                    ))
                    .map_err(|e| e.to_string())?;
                if reset {
                    window.reload().map_err(|e| e.to_string())?;
                }
            }
        }
    }
    if let Some(webview) = app.get_webview(LABEL) {
        set_webview_native_theme(&webview, theme)?;
        webview
            .eval(format!(
                "window.__ZTM_DESKTOP_SET_THEME__?.({:?})",
                theme.script()
            ))
            .map_err(|e| e.to_string())?;
        if reset {
            webview.reload().map_err(|e| e.to_string())?;
        }
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
    use super::{FullscreenWindowLifecycle, course_url, is_academy_exit_navigation};

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

    #[test]
    fn intercepts_only_academy_routes_that_leave_fullscreen_content() {
        for url in [
            "https://academy.zerotomastery.io/",
            "https://academy.zerotomastery.io/?source=logo",
            "https://academy.zerotomastery.io/courses/697434",
        ] {
            assert!(is_academy_exit_navigation(&url.parse().unwrap()), "{url}");
        }
        for url in [
            "https://academy.zerotomastery.io/courses/enrolled/697434",
            "https://academy.zerotomastery.io/courses/697434/lectures/1234",
            "https://zerotomastery.io/",
            "https://example.com/",
        ] {
            assert!(!is_academy_exit_navigation(&url.parse().unwrap()), "{url}");
        }
    }

    #[test]
    fn fullscreen_window_survives_startup_resizes_and_closes_after_exit() {
        let mut lifecycle = FullscreenWindowLifecycle::default();

        assert!(!lifecycle.observe(false), "startup resize must be ignored");
        assert!(
            !lifecycle.observe(false),
            "repeated startup resize must be ignored"
        );
        assert!(
            !lifecycle.observe(true),
            "entering fullscreen must keep the window"
        );
        assert!(
            lifecycle.observe(false),
            "leaving fullscreen must close the window"
        );
    }
}
