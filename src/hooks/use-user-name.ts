import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Name used to greet the user, persisted to state.json. */
export function useUserName() {
  const [name, setNameState] = useState("");
  // Typing before the saved name loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setNameState(state.name ?? "");
      })
      .catch((error) => console.error("Could not load name", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setName = useCallback((next: string) => {
    touched.current = true;
    setNameState(next);
    updateState({ name: next.trim() || null }).catch((error) =>
      console.error("Could not save name", error),
    );
  }, []);

  return { name, setName };
}
