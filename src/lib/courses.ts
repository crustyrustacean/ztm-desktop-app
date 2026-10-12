import { convertFileSrc } from "@tauri-apps/api/core";

/** A course as returned by the Rust `load_courses` / `sync_courses` commands. */
export type Course = {
  name: string;
  imageId: string | null;
};

/** URL for a course's artwork, served (and cached on first use) by Rust's `course-image` protocol. */
export function courseImageSrc(course: Course) {
  return course.imageId ? convertFileSrc(course.imageId, "course-image") : undefined;
}
