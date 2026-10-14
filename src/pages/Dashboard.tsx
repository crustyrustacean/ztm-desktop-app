import { Button } from "@/components/ui/button";
import CourseGrid from "@/components/CourseGrid";
import type { SyncError } from "@/hooks/use-courses";
import { matchesFilter, type Course } from "@/lib/course";
import "./Dashboard.css";

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
  courses: Course[];
  syncing: boolean;
  error: SyncError | null;
  onRetry: () => void;
  favourites: ReadonlySet<string>;
  onToggleFavourite: (uuid: string) => void;
};

function Dashboard({
  filter,
  courses,
  syncing,
  error,
  onRetry,
  favourites,
  onToggleFavourite,
}: DashboardProps) {
  const visibleCourses = courses.filter((course) =>
    matchesFilter(course, filter),
  );

  return (
    <main className="dashboard">
      <h1>Dashboard</h1>
      <h2 id="courses-heading">Courses</h2>
      {syncing && (
        <p role="status">
          {courses.length
            ? "Checking for course updates..."
            : "Loading courses..."}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{errorMessage(error, courses.length > 0)}</p>
          {error === "sync-failed" && !syncing && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}
      {courses.length > 0 && visibleCourses.length === 0 && (
        <p className="mt-4 text-muted-foreground [overflow-wrap:anywhere]">
          No courses match "{filter.trim()}".
        </p>
      )}
      {visibleCourses.length > 0 && (
        <CourseGrid
          courses={visibleCourses}
          favourites={favourites}
          onToggleFavourite={onToggleFavourite}
          labelledBy="courses-heading"
        />
      )}
    </main>
  );
}

export default Dashboard;
