import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Uuid of the most recently opened course, persisted to state.json. */
export function useLastCourse() {
  const [lastCourse, setLastCourseState] = useState<string | null>(null);
  // Opening a course before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setLastCourseState(state.lastCourse ?? null);
      })
      .catch((error) => console.error("Could not load last course", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const setLastCourse = useCallback((uuid: string) => {
    touched.current = true;
    setLastCourseState(uuid);
    updateState({ lastCourse: uuid }).catch((error) =>
      console.error("Could not save last course", error),
    );
  }, []);

  return { lastCourse, setLastCourse };
}
