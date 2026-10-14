import { invoke, isTauri } from "@tauri-apps/api/core";

export type Theme = "light" | "dark";

type AppState = {
  theme?: Theme | null;
};

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Theme saved in state.json, otherwise the OS colour scheme. */
export async function loadTheme(): Promise<Theme> {
  if (!isTauri()) return systemTheme();
  try {
    const state = await invoke<AppState>("load_state");
    return state.theme ?? systemTheme();
  } catch (error) {
    console.error("Could not load app state", error);
    return systemTheme();
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Merges the theme into state.json so other saved fields are kept. */
export async function saveTheme(theme: Theme) {
  if (!isTauri()) return;
  const state = await invoke<AppState>("load_state");
  await invoke("save_state", { state: { ...state, theme } });
}
