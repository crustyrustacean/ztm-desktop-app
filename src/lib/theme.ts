import { loadState, updateState } from "@/lib/app-state";

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

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveTheme(theme: Theme) {
  return updateState({ theme });
}
