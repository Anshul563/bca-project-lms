import type { PublicCourseDetail } from "@lms/shared";

/**
 * Server-side course fetch for RSC pages. Forwards the refresh cookie so
 * signed-in owners can preview their unpublished drafts, mirroring the
 * browser behavior of the API's `optionalAuthenticate`.
 */
export async function getCourseDetail(slug: string, cookieHeader?: string): Promise<PublicCourseDetail | null> {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/api/v1/courses/${encodeURIComponent(slug)}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { success: boolean; data: PublicCourseDetail };
    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}
