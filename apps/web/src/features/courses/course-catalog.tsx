"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock, Search, Star, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CourseList, PublicCategory, PublicCourseSummary } from "@lms/shared";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetchWithMeta } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all_levels: "All levels",
};

const PAGE_SIZE = 9;

interface CatalogFilters {
  search: string;
  category: string;
  level: string;
  priceType: string;
  sort: string;
}

const EMPTY_FILTERS: CatalogFilters = {
  search: "",
  category: "",
  level: "",
  priceType: "",
  sort: "newest",
};

function buildQueryString(filters: CatalogFilters, page: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  params.set("sort", filters.sort);
  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.level) {
    params.set("level", filters.level);
  }
  if (filters.priceType) {
    params.set("priceType", filters.priceType);
  }
  return params.toString();
}

function CourseCard({ course }: { course: PublicCourseSummary }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/courses/${course.slug}`} className="block focus-visible:outline-none">
        <div
          className="flex h-40 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary"
          aria-hidden
        >
          <span className="text-3xl font-bold">{course.title.charAt(0)}</span>
        </div>
        <CardContent className="grid gap-2 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {course.category ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                {course.category.name}
              </span>
            ) : null}
            <span>{LEVEL_LABELS[course.level] ?? course.level}</span>
          </div>
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">{course.title}</h3>
          {course.subtitle ? <p className="line-clamp-1 text-sm text-muted-foreground">{course.subtitle}</p> : null}
          <p className="text-sm text-muted-foreground">by {course.instructor.name || "LMS"}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 text-amber-500" aria-hidden />
              {course.ratingAverage.toFixed(1)} ({course.ratingCount})
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {course.enrollmentCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {Math.round(course.totalDurationMinutes / 60)}h
            </span>
          </div>
          <p className="mt-1 font-semibold">{course.price === 0 ? "Free" : `$${course.price.toFixed(2)}`}</p>
        </CardContent>
      </Link>
    </Card>
  );
}

const selectClasses =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CourseCatalog() {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);

  const catalogQuery = useQuery({
    queryKey: ["courses", filters, page],
    queryFn: () => apiFetchWithMeta<CourseList["items"]>(`/courses?${buildQueryString(filters, page)}`),
    placeholderData: keepPreviousData,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetchWithMeta<PublicCategory[]>("/categories"),
    staleTime: 5 * 60_000,
  });

  const meta = catalogQuery.data?.meta;
  const courses = catalogQuery.data?.data ?? [];

  function updateFilters(patch: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Course catalog</h1>
        <p className="text-muted-foreground">Explore expert-built courses across every subject.</p>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <form
          className="relative lg:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilters({ search: searchDraft });
          }}
        >
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-8"
            placeholder="Search courses…"
            aria-label="Search courses"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </form>
        <select
          aria-label="Filter by category"
          className={selectClasses}
          value={filters.category}
          onChange={(event) => updateFilters({ category: event.target.value })}
        >
          <option value="">All categories</option>
          {(categoriesQuery.data?.data ?? []).map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by level"
          className={selectClasses}
          value={filters.level}
          onChange={(event) => updateFilters({ level: event.target.value })}
        >
          <option value="">All levels</option>
          {Object.entries(LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by price and sort"
          className={selectClasses}
          value={filters.priceType}
          onChange={(event) => updateFilters({ priceType: event.target.value })}
        >
          <option value="">Free & paid</option>
          <option value="free">Free only</option>
          <option value="paid">Paid only</option>
        </select>
        <select
          aria-label="Sort courses"
          className={cn(selectClasses, "lg:col-start-4")}
          value={filters.sort}
          onChange={(event) => updateFilters({ sort: event.target.value })}
        >
          <option value="newest">Newest</option>
          <option value="popular">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Results */}
      {catalogQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : catalogQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load courses. Is the API running?
        </p>
      ) : courses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No courses match your filters yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {meta && meta.totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
                disabled={!meta.hasPrev}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
                disabled={!meta.hasNext}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
