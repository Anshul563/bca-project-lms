"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, GraduationCap, PlayCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { PublicEnrollment } from "@lms/shared";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch, tryApi } from "@/lib/api-client";
import type { Route } from "next";

function progressLabel(entry: PublicEnrollment): string {
  return entry.status === "completed" ? "Completed" : `${Math.round(entry.progressPercent)}% complete`;
}

function EnrollmentCard({ entry }: { entry: PublicEnrollment }) {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => tryApi<PublicEnrollment>(`/enrollments/${entry.id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Enrollment cancelled");
        void queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      } else {
        toast.error(result.error.message);
      }
    },
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <Link href={`/courses/${entry.course?.slug ?? ""}`} className="font-semibold hover:underline">
            {entry.course?.title ?? "Untitled course"}
          </Link>
          <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {Math.round((entry.course?.totalDurationMinutes ?? 0) / 60)}h
            </span>
            <span>{progressLabel(entry)}</span>
            <span className="capitalize">Enrolled {new Date(entry.enrolledAt).toLocaleDateString()}</span>
          </p>
          <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${entry.progressPercent}%` }} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href={entry.course ? (`/courses/${entry.course.slug}/learn` as Route) : "/courses"}>
              <PlayCircle aria-hidden />
              {entry.status === "completed" ? "Review" : "Continue"}
            </Link>
          </Button>
          {entry.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => void cancelMutation.mutateAsync()}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDashboard() {
  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => apiFetch<PublicEnrollment[]>("/enrollments/my"),
  });

  const entries = enrollmentsQuery.data ?? [];
  const active = entries.filter((entry) => entry.status === "active");
  const completed = entries.filter((entry) => entry.status === "completed");
  const cancelled = entries.filter((entry) => entry.status === "cancelled");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My learning</h1>
        <p className="text-muted-foreground">
          {active.length > 0
            ? `You have ${active.length} active course${active.length === 1 ? "" : "s"}. Keep going!`
            : "Enroll in a course to start learning."}
        </p>
      </div>

      {enrollmentsQuery.isPending ? (
        <div className="grid gap-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : enrollmentsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your enrollments.
        </p>
      ) : entries.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <GraduationCap className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">No enrollments yet.</p>
          <Button asChild>
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {[...active, ...completed].map((entry) => (
            <EnrollmentCard key={entry.id} entry={entry} />
          ))}
          {cancelled.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {cancelled.length} cancelled enrollment{cancelled.length === 1 ? "" : "s"} hidden.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function StudentPage() {
  return (
    <AuthGuard allow={["student"]}>
      <StudentDashboard />
    </AuthGuard>
  );
}
