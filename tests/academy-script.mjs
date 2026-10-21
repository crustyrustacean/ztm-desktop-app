import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const initScriptTemplate = readFileSync(
  new URL("../src-tauri/src/academy_init.js", import.meta.url),
  "utf8",
);
const webViewSource = readFileSync(
  new URL("../src-tauri/src/web_view.rs", import.meta.url),
  "utf8",
);
const authRoutesSource = webViewSource.match(
  /const AUTHENTICATION_ROUTES:[^=]+=(.+);/,
)?.[1];
export const themeStorageKey = webViewSource.match(
  /const THEME_STORAGE_KEY: &str = "([^"]+)";/,
)?.[1];
assert.ok(authRoutesSource);
assert.ok(themeStorageKey);
const authRoutes = [...authRoutesSource.matchAll(/"([^"]+)"/g)].map(
  (match) => match[1],
);

export const academyInitScript = initScriptTemplate
  .replace("__ZTM_AUTH_ROUTES__", JSON.stringify(authRoutes))
  .replace("__ZTM_THEME_STORAGE_KEY__", JSON.stringify(themeStorageKey));
