import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";
import type { CourseOpenMode } from "@/lib/course";

/** Where courses open, persisted to state.json. Defaults to the embedded Web View. */
export function useCourseOpenMode() {
  const [courseOpenMode, setCourseOpenModeState] =
    useState<CourseOpenMode>("embedded");
  // Changing the setting before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setCourseOpenModeState(state.courseOpenMode ?? "embedded");
      })
      .catch((error) =>
        console.error("Could not load course open mode", error),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const setCourseOpenMode = useCallback((next: CourseOpenMode) => {
    touched.current = true;
    setCourseOpenModeState(next);
    updateState({ courseOpenMode: next }).catch((error) =>
      console.error("Could not save course open mode", error),
    );
  }, []);

  return { courseOpenMode, setCourseOpenMode };
}
