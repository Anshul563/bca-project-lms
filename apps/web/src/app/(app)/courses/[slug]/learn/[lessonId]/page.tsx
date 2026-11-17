import type { Metadata } from "next";
import { Suspense } from "react";

import { LessonPlayer } from "@/features/learn/lesson-player";

interface LearnLessonPageProps {
  params: Promise<{ slug: string; lessonId: string }>;
}

// The player gates content per-user (session + enrollment), so it renders at
// request time inside its Suspense boundary; instant prerender is disabled
// for this segment (cacheComponents).
export const instant = false;

export const metadata: Metadata = {
  title: "Lesson",
};

function PlayerSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]" aria-busy="true">
      <div className="aspect-video animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default async function LearnLessonPage({ params }: LearnLessonPageProps) {
  const { slug, lessonId } = await params;
  return (
    <Suspense fallback={<PlayerSkeleton />}>
      <LessonPlayer slug={slug} lessonId={lessonId} />
    </Suspense>
  );
}
