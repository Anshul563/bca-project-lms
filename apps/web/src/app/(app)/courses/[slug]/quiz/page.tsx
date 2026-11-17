import type { Metadata } from "next";
import { Suspense } from "react";

import { QuizRunner } from "@/features/quiz/quiz-runner";

interface QuizPageProps {
  params: Promise<{ slug: string }>;
}

// Quiz access depends on the visitor's session and enrollment, so the page
// renders at request time inside its Suspense boundary (cacheComponents).
export const instant = false;

export const metadata: Metadata = {
  title: "Course quiz",
};

function QuizSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<QuizSkeleton />}>
      <QuizRunner slug={slug} />
    </Suspense>
  );
}
