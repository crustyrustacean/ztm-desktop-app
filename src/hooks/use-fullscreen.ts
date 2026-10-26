import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SHELL_FULLSCREEN_EVENT } from "@/lib/web-view-events";

/**
 * Whether the app window is fullscreen, and a toggle bound to F11 as in browsers.
 * Rust owns the state, since F11 can also arrive from the embedded Academy page.
 */
export function useFullscreen(enabled: boolean) {
  const [fullscreen, setFullscreen] = useState(false);
  // A change event arriving before the initial read must not be overwritten by it.
  const changed = useRef(false);

  const toggleFullscreen = useCallback(() => {
    invoke("toggle_fullscreen").catch((error) =>
      console.error("toggle_fullscreen failed", error),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const unlisten = listen<boolean>(SHELL_FULLSCREEN_EVENT, (event) => {
      changed.current = true;
      setFullscreen(event.payload);
    });
    invoke<boolean | null>("shell_fullscreen")
      .then((value) => {
        if (!cancelled && !changed.current) setFullscreen(value ?? false);
      })
      .catch((error) => console.error("shell_fullscreen failed", error));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F11") return;
      event.preventDefault();
      if (event.repeat) return;
      toggleFullscreen();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
      void unlisten.then((stop) => stop());
    };
  }, [enabled, toggleFullscreen]);

  return { fullscreen, toggleFullscreen };
}
