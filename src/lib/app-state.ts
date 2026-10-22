import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CourseOpenMode } from "@/lib/course";
import type { ShortcutModifier } from "@/lib/shortcuts";
import type { Theme } from "@/lib/theme";

/** Mirrors `AppState` in src-tauri/src/app_state.rs. */
export type AppState = {
  theme?: Theme | null;
  favourites?: string[];
  name?: string | null;
  academyMember?: boolean | null;
  courseOpenMode?: CourseOpenMode | null;
  shortcutModifier?: ShortcutModifier | null;
  lastCourse?: string | null;
  animations?: boolean | null;
};

export async function loadState(): Promise<AppState> {
  if (!isTauri()) return {};
  return invoke<AppState>("load_state");
}

let pending: Promise<unknown> = Promise.resolve();

/**
 * Merges the patch into state.json so other saved fields are kept. Updates are queued
 * so overlapping read-modify-write cycles can't overwrite each other.
 */
export function updateState(patch: Partial<AppState>): Promise<void> {
  const update = pending.then(async () => {
    if (!isTauri()) return;
    const state = await loadState();
    await invoke("save_state", { state: { ...state, ...patch } });
  });
  pending = update.catch(() => {});
  return update;
}
