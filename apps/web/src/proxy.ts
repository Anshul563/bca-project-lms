import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "@lms/shared";

/**
 * Proxy-level route protection (Next.js 16: `proxy.ts` replaces `middleware.ts`).
 * Only checks refresh-cookie presence — actual session validation happens in
 * server components via `getServerSession()` and, ultimately, in the API.
 */
const PROTECTED_PREFIXES = ["/student", "/instructor", "/admin", "/settings"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const hasRefreshCookie = request.cookies.has(REFRESH_TOKEN_COOKIE);
  if (hasRefreshCookie) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/student/:path*", "/instructor/:path*", "/admin/:path*", "/settings/:path*"],
};
