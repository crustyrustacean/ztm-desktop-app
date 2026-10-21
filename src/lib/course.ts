export type Course = {
  uuid: string;
  name: string;
  imageUrl: string | null;
  enrolledUrl: string | null;
  publicUrl: string | null;
};

/** Where a course opens: the app's Web View slot (default) or its own window. */
export type CourseOpenMode = "embedded" | "window";

export function matchesFilter(course: Course, filter: string) {
  return course.name.toLowerCase().includes(filter.toLowerCase());
}

/** The page to open for a course, preferring the one that fits the user's membership. */
export function courseUrl(course: Course, academyMember: boolean) {
  return academyMember
    ? (course.enrolledUrl ?? course.publicUrl)
    : (course.publicUrl ?? course.enrolledUrl);
}
