import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Whether UI animations play, persisted to state.json. Defaults to true. */
export function useAnimations() {
  const [animations, setAnimationsState] = useState(true);
  // Toggling before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setAnimationsState(state.animations ?? true);
      })
      .catch((error) =>
        console.error("Could not load animations setting", error),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const setAnimations = useCallback((next: boolean) => {
    touched.current = true;
    setAnimationsState(next);
    updateState({ animations: next }).catch((error) =>
      console.error("Could not save animations setting", error),
    );
  }, []);

  return { animations, setAnimations };
}
