import type { UserRole } from "@lms/shared";
import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UserModel } from "../modules/users/user.model.js";

const BEARER_PREFIX = "Bearer ";

/**
 * Validates the Authorization header (short-lived access token), loads the
 * user fresh from the database, and attaches the minimal identity to
 * `req.user`. Suspended users are rejected here regardless of token validity.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw ApiError.unauthorized();
  }
  const payload = verifyAccessToken(header.slice(BEARER_PREFIX.length));

  const user = await UserModel.findById(payload.sub).select("status role email").lean();
  if (!user) {
    throw ApiError.unauthorized("Session is no longer valid", "SESSION_INVALID");
  }
  if (user.status === "suspended") {
    throw ApiError.forbidden("This account is suspended.", "ACCOUNT_SUSPENDED");
  }

  req.user = { id: String(user._id), role: user.role, email: user.email };
  next();
});

/**
 * Route-gate factory: `authorize("admin")`, `authorize("admin", "instructor")`.
 * Must be used after `authenticate`.
 */
export function authorize(...allowedRoles: readonly UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      next(ApiError.forbidden(`This action requires role: ${allowedRoles.join(" or ")}`, "ROLE_FORBIDDEN"));
      return;
    }
    next();
  };
}

/** Optional auth: attaches user when a valid token is present, never fails. */
export const optionalAuthenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(BEARER_PREFIX.length));
    const user = await UserModel.findById(payload.sub).select("status role email").lean();
    if (user && user.status === "active") {
      req.user = { id: String(user._id), role: user.role, email: user.email };
    }
  } catch {
    // Anonymous on invalid token — routes decide what that means.
  }
  next();
});
