import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Whether the user is a ZTM Academy member, persisted to state.json. Defaults to true. */
export function useAcademyMember() {
  const [academyMember, setAcademyMemberState] = useState(true);
  // Toggling before the saved value loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        setAcademyMemberState(state.academyMember ?? true);
      })
      .catch((error) =>
        console.error("Could not load Academy membership", error),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const setAcademyMember = useCallback((next: boolean) => {
    touched.current = true;
    setAcademyMemberState(next);
    updateState({ academyMember: next }).catch((error) =>
      console.error("Could not save Academy membership", error),
    );
  }, []);

  return { academyMember, setAcademyMember };
}
