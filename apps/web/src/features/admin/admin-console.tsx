"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookOpenCheck,
  Check,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type {
  AdminCourseSummary,
  AdminInstructorApplication,
  AdminUserSummary,
} from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetchWithMeta, tryApi } from "@/lib/api-client";

type Tab = "applications" | "courses" | "users";

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "applications", label: "Instructor applications", icon: BadgeCheck },
  { id: "courses", label: "Course review", icon: BookOpenCheck },
  { id: "users", label: "Users", icon: Users },
];

/* --------------------------- applications --------------------------- */

function ApplicationsPanel() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () =>
      apiFetchWithMeta<AdminInstructorApplication[]>("/admin/instructor-applications?status=pending&limit=50"),
    retry: false,
  });

  const review = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "approve" | "reject"; reason?: string }) =>
      tryApi<AdminInstructorApplication>(`/admin/instructor-applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      }),
  });

  async function onReview(id: string, action: "approve" | "reject") {
    if (action === "reject" && reason.trim().length < 3) {
      toast.error("Give the applicant a short reason (at least 3 characters).");
      return;
    }
    const result = await review.mutateAsync({ id, action, ...(action === "reject" ? { reason: reason.trim() } : {}) });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(action === "approve" ? "Approved — the user is now an instructor." : "Application rejected.");
    setRejectingId(null);
    setReason("");
    void queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
  }

  const applications = query.data?.data ?? [];

  if (query.isPending) {
    return <PanelSkeleton />;
  }
  if (query.isError) {
    return <PanelError message="Could not load applications." />;
  }
  if (applications.length === 0) {
    return <PanelEmpty icon={BadgeCheck} message="No pending instructor applications." />;
  }

  return (
    <ul className="grid gap-3">
      {applications.map((application) => (
        <li key={application.id}>
          <Card>
            <CardContent className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{application.user.name}</p>
                  <p className="text-xs text-muted-foreground">{application.user.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Applied {new Date(application.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{application.bio}</p>
              {application.website ? (
                <a
                  href={application.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {application.website}
                </a>
              ) : null}

              {rejectingId === application.id ? (
                <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Why is this application being rejected? The applicant will see this."
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={review.isPending}
                      onClick={() => void onReview(application.id, "reject")}
                    >
                      Confirm rejection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(application.id);
                      setReason("");
                    }}
                  >
                    <X aria-hidden />
                    Reject
                  </Button>
                  <Button size="sm" disabled={review.isPending} onClick={() => void onReview(application.id, "approve")}>
                    <Check aria-hidden />
                    Approve instructor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- course review ----------------------------- */

function CoursesPanel() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => apiFetchWithMeta<AdminCourseSummary[]>("/admin/courses?status=pending_review&limit=50"),
    retry: false,
  });

  const review = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: "approve" | "reject"; note?: string }) =>
      tryApi<AdminCourseSummary>(`/admin/courses/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...(note ? { note } : {}) }),
      }),
  });

  async function onReview(id: string, action: "approve" | "reject") {
    if (action === "reject" && note.trim().length < 3) {
      toast.error("Add a short note so the instructor knows what to fix.");
      return;
    }
    const result = await review.mutateAsync({ id, action, ...(action === "reject" ? { note: note.trim() } : {}) });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(action === "approve" ? "Course published." : "Sent back to the instructor.");
    setRejectingId(null);
    setNote("");
    void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const courses = query.data?.data ?? [];

  if (query.isPending) {
    return <PanelSkeleton />;
  }
  if (query.isError) {
    return <PanelError message="Could not load the moderation queue." />;
  }
  if (courses.length === 0) {
    return <PanelEmpty icon={BookOpenCheck} message="No courses are waiting for review." />;
  }

  return (
    <ul className="grid gap-3">
      {courses.map((course) => (
        <li key={course.id}>
          <Card>
            <CardContent className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{course.title}</p>
                  <p className="text-xs text-muted-foreground">
                    By {course.instructor.name} · {course.level.replace("_", " ")} ·{" "}
                    {course.price === 0 ? "Free" : `$${course.price.toFixed(2)}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Submitted {new Date(course.createdAt).toLocaleDateString()}
                </span>
              </div>

              {rejectingId === course.id ? (
                <div className="grid gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="What should the instructor fix before resubmitting?"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={review.isPending}
                      onClick={() => void onReview(course.id, "reject")}
                    >
                      Confirm rejection
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(course.id);
                      setNote("");
                    }}
                  >
                    <X aria-hidden />
                    Send back
                  </Button>
                  <Button size="sm" disabled={review.isPending} onClick={() => void onReview(course.id, "approve")}>
                    <Check aria-hidden />
                    Publish course
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- users --------------------------------- */

function UsersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const query = useQuery({
    queryKey: ["admin-users", submittedSearch],
    queryFn: () =>
      apiFetchWithMeta<AdminUserSummary[]>(
        `/admin/users?limit=30${submittedSearch ? `&search=${encodeURIComponent(submittedSearch)}` : ""}`,
      ),
    retry: false,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: string; status?: string } }) =>
      tryApi<AdminUserSummary>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  });

  async function onUpdate(user: AdminUserSummary, patch: { role?: string; status?: string }) {
    const result = await update.mutateAsync({ id: user.id, patch });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("User updated");
    void queryClient.invalidateQueries({ queryKey: ["admin-users", submittedSearch] });
  }

  const users = query.data?.data ?? [];

  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedSearch(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {query.isPending ? (
        <PanelSkeleton />
      ) : query.isError ? (
        <PanelError message="Could not load users." />
      ) : users.length === 0 ? (
        <PanelEmpty icon={Users} message="No users match this search." />
      ) : (
        <ul className="grid gap-2">
          {users.map((user) => (
            <li key={user.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {user.name}
                      {user.status === "suspended" ? (
                        <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          Suspended
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={user.role}
                      aria-label={`Role for ${user.name}`}
                      onChange={(event) =>
                        void onUpdate(user, { role: event.target.value })
                      }
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="student">student</option>
                      <option value="instructor">instructor</option>
                      <option value="admin">admin</option>
                    </select>
                    <Button
                      size="sm"
                      variant={user.status === "active" ? "outline" : "default"}
                      disabled={update.isPending}
                      onClick={() =>
                        void onUpdate(user, { status: user.status === "active" ? "suspended" : "active" })
                      }
                    >
                      {user.status === "active" ? "Suspend" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- shell -------------------------------- */

function PanelSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-lg border bg-muted" />
      ))}
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return <p role="alert" className="text-sm text-destructive">{message}</p>;
}

function PanelEmpty({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <Icon className="size-7 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("applications");

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
        <p className="text-muted-foreground">Review instructors, publish courses, and manage accounts.</p>
      </header>

      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            variant={tab === id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(id)}
          >
            <Icon aria-hidden />
            {label}
          </Button>
        ))}
      </div>

      {tab === "applications" ? <ApplicationsPanel /> : null}
      {tab === "courses" ? <CoursesPanel /> : null}
      {tab === "users" ? <UsersPanel /> : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Actions apply immediately. Suspending a user revokes their active sessions.
      </p>
    </div>
  );
}
