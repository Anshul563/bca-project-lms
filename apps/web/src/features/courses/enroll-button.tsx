"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch, tryApi } from "@/lib/api-client";
import type { PublicEnrollment } from "@lms/shared";

interface EnrollButtonProps {
  courseId: string;
  courseSlug: string;
  price: number;
}

export function EnrollButton({ courseId, courseSlug, price }: EnrollButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Enrollment status decides whether we show "Enroll" or "Go to course".
  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", "check", courseId],
    queryFn: () => apiFetch<PublicEnrollment[]>("/enrollments/my"),
    retry: false,
  });

  const enrollMutation = useMutation({
    mutationFn: () => tryApi<PublicEnrollment>("/enrollments", { method: "POST", body: { courseId } }),
  });

  const alreadyEnrolled = (enrollmentsQuery.data ?? []).some(
    (entry) => entry.course?.id === courseId && entry.status !== "cancelled",
  );

  async function onEnroll() {
    const result = await enrollMutation.mutateAsync();
    if (!result.ok) {
      if (result.error.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`);
        return;
      }
      if (result.error.code === "ALREADY_ENROLLED") {
        router.push("/student");
        return;
      }
      toast.error(result.error.message);
      return;
    }
    toast.success("You're enrolled! Start learning now.");
    await queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    router.push("/student");
  }

  if (alreadyEnrolled) {
    return (
      <Button className="w-full" onClick={() => router.push("/student")}>
        Go to my learning
      </Button>
    );
  }

  return (
    <Button className="w-full" disabled={enrollMutation.isPending} onClick={() => void onEnroll()}>
      {enrollMutation.isPending ? "Enrolling…" : price === 0 ? "Enroll for free" : `Enroll now · $${price.toFixed(2)}`}
    </Button>
  );
}
