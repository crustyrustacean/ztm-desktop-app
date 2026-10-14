import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Course } from "@/lib/course";

/** Milliseconds until the next Monday 07:00 UTC, when Rust next treats a sync as due. */
function msUntilNextSync(now = Date.now()) {
  const next = new Date(now);
  next.setUTCHours(7, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7));
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next.getTime() - now;
}

export type SyncError = "desktop-only" | "sync-failed";

/** Loads the cached academy courses, then keeps them in sync with upstream weekly. */
export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState<SyncError | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const syncCourses = useCallback(async (force: boolean) => {
    setSyncing(true);
    try {
      // Rust skips the check unless one is due (or forced); null means unchanged.
      const updatedCourses = await invoke<Course[] | null>("sync_courses", {
        force,
      });
      if (!mounted.current) return;
      if (updatedCourses) setCourses(updatedCourses);
      setError(null);
    } catch (cause) {
      console.error("Could not synchronize academy courses:", cause);
      if (!mounted.current) return;
      setError("sync-failed");
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleWeeklySync() {
      timer = setTimeout(async () => {
        await syncCourses(false);
        if (!cancelled) scheduleWeeklySync();
      }, msUntilNextSync());
    }

    async function loadCourses() {
      if (!isTauri()) {
        setError("desktop-only");
        setSyncing(false);
        return;
      }

      try {
        const cachedCourses = await invoke<Course[] | null>("load_courses");
        if (!cancelled && cachedCourses) {
          setCourses(cachedCourses);
        }
      } catch (cause) {
        console.error("Could not load academy cache:", cause);
      }

      if (cancelled) return;
      await syncCourses(false);
      if (!cancelled) scheduleWeeklySync();
    }

    void loadCourses();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [syncCourses]);

  const retry = useCallback(() => void syncCourses(true), [syncCourses]);

  return { courses, syncing, error, retry };
}
