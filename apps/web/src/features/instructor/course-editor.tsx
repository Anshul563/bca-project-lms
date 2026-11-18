"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type {
  CourseLevel,
  CourseStatus,
  LessonType,
  ManagedCourseDetail,
  ManagedLesson,
  PublicCategory,
} from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, tryApi, tryUpload } from "@/lib/api-client";

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

const LESSON_TYPES: { value: LessonType; label: string; icon: typeof Video }[] = [
  { value: "video", label: "Video", icon: Video },
  { value: "article", label: "Article", icon: FileText },
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "link", label: "External link", icon: Link2 },
];

const STATUS_LABELS: Record<CourseStatus, string> = {
  draft: "Draft",
  pending_review: "Awaiting review",
  published: "Published",
  archived: "Archived",
};

const STATUS_CLASSES: Record<CourseStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

function splitLines(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
}

interface DetailsDraft {
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  level: CourseLevel;
  language: string;
  price: string;
  thumbnail: string;
  previewVideoUrl: string;
  tags: string;
  requirements: string;
  learningOutcomes: string;
}

function toDraft(course: ManagedCourseDetail): DetailsDraft {
  return {
    title: course.title,
    subtitle: course.subtitle ?? "",
    description: course.description,
    categoryId: course.categoryId ?? "",
    level: course.level,
    language: course.language,
    price: String(course.price),
    thumbnail: course.thumbnail ?? "",
    previewVideoUrl: course.previewVideoUrl ?? "",
    tags: course.tags.join(", "),
    requirements: course.requirements.join("\n"),
    learningOutcomes: course.learningOutcomes.join("\n"),
  };
}

/* ------------------------------- course editor ------------------------------- */

export function CourseEditor({ courseId }: { courseId: string }) {
  const query = useQuery({
    queryKey: ["managed-course", courseId],
    queryFn: () => apiFetch<ManagedCourseDetail>(`/courses/id/${courseId}`),
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="grid gap-3">
        <p role="alert" className="text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Could not load this course."}
        </p>
        <Link href="/instructor" className="text-sm text-primary hover:underline">
          Back to the studio
        </Link>
      </div>
    );
  }

  return <EditorBody key={query.data.id} course={query.data} />;
}

