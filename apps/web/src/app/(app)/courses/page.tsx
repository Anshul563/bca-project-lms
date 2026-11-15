import type { Metadata } from "next";

import { CourseCatalog } from "@/features/courses/course-catalog";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse the full course catalog — filter by category, level and price.",
};

export default function CoursesPage() {
  return <CourseCatalog />;
}
