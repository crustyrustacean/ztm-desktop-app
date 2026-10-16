import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const initScript = readFileSync(
  new URL("../src-tauri/src/academy_init.js", import.meta.url),
  "utf8",
);
const defaultCapability = JSON.parse(
  readFileSync(
    new URL("../src-tauri/capabilities/default.json", import.meta.url),
    "utf8",
  ),
);

test("the app shell is permitted to dispose its native child webview", () => {
  assert.ok(defaultCapability.permissions.includes("allow-dispose-web-view"));
  assert.ok(!defaultCapability.permissions.includes("allow-hide-web-view"));
});

function runAcademyScript(
  view = "embedded",
  restore = null,
  lessonLogos = [],
  documentReady = true,
  courseBackLinks = [],
  theme = "dark",
  siteNavigation = [],
  storageEntries = [],
  mediaElements = [],
) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const styles = new Map();
  const invokes = [];
  const storage = new Map(storageEntries);
  const sessionStorage = new Map();
  const scrollCalls = [];
  const document = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    documentElement: documentReady
      ? {
          appendChild: (element) => styles.set(element.id, element),
          classList: { contains: () => false, toggle() {} },
          dataset: {},
          style: {},
        }
      : null,
    head: documentReady
      ? { appendChild: (element) => styles.set(element.id, element) }
      : null,
    getElementById: (id) => styles.get(id) ?? null,
    createElement: () => ({ id: "", textContent: "" }),
    querySelector: (selector) =>
      selector === "video, audio" ? (mediaElements[0] ?? null) : null,
    querySelectorAll: (selector) => {
      if (selector === ".ztm-sidebar, .ztm-sidebar-links") {
        return siteNavigation;
      }
      if (selector === "video, audio") return mediaElements;
      if (selector === "iframe") return [];
      return selector.startsWith("img[") ? lessonLogos : courseBackLinks;
    },
    addEventListener: (name, listener) => documentListeners.set(name, listener),
  };
  const window = {
    __ZTM_DESKTOP_VIEW__: view,
    __ZTM_DESKTOP_RESTORE__: restore,
    __ZTM_DESKTOP_THEME__: theme,
    __TAURI_INTERNALS__: {
      invoke: (command, args) => {
        invokes.push({ command, args });
        return Promise.resolve();
      },
    },
    sessionStorage: {
      getItem: (key) => sessionStorage.get(key) ?? null,
      setItem: (key, value) => sessionStorage.set(key, value),
    },
    scrollX: 12,
    scrollY: 34,
    scrollTo: (x, y) => scrollCalls.push({ x, y }),
    addEventListener: (name, listener) => windowListeners.set(name, listener),
  };
  window.top = window;
  const location = {
    hostname: "academy.zerotomastery.io",
    href: "https://academy.zerotomastery.io/courses/enrolled/697434",
    pathname: "/courses/enrolled/697434",
    replace(url) {
      this.href = url;
      this.pathname = new URL(url).pathname;
    },
  };

  vm.runInNewContext(initScript, {
    Boolean,
    console,
    document,
    location,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {}
    },
    URL,
    window,
  });

  return {
    document,
    documentListeners,
    invokes,
    location,
    scrollCalls,
    storage,
    styles,
    window,
    windowListeners,
  };
}

test("initialization survives running before the document element exists", () => {
  const runtime = runAcademyScript("fullscreen", null, [], false);

  assert.equal(runtime.styles.size, 0);
  assert.equal(typeof runtime.documentListeners.get("DOMContentLoaded"), "function");
});

test("embedded fullscreen invokes the native promotion command once per transition", () => {
  const runtime = runAcademyScript();
  runtime.document.fullscreenElement = {};

  runtime.documentListeners.get("fullscreenchange")();
  runtime.documentListeners.get("fullscreenchange")();

  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokes)), [
    {
      command: "web_view_fullscreen",
      args: {
        fullscreen: true,
        session: {
          url: "https://academy.zerotomastery.io/courses/enrolled/697434",
          scrollX: 12,
          scrollY: 34,
          mediaTime: null,
          mediaPaused: null,
          playbackRate: null,
        },
      },
    },
  ]);
});

