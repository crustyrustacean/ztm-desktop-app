import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/** Toggles the app window's fullscreen with F11, as browsers do. */
export function useFullscreenShortcut(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F11") return;
      event.preventDefault();
      if (event.repeat) return;
      invoke("toggle_fullscreen").catch((error) =>
        console.error("toggle_fullscreen failed", error),
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
