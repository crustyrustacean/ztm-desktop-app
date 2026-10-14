import CourseGrid from "@/components/CourseGrid";
import { matchesFilter, type Course } from "@/lib/course";
import "./Dashboard.css";

type FavouritesProps = {
  filter: string;
  courses: Course[];
  favourites: ReadonlySet<string>;
  onToggleFavourite: (uuid: string) => void;
};

function Favourites({
  filter,
  courses,
  favourites,
  onToggleFavourite,
}: FavouritesProps) {
  const favouriteCourses = courses.filter((course) =>
    favourites.has(course.uuid),
  );
  const visibleCourses = favouriteCourses.filter((course) =>
    matchesFilter(course, filter),
  );

  return (
    <main className="dashboard">
      <h1 id="favourites-heading">Favourites</h1>
      {favouriteCourses.length === 0 && (
        <p className="mt-4 text-muted-foreground">
          No favourites yet. Star a course on the Dashboard to add it here.
        </p>
      )}
      {favouriteCourses.length > 0 && visibleCourses.length === 0 && (
        <p className="mt-4 text-muted-foreground [overflow-wrap:anywhere]">
          No courses match "{filter.trim()}".
        </p>
      )}
      {visibleCourses.length > 0 && (
        <CourseGrid
          courses={visibleCourses}
          favourites={favourites}
          onToggleFavourite={onToggleFavourite}
          labelledBy="favourites-heading"
        />
      )}
    </main>
  );
}

export default Favourites;
