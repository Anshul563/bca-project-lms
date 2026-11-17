"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { CourseProgress, PublicCourseDetail } from "@lms/shared";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import type { Route } from "next";

/**
 * Entry point for "continue learning": resolves the first incomplete lesson
 * (or the resume point recorded by the API) and redirects there.
 */
export function LearnRedirector({ slug }: { slug: string }) {
  const router = useRouter();
  const { isPending: sessionPending } = useSession();
  const navigatedRef = useRef(false);

  const detailQuery = useQuery({
    queryKey: ["course", slug],
    queryFn: () => apiFetch<PublicCourseDetail>(`/courses/${slug}`),
    retry: false,
  });

  const progressQuery = useQuery({
    queryKey: ["progress", detailQuery.data?.id],
    queryFn: () => apiFetch<CourseProgress>(`/progress/courses/${detailQuery.data!.id}`),
    enabled: detailQuery.data !== undefined,
    retry: false,
  });

  useEffect(() => {
    if (navigatedRef.current) {
      return;
    }

    // Anonymous visitors or not-yet-enrolled learners go to the course page.
    if (detailQuery.data && progressQuery.isError) {
      navigatedRef.current = true;
      router.replace(`/courses/${slug}` as Route);
      return;
    }

    const detail = detailQuery.data;
    const progress = progressQuery.data;
    if (!detail || progress === undefined) {
      return;
    }

    const flat = detail.sections.flatMap((section) => section.lessons);
    if (flat.length === 0 || sessionPending) {
      return;
    }

    const firstIncomplete = flat.find((lesson) => !progress.completedLessonIds.includes(lesson.id)) ?? flat[0]!;
    const resumeLesson = progress.lastLessonId
      ? (flat.find((lesson) => lesson.id === progress.lastLessonId) ?? firstIncomplete)
      : firstIncomplete;

    navigatedRef.current = true;
    router.replace(`/courses/${slug}/learn/${resumeLesson.id}` as Route);
  }, [detailQuery.data, progressQuery.data, progressQuery.isError, progressQuery.isPending, sessionPending, router, slug]);

  return (
    <div className="grid place-items-center py-24" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">Resuming your course…</p>
    </div>
  );
}
