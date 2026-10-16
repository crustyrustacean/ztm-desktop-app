// Injected into every top-level ZTM page shown by the app. It runs before the page's
// own scripts, so it must not assume that <head> or <body> exist yet.
(() => {
  if (window.top !== window) return;
  if (!/(^|\.)zerotomastery\.io$/.test(location.hostname)) return;

  // This is deliberately the only Academy style the desktop app injects.
  const SIDEBAR = ".ztm-sidebar";
  const LESSON_NAV = 'div.nav:has(a[href="/"] img[alt="school logo"])';
  const HOME_LOGO =
    'img[alt="school logo"], img[src*="ztm-logo-academy.svg"]';
  const COURSE_BACK =
    'a.nav-icon-back[aria-label="Back to course curriculum"]';
  const STYLE_ID = "ztm-desktop-app-style";
  const isFullscreenView = window.__ZTM_DESKTOP_VIEW__ === "fullscreen";
  let appTheme = window.__ZTM_DESKTOP_THEME__ === "dark" ? "dark" : "light";
  let paletteScheduled = false;

  function isCourseOverview() {
    return /^\/courses\/(?:enrolled\/)?[^/]+\/?$/.test(location.pathname);
  }

  function rgbChannels(value) {
    const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match ? match.slice(1).map(Number) : null;
  }

  function neutralRgb(value, minimum, maximum) {
    const channels = rgbChannels(value);
    if (!channels) return false;
    return (
      channels.every((channel) => channel >= minimum && channel <= maximum) &&
      Math.max(...channels) - Math.min(...channels) <= 18
    );
  }

  function darkRgb(value) {
    const channels = rgbChannels(value);
    return Boolean(channels?.every((channel) => channel <= 80));
  }

  function normalizeCourseOverview() {
    paletteScheduled = false;
    if (!document.body || typeof getComputedStyle !== "function") return;
    const elements = document.body.querySelectorAll("*");
    if (appTheme !== "dark" || !isCourseOverview()) {
      for (const element of elements) {
        delete element.dataset.ztmDarkSurface;
        delete element.dataset.ztmDarkText;
      }
      return;
    }

    for (const element of elements) {
      if (element.closest("svg, picture, video, canvas")) continue;
      const computed = getComputedStyle(element);
      if (
        element.dataset.ztmDarkSurface === "true" ||
        neutralRgb(computed.backgroundColor, 235, 255)
      ) {
        element.dataset.ztmDarkSurface = "true";
      }
      if (
        element.dataset.ztmDarkText === "true" ||
        darkRgb(computed.color)
      ) {
        element.dataset.ztmDarkText = "true";
      }
    }
  }

  function scheduleCoursePalette() {
    if (paletteScheduled || !window.requestAnimationFrame) return;
    paletteScheduled = true;
    window.requestAnimationFrame(normalizeCourseOverview);
  }

  function injectedCss() {
    const navigationRule = isFullscreenView
      ? `${SIDEBAR} { display: none !important; }`
      : `${SIDEBAR}, ${LESSON_NAV} { display: none !important; }`;
    return `:root { color-scheme: ${appTheme} !important; }
      :root[data-theme="dark"] [data-ztm-dark-surface="true"] {
        background-color: #181818 !important;
        border-color: #363636 !important;
      }
      :root[data-theme="dark"] [data-ztm-dark-text="true"] {
        color: #f5f5f5 !important;
      }
      ${navigationRule}`;
  }

  function applyAppTheme(theme) {
    appTheme = theme === "dark" ? "dark" : "light";
    window.__ZTM_DESKTOP_THEME__ = appTheme;
    const root = document.documentElement;
    if (!root) return;
    if (root.classList.contains("dark") !== (appTheme === "dark")) {
      root.classList.toggle("dark", appTheme === "dark");
    }
    if (root.classList.contains("light") !== (appTheme === "light")) {
      root.classList.toggle("light", appTheme === "light");
    }
    if (root.dataset.theme !== appTheme) root.dataset.theme = appTheme;
    if (root.style.colorScheme !== appTheme) root.style.colorScheme = appTheme;
    const style = document.getElementById(STYLE_ID);
    if (style && style.textContent !== injectedCss()) {
      style.textContent = injectedCss();
    }
    scheduleCoursePalette();
  }
  window.__ZTM_DESKTOP_SET_THEME__ = applyAppTheme;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const root = document.head || document.documentElement;
    if (!root) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = injectedCss();
    root.appendChild(style);
  }

  applyAppTheme(appTheme);
  addStyle();
  document.addEventListener("DOMContentLoaded", () => {
    applyAppTheme(appTheme);
    addStyle();
  });

  function configureLessonNav() {
    for (const logo of document.querySelectorAll(HOME_LOGO)) {
      const link = logo.closest("a");
      if (!link) continue;
      const nav = logo.closest("div.nav") || link?.parentElement;
      if (!isFullscreenView) {
        nav?.remove();
        continue;
      }

      // The promoted window has no app chrome. Turn Academy's home link into a
      // return-to-app control so it cannot strand the user on another route.
      link.removeAttribute("href");
      link.dataset.ztmFullscreenExit = "true";
      link.setAttribute("role", "button");
      link.setAttribute("title", "Return to ZTM Desktop");
    }

    if (isFullscreenView) {
      for (const link of document.querySelectorAll(COURSE_BACK)) {
        link.removeAttribute("href");
        link.dataset.ztmFullscreenExit = "true";
        link.setAttribute("title", "Return to ZTM Desktop");
      }
    }
  }
  function syncDocument() {
    applyAppTheme(appTheme);
    configureLessonNav();
    scheduleCoursePalette();
  }
  syncDocument();
  const navObserver = new MutationObserver(syncDocument);
  // Initialization scripts run before <html> exists. Observing Document keeps
  // this active from document-start and catches both initial markup and SPA swaps.
  navObserver.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });

  const SESSION_KEY = "ztm-desktop-app-session";
  function captureSession() {
    const media = document.querySelector("video, audio");
    return {
      url: location.href,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      mediaTime: media?.currentTime ?? null,
      mediaPaused: media?.paused ?? null,
      playbackRate: media?.playbackRate ?? null,
    };
  }

  function exitFullscreen() {
    return window.__TAURI_INTERNALS__?.invoke("web_view_fullscreen", {
      fullscreen: false,
      session: captureSession(),
    });
  }

  // Capture before Academy's delegated click handler. In the promoted window,
  // the logo is an exit control; elsewhere this prevents a pre-removal click.
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a");
      if (!link) return;
      const isLogoHome =
        Boolean(link.querySelector?.(HOME_LOGO)) &&
        Boolean(link.closest?.("div.nav"));
      const isCourseBack = Boolean(link.matches?.(COURSE_BACK));
      if (!isLogoHome && !(isFullscreenView && isCourseBack)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isFullscreenView) exitFullscreen()?.catch(() => {});
    },
    true,
  );

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(captureSession()));
    } catch {}
  }

  function savedSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      return saved?.url === location.href ? saved : null;
    } catch {
      return null;
    }
  }

  const restore = window.__ZTM_DESKTOP_RESTORE__ || savedSession();
  function restoreSession() {
    if (!restore || restore.url !== location.href) return;
    window.scrollTo(restore.scrollX || 0, restore.scrollY || 0);
    const media = document.querySelector("video, audio");
    if (!media || restore.mediaTime == null) return;
    media.currentTime = restore.mediaTime;
    if (restore.playbackRate != null) media.playbackRate = restore.playbackRate;
    if (restore.mediaPaused === false) media.play().catch(() => {});
  }
  document.addEventListener("DOMContentLoaded", () => {
    restoreSession();
    const media = document.querySelector("video, audio");
    media?.addEventListener("timeupdate", saveSession);
    media?.addEventListener("ratechange", saveSession);
    media?.addEventListener("play", saveSession);
    media?.addEventListener("pause", saveSession);
  });
  document.addEventListener("scroll", saveSession, { passive: true });
  window.addEventListener("load", restoreSession);
  window.addEventListener("pagehide", saveSession);

  if (window.__ZTM_DESKTOP_VIEW__ === "fullscreen") {
    // The resize watcher normally handles Escape. This is an additional disposal
    // path for platforms that do not emit a resize when leaving OS fullscreen.
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        exitFullscreen()?.catch(() => {});
      }
    });
  }

  // Observe the top-level document instead of replacing requestFullscreen. Video
  // players commonly request fullscreen from a nested iframe; in that case the
  // top-level fullscreen element is the iframe and this event still fires.
  let fullscreen = false;
  function reportFullscreen(next) {
    if (next === fullscreen) return;
    fullscreen = next;
    const ipc = window.__TAURI_INTERNALS__;
    if (!ipc) return;
    ipc
      .invoke("web_view_fullscreen", {
        fullscreen: next,
        session: captureSession(),
      })
      .catch((error) => console.error("web_view_fullscreen failed", error));
  }
  const onChange = () =>
    reportFullscreen(
      Boolean(document.fullscreenElement || document.webkitFullscreenElement),
    );
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  window.addEventListener("pagehide", () => reportFullscreen(false));
})();
