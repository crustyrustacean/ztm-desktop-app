import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CourseGrid from "@/components/CourseGrid";
import type { SyncError } from "@/hooks/use-courses";
import { matchesFilter, type Course } from "@/lib/course";

// Chosen at render time so the message matches whether a list is actually shown.
function errorMessage(error: SyncError, hasCourses: boolean) {
  if (error === "desktop-only") {
    return "Course loading requires the desktop app. Run npm run tauri dev and use the desktop window, not the browser preview.";
  }
  return hasCourses
    ? "Could not update courses. Showing the saved local list."
    : "Could not load courses. Check your internet connection and try again.";
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

type DashboardProps = {
  name: string;
  academyMember: boolean;
  filter: string;
  courses: Course[];
  syncing: boolean;
  error: SyncError | null;
  onRetry: () => void;
  favourites: ReadonlySet<string>;
  onToggleFavourite: (uuid: string) => void;
};

function Dashboard({
  name,
  academyMember,
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
  const trimmedName = name.trim();

  // The Dashboard stays mounted while hidden, so refresh the greeting as the day moves on.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="p-6">
      <div className="mb-2 flex items-center gap-4">
        {trimmedName && (
          <p className="min-w-0 text-[2.5rem] leading-[1.2] font-bold [overflow-wrap:anywhere]">
            {greeting(now)}, {trimmedName}
          </p>
        )}
        <Badge variant={academyMember ? "default" : "secondary"}>
          {academyMember ? "Academy" : "Public"}
        </Badge>
      </div>
      <h1 className="text-[1.75rem] font-semibold">Dashboard</h1>
      <h2 id="courses-heading" className="mt-4 text-[1.25rem] font-semibold">
        Courses
      </h2>
      {syncing && (
        <p role="status" className="mt-4">
          {courses.length
            ? "Checking for course updates..."
            : "Loading courses..."}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-4 flex flex-col items-start gap-2">
          <p className="text-destructive [overflow-wrap:anywhere]">
            {errorMessage(error, courses.length > 0)}
          </p>
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
