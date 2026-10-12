import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import CourseCard from "@/components/CourseCard";
import { type Course, courseImageSrc } from "@/lib/courses";
import "./Dashboard.css";

/** Milliseconds until the next Monday 07:00 UTC, when Rust next treats a sync as due. */
function msUntilNextSync(now = Date.now()) {
  const next = new Date(now);
  next.setUTCHours(7, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7));
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next.getTime() - now;
}

type SyncError = "desktop-only" | "sync-failed";

// Chosen at render time so the message matches whether a list is actually shown.
function errorMessage(error: SyncError, hasCourses: boolean) {
  if (error === "desktop-only") {
    return "Course loading requires the desktop app. Run npm run tauri dev and use the desktop window, not the browser preview.";
  }
  return hasCourses
    ? "Could not update courses. Showing the saved local list."
    : "Could not load courses. Check your internet connection and try again.";
}

type DashboardProps = {
  filter: string;
};

function Dashboard({ filter }: DashboardProps) {
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

  const visibleCourses = courses.filter((course) => course.name.toLowerCase().includes(filter.toLowerCase()));

  return (

    <main className="dashboard">
      <h1>Dashboard</h1>
      <h2 id="courses-heading">Courses</h2>
      {syncing && (
        <p role="status">
          {courses.length ? "Checking for course updates..." : "Loading courses..."}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{errorMessage(error, courses.length > 0)}</p>
          {error === "sync-failed" && !syncing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void syncCourses(true)}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      {courses.length > 0 && visibleCourses.length === 0 && (
        <p className="course-empty">No courses match "{filter.trim()}".</p>
      )}
      {visibleCourses.length > 0 && (
        <ul className="course-grid" aria-labelledby="courses-heading">
          {visibleCourses.map((course, index) => (
            <li key={`${index}-${course.name}`}>
              <CourseCard name={course.name} imageSrc={courseImageSrc(course)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default Dashboard;
