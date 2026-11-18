"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { CourseCreateForm } from "@/features/instructor/course-create-form";

export default function NewCoursePage() {
  return (
    <AuthGuard allow={["instructor", "admin"]}>
      <CourseCreateForm />
    </AuthGuard>
  );
}
