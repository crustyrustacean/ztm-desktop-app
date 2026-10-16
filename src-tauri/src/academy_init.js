// Injected into every top-level ZTM page shown by the app (the embedded web view and
// the course window). It runs before the page's own scripts, so it must not assume
// that <head> or <body> exist yet.
(() => {
  if (window.top !== window) return;
  if (!/(^|\.)zerotomastery\.io$/.test(location.hostname)) return;

  // The app has its own navigation, so the site's sidebar is redundant here.
  const SIDEBAR = ".ztm-sidebar";
  const STYLE_ID = "ztm-desktop-app-style";

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `${SIDEBAR} { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);
  }

  // The site reserves room for the fixed sidebar. Give that room back on the elements
  // whose left offset matches the sidebar's width, rather than guessing at selectors.
  function reclaimSidebarSpace() {
    const sidebar = document.querySelector(SIDEBAR);
    if (!sidebar || !document.body) return;
    const width = parseFloat(sidebar.style.minWidth) || 250;
    const candidates = [document.documentElement, document.body];
    for (const child of document.body.children) {
      candidates.push(child, ...child.children);
    }
    for (const element of candidates) {
      if (element === sidebar) continue;
      const computed = getComputedStyle(element);
      for (const property of ["margin-left", "padding-left", "left"]) {
        const value = parseFloat(computed.getPropertyValue(property));
        if (Math.abs(value - width) < 1) {
          element.style.setProperty(property, "0px", "important");
        }
      }
    }
  }

  let scheduled = false;
  function scheduleReclaim() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      reclaimSidebarSpace();
    });
  }

  addStyle();
  document.addEventListener("DOMContentLoaded", () => {
    addStyle();
    scheduleReclaim();
    // The sidebar is added by the site's scripts, possibly after load.
    new MutationObserver(scheduleReclaim).observe(document.body, {
      childList: true,
    });
  });
  window.addEventListener("load", scheduleReclaim);

  // Tell the app when the page (usually the video player) enters or leaves fullscreen
  // so it can grow the web view past the app's own interface.
  let fullscreen = false;
  function reportFullscreen(next) {
    if (next === fullscreen) return;
    fullscreen = next;
    const ipc = window.__TAURI_INTERNALS__;
    if (!ipc) return;
    ipc
      .invoke("web_view_fullscreen", { fullscreen: next })
      .catch((error) => console.error("web_view_fullscreen failed", error));
  }
  const onChange = () =>
    reportFullscreen(
      Boolean(document.fullscreenElement || document.webkitFullscreenElement),
    );
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  // Leaving the page ends fullscreen without a change event on this document.
  window.addEventListener("pagehide", () => reportFullscreen(false));
})();