test("embedded Academy CSS only controls the app-selected palette", () => {
  const runtime = runAcademyScript();
  const style = runtime.styles.get("ztm-desktop-app-style");

  assert.match(style.textContent, /color-scheme: dark !important/);
  assert.match(style.textContent, /data-ztm-dark-surface/);
  assert.doesNotMatch(style.textContent, /display:\s*none/);
  assert.doesNotMatch(style.textContent, /ztm-sidebar/);
  assert.equal(runtime.styles.size, 1);
});

test("fullscreen Academy CSS leaves navigation removal to the DOM observer", () => {
  const runtime = runAcademyScript("fullscreen");
  const style = runtime.styles.get("ztm-desktop-app-style");

  assert.match(style.textContent, /color-scheme: dark !important/);
  assert.doesNotMatch(style.textContent, /display:\s*none/);
});

test("Academy course navigation is structurally removed", () => {
  let removals = 0;
  const navigation = {
    closest: () => null,
    remove: () => (removals += 1),
  };

  runAcademyScript("embedded", null, [], true, [], "dark", [navigation]);

  assert.equal(removals, 1);
});

test("the Academy document uses the app-selected theme", () => {
  const runtime = runAcademyScript("fullscreen", null, [], true, [], "light");

  assert.equal(runtime.document.documentElement.dataset.theme, "light");
  assert.equal(runtime.document.documentElement.style.colorScheme, "light");
  assert.match(
    runtime.styles.get("ztm-desktop-app-style").textContent,
    /color-scheme: light !important/,
  );
});

test("a live theme change is retained for the webview reset reload", () => {
  const runtime = runAcademyScript("fullscreen", null, [], true, [], "dark");

  runtime.window.__ZTM_DESKTOP_SET_THEME__("light");

  assert.equal(
    runtime.window.sessionStorage.getItem("ztm-desktop-app-theme"),
    "light",
  );
});

test("course overview detection supports every enrolled course identifier", () => {
  assert.match(
    initScript,
    /courses\\\/\(\?:enrolled\\\/\)\?\[\^\/\]\+/,
    "the dark overview palette must cover /courses/enrolled/{id}",
  );
});

test("palette normalization includes the Academy dashboard and categories", () => {
  assert.match(initScript, /location\.pathname === "\/"/);
  assert.match(initScript, /courses\\\/category/);
  assert.match(initScript, /ztmLightSurface/);
  assert.match(initScript, /ztm-light-palette/);
});

test("theme initialization includes Teachable authentication pages", () => {
  assert.match(initScript, /sso\.teachable\.com/);
  assert.match(initScript, /sign_in\|login\|identity/);
});

test("the Academy lesson header cannot navigate home before it is hidden", () => {
  const runtime = runAcademyScript();
  let prevented = false;
  let stopped = false;
  const nav = {};
  const link = {
    closest: (selector) => (selector === "div.nav" ? nav : null),
    querySelector: () => ({}),
  };

  runtime.documentListeners.get("click")({
    target: { closest: () => link },
    preventDefault: () => (prevented = true),
    stopImmediatePropagation: () => (stopped = true),
  });

  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test("the fullscreen Academy logo returns to the embedded app with its session", () => {
  const runtime = runAcademyScript("fullscreen");
  const nav = {};
  const link = {
    closest: (selector) => (selector === "div.nav" ? nav : null),
    querySelector: () => ({}),
  };

  runtime.documentListeners.get("click")({
    target: { closest: () => link },
    preventDefault() {},
    stopImmediatePropagation() {},
  });

  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokes)), [
    {
      command: "web_view_fullscreen",
      args: {
        fullscreen: false,
        session: {
          url: "https://academy.zerotomastery.io/courses/enrolled/697434",
          scrollX: 12,
          scrollY: 34,
          mediaTime: null,
          mediaPaused: null,
          playbackRate: null,
        },
      },
    },
  ]);
});

test("the Academy lesson header is structurally removed", () => {
  let removed = false;
  const nav = { remove: () => (removed = true) };
  const link = { parentElement: nav };
  const logo = {
    closest: (selector) => (selector === "div.nav" ? nav : link),
  };

  runAcademyScript("embedded", null, [logo]);

  assert.equal(removed, true);
});

