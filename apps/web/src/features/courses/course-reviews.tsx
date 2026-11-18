"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PublicReview } from "@lms/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiFetch, apiFetchWithMeta, tryApi } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

interface CourseReviewsProps {
  slug: string;
  courseId: string;
  ratingAverage: number;
  ratingCount: number;
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-4 ${star <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function CourseReviews({ slug, courseId, ratingAverage, ratingCount }: CourseReviewsProps) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const reviewsQuery = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => apiFetchWithMeta<PublicReview[]>(`/courses/${slug}/reviews?limit=20`),
    retry: false,
  });

  const myReviewQuery = useQuery({
    queryKey: ["my-review", courseId],
    queryFn: () => apiFetch<PublicReview | null>(`/courses/id/${courseId}/reviews/my`),
    enabled: user !== null,
    retry: false,
  });

  const myReview = myReviewQuery.data ?? null;
  const notEnrolled = myReviewQuery.isError;

  const saveMutation = useMutation({
    mutationFn: (body: { rating: number; comment?: string }) =>
      tryApi<PublicReview>(`/courses/id/${courseId}/reviews/my`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tryApi<null>(`/courses/id/${courseId}/reviews/my`, { method: "DELETE" }),
  });

  async function onSave() {
    const effectiveRating = rating || myReview?.rating || 0;
    if (effectiveRating < 1) {
      toast.error("Pick a star rating first.");
      return;
    }
    const result = await saveMutation.mutateAsync({
      rating: effectiveRating,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Thanks for your review!");
    setFormOpen(false);
    setComment("");
    setRating(0);
    void queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
    void queryClient.invalidateQueries({ queryKey: ["my-review", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["course", slug] });
  }

  async function onDelete() {
    const result = await deleteMutation.mutateAsync();
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Review removed");
    setFormOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["reviews", slug] });
    void queryClient.invalidateQueries({ queryKey: ["my-review", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["course", slug] });
  }

  const reviews = reviewsQuery.data?.data ?? [];
  const showForm = user !== null && !notEnrolled;
  const activeRating = rating || myReview?.rating || 0;

  return (
    <section aria-labelledby="reviews-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="reviews-heading" className="font-semibold">
          Learner reviews
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <Stars value={ratingAverage} />
          <span className="font-medium">{ratingCount === 0 ? "No ratings yet" : ratingAverage.toFixed(1)}</span>
          {ratingCount > 0 ? <span className="text-muted-foreground">({ratingCount})</span> : null}
        </div>
      </div>

      {showForm ? (
        <Card>
          <CardContent className="grid gap-3 p-4">
            {myReview && !formOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Stars value={myReview.rating} />
                  <span className="text-muted-foreground">Your review</span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => void onDelete()}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={activeRating === star}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(star)}
                      className="rounded p-0.5"
                    >
                      <Star
                        className={`size-6 ${
                          star <= (hovered || activeRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Share what you liked or what could be better… (optional)"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  {formOpen ? (
                    <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                  ) : null}
                  <Button size="sm" disabled={saveMutation.isPending} onClick={() => void onSave()}>
                    {saveMutation.isPending ? "Saving…" : myReview ? "Update review" : "Post review"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {reviewsQuery.isPending ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : reviews.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" aria-hidden />
          No reviews yet — be the first after enrolling.
        </p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{review.user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                  {review.updatedAt ? " · edited" : ""}
                </span>
              </div>
              <Stars value={review.rating} className="my-1" />
              {review.comment ? <p className="text-sm text-muted-foreground">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {!reviewsQuery.isPending ? <Separator /> : null}
    </section>
  );
}
