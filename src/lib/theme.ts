import { loadState, updateState } from "@/lib/app-state";
import { invoke, isTauri } from "@tauri-apps/api/core";

export type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Theme saved in state.json, otherwise the OS colour scheme. */
export async function loadTheme(): Promise<Theme> {
  try {
    const state = await loadState();
    return state.theme ?? systemTheme();
  } catch (error) {
    console.error("Could not load app state", error);
    return systemTheme();
  }
}

export async function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  if (isTauri()) {
    await invoke("set_web_view_theme", { theme }).catch((error) =>
      console.error("Could not apply theme to Academy views", error),
    );
  }
}

export function saveTheme(theme: Theme) {
  return updateState({ theme });
}
