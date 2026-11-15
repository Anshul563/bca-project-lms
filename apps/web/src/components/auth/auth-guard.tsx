"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { UserRole } from "@lms/shared";
import type { Route } from "next";

import { useSession } from "@/lib/auth";

interface AuthGuardProps {
  children: ReactNode;
  /** If set, users with a different role are redirected to their own dashboard. */
  allow?: readonly UserRole[];
}

const DASHBOARD_BY_ROLE: Record<UserRole, Route> = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
};

/**
 * Client-side complement to `proxy.ts` and server layout checks. Once the
 * session bootstraps, unauthenticated users are pushed to login (keeping the
 * current path) and unauthorized users to their own dashboard.
 */
export function AuthGuard({ children, allow }: AuthGuardProps) {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      );
      router.replace(`/login?next=${next}`);
      return;
    }
    if (status === "authenticated" && user && allow && !allow.includes(user.role)) {
      router.replace(DASHBOARD_BY_ROLE[user.role]);
    }
  }, [status, user, allow, router]);

  if (status !== "authenticated" || (allow && user && !allow.includes(user.role))) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-live="polite">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
