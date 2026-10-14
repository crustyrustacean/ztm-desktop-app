export type Course = {
  uuid: string;
  name: string;
};

export function matchesFilter(course: Course, filter: string) {
  return course.name.toLowerCase().includes(filter.toLowerCase());
}
