import { cookies, headers } from "next/headers";
import { REFRESH_TOKEN_COOKIE, type UserRole } from "@lms/shared";

/**
 * Server-side session probe for layouts/pages. Validates the httpOnly refresh
 * cookie against the API (read-only — does NOT rotate the session), so RSC
 * code can gate routes without leaking any token material.
 */
export interface ServerSession {
  authenticated: boolean;
  role?: UserRole;
}

export async function getServerSession(): Promise<ServerSession> {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshCookie) {
    return { authenticated: false };
  }

  const headerList = await headers();
  const cookieHeader = headerList.get("cookie") ?? "";

  try {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001").replace(/\/$/, "");
    const response = await fetch(`${apiUrl}/api/v1/auth/session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) {
      return { authenticated: false };
    }
    const payload = (await response.json()) as { success: boolean; data: ServerSession };
    if (payload.success && payload.data.authenticated) {
      return payload.data;
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}
