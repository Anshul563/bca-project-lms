"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Film, Link2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CourseProgress, PublicCourseDetail } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth";
import { apiFetch, tryApi } from "@/lib/api-client";
import type { Route } from "next";

interface LessonPlayerProps {
  slug: string;
  lessonId: string;
}

interface FlatLesson {
  id: string;
  title: string;
  isFreePreview: boolean;
  durationMinutes: number;
}

function useFlatLessons(detail?: PublicCourseDetail): FlatLesson[] {
  return useMemo(() => detail?.sections.flatMap((section) => section.lessons) ?? [], [detail]);
}

export function LessonPlayer({ slug, lessonId }: LessonPlayerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isPending: sessionPending } = useSession();
  const [completing, setCompleting] = useState(false);

  // Course outline drives the sidebar and prev/next navigation.
  const detailQuery = useQuery({
    queryKey: ["course", slug],
    queryFn: () => apiFetch<PublicCourseDetail>(`/courses/${slug}`),
    retry: false,
  });

  const detail = detailQuery.data;
  const flatLessons = useFlatLessons(detail);
  const currentIndex = flatLessons.findIndex((lesson) => lesson.id === lessonId);
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  const lessonQuery = useQuery({
    queryKey: ["lesson", slug, lessonId],
    queryFn: () => apiFetch<{ title: string; type: string; videoUrl?: string; content?: string; fileUrl?: string; externalUrl?: string; durationMinutes: number; isFreePreview: boolean }>(`/courses/${slug}/lessons/${lessonId}`),
    enabled: !sessionPending,
    retry: false,
  });

  const progressQuery = useQuery({
    queryKey: ["progress", detail?.id],
    queryFn: () => apiFetch<CourseProgress>(`/progress/courses/${detail!.id}`),
    enabled: detail !== undefined && user !== null,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      tryApi<CourseProgress>(`/progress/courses/${detail!.id}/lessons/${id}/complete`, { method: "POST" }),
  });

  const completedIds = new Set(progressQuery.data?.completedLessonIds ?? []);
  const isCurrentCompleted = completedIds.has(lessonId);

  async function onComplete(advance: boolean) {
    if (!detail) {
      return;
    }
    setCompleting(true);
    const result = await completeMutation.mutateAsync(lessonId);
    setCompleting(false);
    if (!result.ok) {
      if (result.error.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${slug}/learn/${lessonId}`)}`);
        return;
      }
      toast.error(result.error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["progress", detail.id] });
    void queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    if (result.data.progressPercent === 100) {
      toast.success("🎉 Course completed! Congratulations.");
    } else {
      toast.success("Lesson completed");
    }
    if (advance && nextLesson) {
      router.replace(`/courses/${slug}/learn/${nextLesson.id}` as Route);
    }
  }

  if (detailQuery.isPending || sessionPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]" aria-busy="true">
        <div className="aspect-video animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return <p role="alert" className="text-sm text-destructive">Course not found.</p>;
  }

  if (lessonQuery.isError || !lessonQuery.data) {
    const error = lessonQuery.error;
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/courses/${slug}/learn/${lessonId}`)}`);
        return null;
      }
      if (status === 403) {
        return (
          <Card className="mx-auto max-w-md">
            <CardContent className="grid place-items-center gap-3 p-8 text-center">
              <PlayCircle className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">Enroll to access this lesson</p>
              <Button asChild>
                <Link href={`/courses/${slug}`}>Back to course</Link>
              </Button>
            </CardContent>
          </Card>
        );
      }
    }
    return <p role="alert" className="text-sm text-destructive">Lesson not found.</p>;
  }

  const lesson = lessonQuery.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Main column */}
      <div className="grid content-start gap-4">
        <Link
          href={`/courses/${slug}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Course overview
        </Link>

        <h1 className="text-xl font-bold tracking-tight">{lesson.title}</h1>

        {lesson.type === "video" && lesson.videoUrl ? (
          // Seed/demo content uses plain URLs; a real deployment streams from
          // the storage provider (Phase 8 adds uploads + signed URLs).
          <video controls className="w-full rounded-lg border bg-black" preload="metadata">
            <source src={lesson.videoUrl} />
            Your browser does not support video playback.
          </video>
        ) : lesson.type === "article" && lesson.content ? (
          <Card>
            <CardContent className="p-6">
              <div className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{lesson.content}</div>
            </CardContent>
          </Card>
        ) : lesson.type === "pdf" && lesson.fileUrl ? (
          <Card>
            <CardContent className="p-6">
              <a href={lesson.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                <FileText className="size-4" aria-hidden />
                Open PDF material
              </a>
            </CardContent>
          </Card>
        ) : lesson.type === "link" && lesson.externalUrl ? (
          <Card>
            <CardContent className="p-6">
              <a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                <Link2 className="size-4" aria-hidden />
                Open external resource
              </a>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              This lesson has no playable content yet.
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" disabled={!prevLesson} asChild={prevLesson !== null}>
            {prevLesson ? (
              <Link href={`/courses/${slug}/learn/${prevLesson.id}` as Route}>
                <ArrowLeft aria-hidden />
                Previous
              </Link>
            ) : (
              <span>
                <ArrowLeft aria-hidden />
                Previous
              </span>
            )}
          </Button>

          {isCurrentCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden />
              Completed
            </span>
          ) : (
            <Button disabled={completing} onClick={() => void onComplete(false)}>
              {completing ? "Saving…" : "Mark as complete"}
            </Button>
          )}

          <Button
            variant="outline"
            disabled={!nextLesson}
            onClick={() => (isCurrentCompleted ? nextLesson && router.replace(`/courses/${slug}/learn/${nextLesson.id}` as Route) : void onComplete(true))}
          >
            {nextLesson ? (
              <>
                {isCurrentCompleted ? "Next lesson" : "Complete & continue"}
                <ArrowRight aria-hidden />
              </>
            ) : (
              <>
                <ArrowRight aria-hidden />
                End of course
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar: curriculum + progress */}
      <aside className="grid content-start gap-4 lg:sticky lg:top-20">
        <Card>
          <CardContent className="grid gap-3 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Your progress</span>
              <span className="text-muted-foreground">{progressQuery.data?.progressPercent ?? 0}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressQuery.data?.progressPercent ?? 0}%` }} />
            </div>
            <Separator />
            <nav aria-label="Curriculum" className="grid gap-1">
              {detail.sections.map((section, sectionIndex) => (
                <div key={section.id} className="grid gap-1">
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    {sectionIndex + 1}. {section.title}
                  </p>
                  {section.lessons.map((cur) => {
                    const active = cur.id === lessonId;
                    const done = completedIds.has(cur.id);
                    return (
                      <Link
                        key={cur.id}
                        href={`/courses/${slug}/learn/${cur.id}` as Route}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${active ? "bg-muted font-medium" : "text-muted-foreground"}`}
                      >
                        {done ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                        ) : (
                          <Film className="size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="line-clamp-1">{cur.title}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
