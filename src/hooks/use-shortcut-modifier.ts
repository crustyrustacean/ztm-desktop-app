import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";
import {
  DEFAULT_SHORTCUT_MODIFIER,
  type ShortcutModifier,
} from "@/lib/shortcuts";

/** Key held for keyboard shortcuts, persisted to state.json. Defaults to Alt. */
export function useShortcutModifier() {
  const [shortcutModifier, setShortcutModifierState] =
    useState<ShortcutModifier>(DEFAULT_SHORTCUT_MODIFIER);
  // Changing it before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setShortcutModifierState(
          state.shortcutModifier ?? DEFAULT_SHORTCUT_MODIFIER,
        );
      })
      .catch((error) => console.error("Could not load shortcut key", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setShortcutModifier = useCallback((next: ShortcutModifier) => {
    touched.current = true;
    setShortcutModifierState(next);
    updateState({ shortcutModifier: next }).catch((error) =>
      console.error("Could not save shortcut key", error),
    );
  }, []);

  return { shortcutModifier, setShortcutModifier };
}
