import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Whether the app opens fullscreen, persisted to state.json. Defaults to false. */
export function useStartFullscreen() {
  const [startFullscreen, setStartFullscreenState] = useState(false);
  // Toggling before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setStartFullscreenState(state.startFullscreen ?? false);
      })
      .catch((error) =>
        console.error("Could not load start fullscreen setting", error),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const setStartFullscreen = useCallback((next: boolean) => {
    touched.current = true;
    setStartFullscreenState(next);
    updateState({ startFullscreen: next }).catch((error) =>
      console.error("Could not save start fullscreen setting", error),
    );
  }, []);

  return { startFullscreen, setStartFullscreen };
}
