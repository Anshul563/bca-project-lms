import { AuthGuard } from "@/components/auth/auth-guard";
import { CourseEditor } from "@/features/instructor/course-editor";

// The route id is request data, so this page opts out of instant prerendering
// (cacheComponents). The editor itself is a client component.
export const instant = false;

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AuthGuard allow={["instructor", "admin"]}>
      <CourseEditor courseId={id} />
    </AuthGuard>
  );
}
