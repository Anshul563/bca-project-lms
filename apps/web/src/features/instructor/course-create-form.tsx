"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { CourseLevel, PublicCategory } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, tryApi } from "@/lib/api-client";

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all_levels", label: "All levels" },
];

const formSchema = z.object({
  title: z.string().trim().min(5, "At least 5 characters").max(120),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(30, "At least 30 characters").max(10_000),
  categoryId: z.string().optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
  language: z.string().trim().min(2).max(40),
  price: z
    .string()
    .trim()
    .refine(
      (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100_000,
      {
        message: "Enter a price between 0 and 100,000",
      },
    ),
  tags: z.string().optional(),
  requirements: z.string().optional(),
  learningOutcomes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** Splits a comma/newline separated textarea into a trimmed, deduped list. */
function splitList(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
}

export function CourseCreateForm() {
  const router = useRouter();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<PublicCategory[]>("/categories"),
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      description: "",
      categoryId: "",
      level: "beginner",
      language: "English",
      price: "0",
      tags: "",
      requirements: "",
      learningOutcomes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      tryApi<{ id: string; slug: string; title: string; status: string }>("/courses", {
        method: "POST",
        body,
      }),
  });

  async function onSubmit(values: FormValues) {
    const result = await createMutation.mutateAsync({
      title: values.title,
      ...(values.subtitle ? { subtitle: values.subtitle } : {}),
      description: values.description,
      ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      level: values.level,
      language: values.language,
      price: Number(values.price) || 0,
      tags: splitList(values.tags),
      requirements: splitList(values.requirements),
      learningOutcomes: splitList(values.learningOutcomes),
    });

    if (!result.ok) {
      if (result.error.fieldErrors.length > 0) {
        setError("root", { message: result.error.fieldErrors[0]?.message ?? result.error.message });
      } else {
        setError("root", { message: result.error.message });
      }
      toast.error(result.error.message);
      return;
    }

    toast.success("Draft created — add sections and lessons next.");
    router.push(`/instructor/courses/${result.data.id}`);
  }

  return (
    <div className="grid gap-6">
      <Link
        href="/instructor"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to studio
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New course</h1>
        <p className="text-muted-foreground">
          Start with the essentials. You can refine the details and build the curriculum after
          creating the draft.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Course basics</CardTitle>
            <CardDescription>This is what learners see in the catalog.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Modern Web Development Bootcamp"
                {...register("title")}
              />
              {errors.title ? (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input id="subtitle" placeholder="A one-line pitch" {...register("subtitle")} />
              {errors.subtitle ? (
                <p className="text-xs text-destructive">{errors.subtitle.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                rows={5}
                placeholder="What will learners be able to do at the end?"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("description")}
              />
              {errors.description ? (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="categoryId">Category</Label>
                <select
                  id="categoryId"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  {...register("categoryId")}
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
                <Label htmlFor="level">Level</Label>
                <select
                  id="level"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  {...register("level")}
                >
                  {LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <Input id="language" {...register("language")} />
                {errors.language ? (
                  <p className="text-xs text-destructive">{errors.language.message}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" min={0} step="0.01" {...register("price")} />
                {errors.price ? (
                  <p className="text-xs text-destructive">{errors.price.message}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">Use 0 for a free course.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Optional, but they make the course page much stronger.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="learningOutcomes">Learning outcomes</Label>
              <textarea
                id="learningOutcomes"
                rows={3}
                placeholder="One per line — e.g. Build a full-stack app with Next.js"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("learningOutcomes")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="requirements">Requirements</Label>
              <textarea
                id="requirements"
                rows={3}
                placeholder="One per line — e.g. Basic JavaScript knowledge"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("requirements")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" placeholder="react, typescript, node" {...register("tags")} />
              <p className="text-xs text-muted-foreground">Comma separated, up to 10.</p>
            </div>
          </CardContent>
        </Card>

        {errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/instructor")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {isSubmitting || createMutation.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            Create draft
          </Button>
        </div>
      </form>
    </div>
  );
}
