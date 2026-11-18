"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch, tryApi } from "@/lib/api-client";
import type { PublicEnrollment, PublicOrder } from "@lms/shared";

interface EnrollButtonProps {
  courseId: string;
  courseSlug: string;
  price: number;
}

export function EnrollButton({ courseId, courseSlug, price }: EnrollButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<PublicOrder | null>(null);

  // Enrollment status decides whether we show "Enroll" or "Go to course".
  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", "check", courseId],
    queryFn: () => apiFetch<PublicEnrollment[]>("/enrollments/my"),
    retry: false,
  });

  const enrollMutation = useMutation({
    mutationFn: () => tryApi<PublicEnrollment>("/enrollments", { method: "POST", body: { courseId } }),
  });

  const createOrderMutation = useMutation({
    mutationFn: () => tryApi<PublicOrder>("/orders", { method: "POST", body: { courseId } }),
  });

  const payOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      tryApi<PublicOrder>(`/orders/${orderId}/pay`, { method: "POST", body: {} }),
  });

  const alreadyEnrolled = (enrollmentsQuery.data ?? []).some(
    (entry) => entry.course?.id === courseId && entry.status !== "cancelled",
  );

  async function onFreeEnroll() {
    const result = await enrollMutation.mutateAsync();
    if (!result.ok) {
      if (result.error.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`);
        return;
      }
      if (result.error.code === "ALREADY_ENROLLED") {
        router.push("/student");
        return;
      }
      toast.error(result.error.message);
      return;
    }
    toast.success("You're enrolled! Start learning now.");
    await queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    router.push("/student");
  }

  /** Step 1 of checkout: create (or reuse) the pending order. */
  async function onStartCheckout() {
    const result = await createOrderMutation.mutateAsync();
    if (!result.ok) {
      if (result.error.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseSlug}`)}`);
        return;
      }
      if (result.error.code === "ALREADY_ENROLLED") {
        router.push("/student");
        return;
      }
      toast.error(result.error.message);
      return;
    }
    setOrder(result.data);
  }

  /** Step 2: confirm the mock payment, which enrolls the learner. */
  async function onConfirmPayment() {
    if (!order) {
      return;
    }
    const result = await payOrderMutation.mutateAsync(order.id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Payment confirmed — you're enrolled!");
    await queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
    router.push(`/courses/${courseSlug}/learn`);
  }

  if (alreadyEnrolled) {
    return (
      <Button className="w-full" onClick={() => router.push("/student")}>
        Go to my learning
      </Button>
    );
  }

  if (price > 0 && order) {
    return (
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          Mock checkout · Order {order.id.slice(-6).toUpperCase()} · {order.currency} {order.amount.toFixed(2)}
        </p>
        <Button className="w-full" disabled={payOrderMutation.isPending} onClick={() => void onConfirmPayment()}>
          {payOrderMutation.isPending ? "Processing payment…" : `Confirm payment · $${order.amount.toFixed(2)}`}
        </Button>
        <Button className="w-full" variant="ghost" size="sm" onClick={() => setOrder(null)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full"
      disabled={enrollMutation.isPending || createOrderMutation.isPending}
      onClick={() => (price === 0 ? void onFreeEnroll() : void onStartCheckout())}
    >
      {enrollMutation.isPending || createOrderMutation.isPending
        ? "Please wait…"
        : price === 0
          ? "Enroll for free"
          : `Buy now · $${price.toFixed(2)}`}
    </Button>
  );
}
