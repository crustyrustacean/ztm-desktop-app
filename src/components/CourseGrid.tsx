import CourseCard from "@/components/CourseCard";
import type { Course } from "@/lib/course";

type CourseGridProps = {
  courses: Course[];
  favourites: ReadonlySet<string>;
  onToggleFavourite: (uuid: string) => void;
  /** Called with the course to open; courses without a page are not openable. */
  onOpenCourse: (course: Course) => void;
  canOpenCourse: (course: Course) => boolean;
  labelledBy: string;
};

function CourseGrid({
  courses,
  favourites,
  onToggleFavourite,
  onOpenCourse,
  canOpenCourse,
  labelledBy,
}: CourseGridProps) {
  return (
    <ul
      className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] list-none gap-4 p-0"
      aria-labelledby={labelledBy}
    >
      {courses.map((course) => (
        <li key={course.uuid}>
          <CourseCard
            name={course.name}
            imageUrl={course.imageUrl}
            favourite={favourites.has(course.uuid)}
            onToggleFavourite={() => onToggleFavourite(course.uuid)}
            onOpen={
              canOpenCourse(course) ? () => onOpenCourse(course) : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}

export default CourseGrid;