test("the fullscreen Academy home link is converted into an exit control", () => {
  const attributes = new Map([["href", "/"]]);
  const nav = {};
  const link = {
    dataset: {},
    closest: (selector) => (selector === "div.nav" ? nav : null),
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const logo = {
    closest: (selector) => (selector === "a" ? link : nav),
  };

  runAcademyScript("fullscreen", null, [logo]);

  assert.equal(attributes.has("href"), false);
  assert.equal(link.dataset.ztmFullscreenExit, "true");
  assert.equal(attributes.get("role"), "button");
  assert.equal(attributes.get("title"), "Return to ZTM Desktop");
});

test("the fullscreen curriculum link is converted into an exit control", () => {
  const attributes = new Map([["href", "/courses/697434"]]);
  const link = {
    dataset: {},
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name, value) => attributes.set(name, value),
  };

  runAcademyScript("fullscreen", null, [], true, [link]);

  assert.equal(attributes.has("href"), false);
  assert.equal(link.dataset.ztmFullscreenExit, "true");
  assert.equal(attributes.get("title"), "Return to ZTM Desktop");
});

test("Escape from the promoted window requests its disposal", () => {
  const runtime = runAcademyScript("fullscreen");

  runtime.windowListeners.get("keydown")({ key: "Escape" });

  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokes)), [
    {
      command: "web_view_fullscreen",
      args: {
        fullscreen: false,
        session: {
          url: "https://academy.zerotomastery.io/courses/enrolled/697434",
          scrollX: 12,
          scrollY: 34,
          mediaTime: null,
          mediaPaused: null,
          playbackRate: null,
        },
      },
    },
  ]);
});

test("native fullscreen exit captures playback before disposing its window", () => {
  const media = {
    currentTime: 187.25,
    paused: false,
    playbackRate: 1.5,
    readyState: 1,
    addEventListener() {},
  };
  const runtime = runAcademyScript(
    "fullscreen",
    null,
    [],
    true,
    [],
    "dark",
    [],
    [],
    [media],
  );

  runtime.window.__ZTM_DESKTOP_EXIT_FULLSCREEN__();

  assert.deepEqual(JSON.parse(JSON.stringify(runtime.invokes)), [
    {
      command: "web_view_fullscreen",
      args: {
        fullscreen: false,
        session: {
          url: "https://academy.zerotomastery.io/courses/enrolled/697434",
          scrollX: 12,
          scrollY: 34,
          mediaTime: 187.25,
          mediaPaused: false,
          playbackRate: 1.5,
        },
      },
    },
  ]);
});

test("a transferred session restores the page position", () => {
  const restore = {
    url: "https://academy.zerotomastery.io/courses/enrolled/697434",
    scrollX: 45,
    scrollY: 900,
    mediaTime: null,
    mediaPaused: null,
    playbackRate: null,
  };
  const runtime = runAcademyScript("embedded", restore);

  runtime.documentListeners.get("DOMContentLoaded")();

  assert.deepEqual(runtime.scrollCalls, [{ x: 45, y: 900 }]);
});

test("a URL-only fullscreen fallback retains the durable playback checkpoint", () => {
  const url = "https://academy.zerotomastery.io/courses/enrolled/697434";
  const saved = {
    url,
    scrollX: 45,
    scrollY: 900,
    mediaTime: 142.75,
    mediaPaused: true,
    playbackRate: 1.5,
  };
  const fallback = {
    url,
    scrollX: 0,
    scrollY: 0,
    mediaTime: null,
    mediaPaused: null,
    playbackRate: null,
  };
  const mediaListeners = new Map();
  const media = {
    currentTime: 0,
    paused: true,
    playbackRate: 1,
    readyState: 1,
    addEventListener: (name, listener) => mediaListeners.set(name, listener),
    pause() {},
    play: () => Promise.resolve(),
  };
  const progress = JSON.stringify({ "course:697434": saved });
  const runtime = runAcademyScript(
    "embedded",
    fallback,
    [],
    true,
    [],
    "dark",
    [],
    [["ztm-desktop-course-progress-v2", progress]],
    [media],
  );

  runtime.documentListeners.get("DOMContentLoaded")();

  assert.equal(media.currentTime, 142.75);
  assert.equal(media.playbackRate, 1.5);
});

test("native Academy webviews initialize the progress relay in every frame", () => {
  const rust = readFileSync(
    new URL("../src-tauri/src/web_view.rs", import.meta.url),
    "utf8",
  );

  assert.equal(
    rust.match(/initialization_script_for_all_frames/g)?.length,
    3,
  );
});
