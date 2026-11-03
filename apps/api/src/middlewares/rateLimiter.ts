import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

const handler = (_req: Request, res: Response) => {
  sendError(res, 429, "Too many requests, please try again later", [
    { code: "RATE_LIMITED", message: "Rate limit exceeded" },
  ]);
};

/** Applies to every /api/v1 request. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/health"),
  handler,
});

/** Brute-force protection for auth endpoints; successful calls are free. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler,
});
