import { ArrowLeft, BadgeCheck, Clock, Globe, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EnrollButton } from "@/features/courses/enroll-button";
import { CourseReviews } from "@/features/courses/course-reviews";
import { getCourseDetail } from "@/lib/course-api";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all_levels: "All levels",
};

// This route renders per request: draft preview forwards the visitor's cookies
// to the API and `generateMetadata` resolves live course data, so it opts out
// of instant prerendering (cacheComponents). The page body still streams via
// its inner <Suspense> boundary.
export const instant = false;

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>;
}

async function fetchWithCookies(slug: string) {
  const headerList = await headers();
  return getCourseDetail(slug, headerList.get("cookie") ?? undefined);
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await fetchWithCookies(slug);
  if (!course) {
    return { title: "Course not found" };
  }
  return {
    title: course.title,
    description: course.subtitle ?? course.description.slice(0, 150),
  };
}

async function CourseDetailContent({ slug }: { slug: string }) {
  const course = await fetchWithCookies(slug);

  if (!course) {
    notFound();
  }

  const lessonCount = course.sections.reduce((total, section) => total + section.lessons.length, 0);

  return (
    <div className="grid gap-8">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to catalog
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="grid content-start gap-6">
          <header className="grid gap-3">
            {course.category ? (
              <Link
                href="/courses"
                className="w-fit rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {course.category.name}
              </Link>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            {course.subtitle ? <p className="text-lg text-muted-foreground">{course.subtitle}</p> : null}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-4" aria-hidden />
                {LEVEL_LABELS[course.level] ?? course.level}
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe className="size-4" aria-hidden />
                {course.language}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" aria-hidden />
                {Math.round(course.totalDurationMinutes / 60)}h total
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers className="size-4" aria-hidden />
                {course.sections.length} sections · {lessonCount} lessons
              </span>
            </div>
            <p className="text-sm">
              Created by <span className="font-medium text-foreground">{course.instructor.name}</span>
            </p>
          </header>

          {course.learningOutcomes.length > 0 ? (
            <section aria-labelledby="outcomes-heading" className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 id="outcomes-heading" className="mb-3 font-semibold">
                What you&apos;ll learn
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {course.learningOutcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-2 text-sm text-muted-foreground">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="description-heading" className="grid gap-2">
            <h2 id="description-heading" className="font-semibold">
              About this course
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{course.description}</p>
          </section>

          {course.requirements.length > 0 ? (
            <section aria-labelledby="requirements-heading" className="grid gap-2">
              <h2 id="requirements-heading" className="font-semibold">
                Requirements
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {course.requirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <CourseReviews
            slug={course.slug}
            courseId={course.id}
            ratingAverage={course.ratingAverage}
            ratingCount={course.ratingCount}
          />

          {/* Curriculum */}
          <section aria-labelledby="curriculum-heading" className="grid gap-3">
            <h2 id="curriculum-heading" className="font-semibold">
              Curriculum
            </h2>
            {course.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">The curriculum is being prepared.</p>
            ) : (
              <div className="grid gap-3">
                {course.sections.map((section, sectionIndex) => (
                  <Card key={section.id}>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">
                        {sectionIndex + 1}. {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-1.5 p-4 pt-0">
                      {section.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <span>{lesson.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {lesson.isFreePreview ? (
                              <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                                Preview
                              </span>
                            ) : null}
                            {lesson.durationMinutes > 0 ? `${lesson.durationMinutes} min` : lesson.type}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="grid content-start gap-4 lg:sticky lg:top-20">
          <Card>
            <div
              className="flex h-40 items-center justify-center rounded-t-lg bg-gradient-to-br from-primary/10 to-primary/5 text-4xl font-bold text-primary"
              aria-hidden
            >
              {course.title.charAt(0)}
            </div>
            <CardContent className="grid gap-3 p-4">
              <p className="text-2xl font-bold">{course.price === 0 ? "Free" : `$${course.price.toFixed(2)}`}</p>
              <EnrollButton courseId={course.id} courseSlug={course.slug} price={course.price} />
              <Separator />
              <ul className="grid gap-1.5 text-sm text-muted-foreground">
                <li>{lessonCount} lessons</li>
                <li>{Math.round(course.totalDurationMinutes / 60)} hours of content</li>
                <li>Certificate on completion</li>
                <li>Full lifetime access</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function CourseDetailSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-live="polite">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="h-10 w-3/4 animate-pulse rounded-md bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<CourseDetailSkeleton />}>
      <CourseDetailContent slug={slug} />
    </Suspense>
  );
}
