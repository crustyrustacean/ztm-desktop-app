export type Course = {
  uuid: string;
  name: string;
  imageUrl: string | null;
};

export function matchesFilter(course: Course, filter: string) {
  return course.name.toLowerCase().includes(filter.toLowerCase());
}