function EditorBody({ course }: { course: ManagedCourseDetail }) {
  const queryClient = useQueryClient();
  const thumbnailInput = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<DetailsDraft>(() => toDraft(course));
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingLessonIn, setAddingLessonIn] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<PublicCategory[]>("/categories"),
  });

  function refreshCourse(): void {
    void queryClient.invalidateQueries({ queryKey: ["managed-course", course.id] });
    void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
  }

  const saveDetails = useMutation({
    mutationFn: () =>
      tryApi<{ id: string; status: string }>(`/courses/id/${course.id}`, {
        method: "PATCH",
        body: {
          title: details.title,
          subtitle: details.subtitle || undefined,
          description: details.description,
          categoryId: details.categoryId || undefined,
          level: details.level,
          language: details.language,
          price: Number(details.price) || 0,
          thumbnail: details.thumbnail || undefined,
          previewVideoUrl: details.previewVideoUrl || undefined,
          tags: splitLines(details.tags),
          requirements: splitLines(details.requirements),
          learningOutcomes: splitLines(details.learningOutcomes),
        },
      }),
  });

  const addSection = useMutation({
    mutationFn: (title: string) =>
      tryApi<{ id: string; title: string }>(`/courses/id/${course.id}/sections`, {
        method: "POST",
        body: { title },
      }),
  });

  const deleteSection = useMutation({
    mutationFn: (sectionId: string) =>
      tryApi<null>(`/courses/id/${course.id}/sections/${sectionId}`, { method: "DELETE" }),
  });

  const submitForReview = useMutation({
    mutationFn: () =>
      tryApi<{ id: string; status: string }>(`/courses/id/${course.id}/submit-for-review`, {
        method: "POST",
        body: {},
      }),
  });

  async function onSaveDetails(): Promise<void> {
    const result = await saveDetails.mutateAsync();
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Course details saved.");
    refreshCourse();
  }

  async function onThumbnailSelected(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    setUploadingThumbnail(true);
    const result = await tryUpload(file);
    setUploadingThumbnail(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setDetails((current) => ({ ...current, thumbnail: result.data.url }));
    toast.success("Thumbnail uploaded — remember to save.");
    if (thumbnailInput.current) {
      thumbnailInput.current.value = "";
    }
  }

  async function onAddSection(): Promise<void> {
    if (newSectionTitle.trim().length < 3) {
      toast.error("Section titles need at least 3 characters.");
      return;
    }
    const result = await addSection.mutateAsync(newSectionTitle.trim());
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setNewSectionTitle("");
    toast.success("Section added.");
    refreshCourse();
  }

  async function onDeleteSection(sectionId: string, title: string): Promise<void> {
    if (!window.confirm(`Delete "${title}" and all of its lessons?`)) {
      return;
    }
    const result = await deleteSection.mutateAsync(sectionId);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Section deleted.");
    refreshCourse();
  }

  async function onSubmitForReview(): Promise<void> {
    const result = await submitForReview.mutateAsync();
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Submitted — an admin will review your course.");
    refreshCourse();
  }

  const lessonCount = course.sections.reduce((total, section) => total + section.lessons.length, 0);
  const canSubmit = (course.status === "draft" || course.status === "archived") && lessonCount > 0;

  return (
    <div className="grid gap-6 pb-16">
      <Link
        href="/instructor"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to studio
      </Link>

      <header className="grid gap-3 sm:flex sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[course.status]}`}>
              {STATUS_LABELS[course.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {course.sections.length} sections · {lessonCount} lessons · {course.enrollmentCount} learners
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status === "published" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses/${course.slug}`}>
                <Eye aria-hidden />
                View public page
              </Link>
            </Button>
          ) : null}
          {canSubmit ? (
            <Button size="sm" disabled={submitForReview.isPending} onClick={() => void onSubmitForReview()}>
              {submitForReview.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Submit for review
            </Button>
          ) : null}
        </div>
      </header>

      {course.status === "pending_review" ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          This course is in the admin review queue. You can keep editing, but its status changes only after a
          decision.
        </p>
      ) : null}

      {course.reviewNote ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <strong>Admin feedback:</strong> {course.reviewNote}
        </p>
      ) : null}

      {/* -------------------------------- details -------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
          <CardDescription>Catalog copy, pricing, and media.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="grid content-start gap-2">
              <Label>Thumbnail</Label>
              <div className="grid aspect-video place-items-center overflow-hidden rounded-md border bg-muted">
                {details.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded media can live on any host
                  <img src={details.thumbnail} alt="" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
                )}
              </div>
              <input
                ref={thumbnailInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => void onThumbnailSelected(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingThumbnail}
                onClick={() => thumbnailInput.current?.click()}
              >
                {uploadingThumbnail ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
                {details.thumbnail ? "Replace image" : "Upload image"}
              </Button>
              <p className="text-xs text-muted-foreground">JPG/PNG/WebP/GIF up to 5 MB.</p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  value={details.title}
                  maxLength={120}
                  onChange={(event) => setDetails({ ...details, title: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="course-subtitle">Subtitle</Label>
                <Input
                  id="course-subtitle"
                  value={details.subtitle}
                  maxLength={200}
                  onChange={(event) => setDetails({ ...details, subtitle: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="course-description">Description</Label>
                <textarea
                  id="course-description"
                  rows={5}
                  value={details.description}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setDetails({ ...details, description: event.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="course-category">Category</Label>
              <select
                id="course-category"
                value={details.categoryId}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                onChange={(event) => setDetails({ ...details, categoryId: event.target.value })}
              >
                <option value="">No category</option>
                {(categoriesQuery.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course-level">Level</Label>
              <select
                id="course-level"
                value={details.level}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                onChange={(event) => setDetails({ ...details, level: event.target.value as CourseLevel })}
              >
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course-language">Language</Label>
              <Input
                id="course-language"
                value={details.language}
                onChange={(event) => setDetails({ ...details, language: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course-price">Price (USD)</Label>
              <Input
                id="course-price"
                type="number"
                min={0}
                step="0.01"
                value={details.price}
                onChange={(event) => setDetails({ ...details, price: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="course-outcomes">Learning outcomes</Label>
              <textarea
                id="course-outcomes"
                rows={4}
                value={details.learningOutcomes}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setDetails({ ...details, learningOutcomes: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course-requirements">Requirements</Label>
              <textarea
                id="course-requirements"
                rows={4}
                value={details.requirements}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setDetails({ ...details, requirements: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="course-tags">Tags</Label>
              <Input
                id="course-tags"
                value={details.tags}
                placeholder="react, typescript"
                onChange={(event) => setDetails({ ...details, tags: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="course-preview">Preview video URL</Label>
              <Input
                id="course-preview"
                value={details.previewVideoUrl}
                placeholder="https://…"
                onChange={(event) => setDetails({ ...details, previewVideoUrl: event.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={saveDetails.isPending} onClick={() => void onSaveDetails()}>
              {saveDetails.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------- curriculum ------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Curriculum</CardTitle>
          <CardDescription>Sections group your lessons. Drag-free ordering keeps the MVP simple.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {course.sections.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No sections yet. Add one below to start building the curriculum.
            </p>
          ) : null}

          {course.sections.map((section, sectionIndex) => (
            <div key={section.id} className="rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-background text-xs font-medium">
                    {sectionIndex + 1}
                  </span>
                  <p className="font-medium">{section.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {section.lessons.length} lesson{section.lessons.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteSection.isPending}
                  onClick={() => void onDeleteSection(section.id, section.title)}
                >
                  <Trash2 aria-hidden />
                  Delete
                </Button>
              </div>

              <ul className="divide-y">
                {section.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <LessonIcon type={lesson.type} />
                        <span className="truncate text-sm">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground">{lesson.durationMinutes}m</span>
                        {lesson.isFreePreview ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                            Free preview
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingLessonIn(null);
                            setEditingLessonId(editingLessonId === lesson.id ? null : lesson.id);
                          }}
                        >
                          <Pencil aria-hidden />
                          Edit
                        </Button>
                      </div>
                    </div>

                    {editingLessonId === lesson.id ? (
                      <LessonForm
                        courseId={course.id}
                        sectionId={section.id}
                        lesson={lesson}
                        onClose={() => setEditingLessonId(null)}
                        onSaved={() => {
                          setEditingLessonId(null);
                          refreshCourse();
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="border-t p-3">
                {addingLessonIn === section.id ? (
                  <LessonForm
                    courseId={course.id}
                    sectionId={section.id}
                    onClose={() => setAddingLessonIn(null)}
                    onSaved={() => {
                      setAddingLessonIn(null);
                      refreshCourse();
                    }}
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingLessonId(null);
                      setAddingLessonIn(section.id);
                    }}
                  >
                    <Plus aria-hidden />
                    Add lesson
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-56 flex-1 gap-2">
              <Label htmlFor="new-section">New section</Label>
              <Input
                id="new-section"
                value={newSectionTitle}
                placeholder="e.g. Getting started"
                maxLength={120}
                onChange={(event) => setNewSectionTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onAddSection();
                  }
                }}
              />
            </div>
            <Button variant="outline" disabled={addSection.isPending} onClick={() => void onAddSection()}>
              {addSection.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Add section
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LessonIcon({ type }: { type: LessonType }) {
  const Icon = LESSON_TYPES.find((entry) => entry.value === type)?.icon ?? BookOpen;
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

/* --------------------------------- lesson form --------------------------------- */

interface LessonDraft {
  title: string;
  type: LessonType;
  durationMinutes: string;
  isFreePreview: boolean;
  content: string;
  videoUrl: string;
  fileUrl: string;
  externalUrl: string;
}

function toLessonDraft(lesson?: ManagedLesson): LessonDraft {
  return {
    title: lesson?.title ?? "",
    type: lesson?.type ?? "article",
    durationMinutes: String(lesson?.durationMinutes ?? 0),
    isFreePreview: lesson?.isFreePreview ?? false,
    content: lesson?.content ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    fileUrl: lesson?.fileUrl ?? "",
    externalUrl: lesson?.externalUrl ?? "",
  };
}

function LessonForm({
  courseId,
  sectionId,
  lesson,
  onClose,
  onSaved,
}: {
  courseId: string;
  sectionId: string;
  lesson?: ManagedLesson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<LessonDraft>(() => toLessonDraft(lesson));
  const mediaInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title: draft.title,
        type: draft.type,
        durationMinutes: Number(draft.durationMinutes) || 0,
        isFreePreview: draft.isFreePreview,
      };
      if (draft.type === "article") {
        body.content = draft.content;
      } else if (draft.type === "video") {
        body.videoUrl = draft.videoUrl || undefined;
      } else if (draft.type === "pdf") {
        body.fileUrl = draft.fileUrl || undefined;
      } else {
        body.externalUrl = draft.externalUrl || undefined;
      }

      return lesson
        ? tryApi<ManagedLesson>(`/courses/id/${courseId}/lessons/${lesson.id}`, { method: "PATCH", body })
        : tryApi<ManagedLesson>(`/courses/id/${courseId}/sections/${sectionId}/lessons`, {
            method: "POST",
            body,
          });
    },
  });

  async function onSave(): Promise<void> {
    if (draft.title.trim().length < 3) {
      toast.error("Lesson titles need at least 3 characters.");
      return;
    }
    if (draft.type === "article" && draft.content.trim().length === 0) {
      toast.error("Add the article content learners should read.");
      return;
    }
    if (draft.type === "video" && !draft.videoUrl.trim()) {
      toast.error("Add a video URL or upload a video file.");
      return;
    }
    if (draft.type === "pdf" && !draft.fileUrl.trim()) {
      toast.error("Add a PDF URL or upload a PDF.");
      return;
    }
    if (draft.type === "link" && !draft.externalUrl.trim()) {
      toast.error("Add the external link learners should visit.");
      return;
    }

    const result = await save.mutateAsync();
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(lesson ? "Lesson updated." : "Lesson added.");
    onSaved();
  }

  async function onMediaSelected(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    setUploading(true);
    const result = await tryUpload(file);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (draft.type === "pdf") {
      setDraft((current) => ({ ...current, fileUrl: result.data.url }));
    } else {
      setDraft((current) => ({ ...current, videoUrl: result.data.url }));
    }
    toast.success("File uploaded.");
    if (mediaInput.current) {
      mediaInput.current.value = "";
    }
  }

  const mediaAccept = draft.type === "pdf" ? "application/pdf" : "video/mp4,video/webm,video/quicktime";
  const mediaValue = draft.type === "pdf" ? draft.fileUrl : draft.videoUrl;

  return (
    <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div className="grid gap-2">
          <Label htmlFor={`lesson-title-${sectionId}`}>Lesson title</Label>
          <Input
            id={`lesson-title-${sectionId}`}
            value={draft.title}
            maxLength={120}
            placeholder="e.g. Setting up your environment"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`lesson-type-${sectionId}`}>Type</Label>
          <select
            id={`lesson-type-${sectionId}`}
            value={draft.type}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            onChange={(event) => setDraft({ ...draft, type: event.target.value as LessonType })}
          >
            {LESSON_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draft.type === "article" ? (
        <div className="grid gap-2">
          <Label htmlFor={`lesson-content-${sectionId}`}>Article content</Label>
          <textarea
            id={`lesson-content-${sectionId}`}
            rows={6}
            value={draft.content}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          />
        </div>
      ) : null}

      {draft.type === "video" || draft.type === "pdf" ? (
        <div className="grid gap-2">
          <Label htmlFor={`lesson-media-${sectionId}`}>{draft.type === "pdf" ? "PDF file" : "Video file"}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`lesson-media-${sectionId}`}
              value={mediaValue}
              placeholder="https://… or upload below"
              className="min-w-56 flex-1"
              onChange={(event) =>
                setDraft(
                  draft.type === "pdf"
                    ? { ...draft, fileUrl: event.target.value }
                    : { ...draft, videoUrl: event.target.value },
                )
              }
            />
            <input
              ref={mediaInput}
              type="file"
              accept={mediaAccept}
              className="hidden"
              onChange={(event) => void onMediaSelected(event.target.files?.[0])}
            />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => mediaInput.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {draft.type === "pdf" ? "PDF up to 20 MB." : "MP4/WebM/MOV up to 200 MB."}
          </p>
        </div>
      ) : null}

      {draft.type === "link" ? (
        <div className="grid gap-2">
          <Label htmlFor={`lesson-link-${sectionId}`}>External URL</Label>
          <Input
            id={`lesson-link-${sectionId}`}
            value={draft.externalUrl}
            placeholder="https://…"
            onChange={(event) => setDraft({ ...draft, externalUrl: event.target.value })}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid w-32 gap-2">
          <Label htmlFor={`lesson-duration-${sectionId}`}>Duration (min)</Label>
          <Input
            id={`lesson-duration-${sectionId}`}
            type="number"
            min={0}
            max={600}
            value={draft.durationMinutes}
            onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isFreePreview}
            className="size-4 rounded border"
            onChange={(event) => setDraft({ ...draft, isFreePreview: event.target.checked })}
          />
          Free preview
        </label>
        <span className="inline-flex items-center gap-1 pb-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          Total course time updates automatically.
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={save.isPending} onClick={() => void onSave()}>
          {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {lesson ? "Save lesson" : "Add lesson"}
        </Button>
      </div>
    </div>
  );
}
