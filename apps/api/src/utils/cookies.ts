import { env } from "../config/env.js";
import type { Response } from "express";

import { REFRESH_TOKEN_COOKIE } from "@lms/shared";

const REFRESH_COOKIE_PATH = "/api/v1/auth";

export function setRefreshCookie(res: Response, token: string, maxAgeSeconds = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function readRefreshCookie(token: string | undefined): string | null {
  return typeof token === "string" && token.length > 0 ? token : null;
}
