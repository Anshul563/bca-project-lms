"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@lms/shared";

import { apiFetch, refreshSessionOnce, setAccessToken, tryApi } from "./api-client";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** Bootstraps the session from the httpOnly refresh cookie. */
export function useSession() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<PublicUser | null> => {
      const token = await refreshSessionOnce();
      if (!token) {
        return null;
      }
      return apiFetch<PublicUser>("/auth/me");
    },
    staleTime: 60_000,
    retry: false,
  });

  const user = query.data ?? null;
  const status: SessionStatus = query.isPending ? "loading" : user ? "authenticated" : "unauthenticated";

  return { user, status, refetch: query.refetch, isPending: query.isPending };
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await apiFetch<null>("/auth/logout", { method: "POST" });
      } finally {
        setAccessToken(null);
        queryClient.setQueryData(["me"], null);
        queryClient.removeQueries({ queryKey: ["me"] });
      }
    },
  });
}
