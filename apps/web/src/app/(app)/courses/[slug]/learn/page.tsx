import type { Metadata } from "next";
import { Suspense } from "react";

import { LearnRedirector } from "@/features/learn/learn-redirector";

interface LearnPageProps {
  params: Promise<{ slug: string }>;
}

// The redirector resolves the resume point from the signed-in user's
// progress, so it renders at request time (cacheComponents opt-out).
export const instant = false;

export const metadata: Metadata = {
  title: "Continue learning",
};

function RedirectSkeleton() {
  return (
    <div className="grid place-items-center py-24" aria-busy="true">
      <p className="text-sm text-muted-foreground">Resuming your course…</p>
    </div>
  );
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<RedirectSkeleton />}>
      <LearnRedirector slug={slug} />
    </Suspense>
  );
}
