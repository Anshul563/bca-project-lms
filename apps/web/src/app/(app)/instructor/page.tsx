"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Star, Users } from "lucide-react";
import Link from "next/link";
import type { PublicCourseSummary } from "@lms/shared";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetchWithMeta } from "@/lib/api-client";

function InstructorDashboard() {
  const myCoursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => apiFetchWithMeta<PublicCourseSummary[]>("/courses/mine/all"),
  });

  const courses = myCoursesQuery.data?.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instructor studio</h1>
          <p className="text-muted-foreground">Your courses and how they&apos;re performing.</p>
        </div>
        <Button asChild>
          <Link href="/instructor/courses/new">
            <Plus aria-hidden />
            New course
          </Link>
        </Button>
      </div>

      {myCoursesQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : myCoursesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your courses.
        </p>
      ) : courses.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <BookOpen className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">You haven&apos;t created any courses yet.</p>
          <Button asChild size="sm">
            <Link href="/instructor/courses/new">
              <Plus aria-hidden />
              Create your first course
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardContent className="grid gap-2 p-4">
                <Link href={`/courses/${course.slug}`} className="line-clamp-2 font-semibold hover:underline">
                  {course.title}
                </Link>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" aria-hidden />
                    {course.enrollmentCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 text-amber-500" aria-hidden />
                    {course.ratingAverage.toFixed(1)}
                  </span>
                  <span>{Math.round(course.totalDurationMinutes / 60)}h</span>
                </div>
                {course.reviewNote ? (
                  <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    Admin feedback: {course.reviewNote}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {course.status ? (
                    <span className="text-xs capitalize text-muted-foreground">
                      {course.status.replace("_", " ")}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/instructor/courses/${course.id}`}>
                      <Pencil aria-hidden />
                      Edit course
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstructorPage() {
  return (
    <AuthGuard allow={["instructor", "admin"]}>
      <InstructorDashboard />
    </AuthGuard>
  );
}
