import {
  REFRESH_TOKEN_COOKIE,
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  instructorApplicationBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from "@lms/shared";
import type { Request, Response } from "express";

import { sendSuccess } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { setRefreshCookie, clearRefreshCookie, readRefreshCookie } from "../../utils/cookies.js";
import { ApiError } from "../../utils/ApiError.js";
import * as authService from "./auth.service.js";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

function clientMeta(req: Request): ClientMeta {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

/** Wraps successful exchanges: set the refresh cookie, return access token. */
function sendTokens(
  res: Response,
  result: authService.SuccessResult,
  options?: { status?: number; message?: string },
): void {
  if (result.tokens.refreshToken) {
    setRefreshCookie(res, result.tokens.refreshToken, REFRESH_TTL_SECONDS);
  }
  sendSuccess(res, { user: result.user, accessToken: result.tokens.accessToken }, options);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = registerBodySchema.parse(req.body);
  const result = await authService.registerStudent(body, clientMeta(req));
  sendTokens(res, result, { status: 201 });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = loginBodySchema.parse(req.body);
  const result = await authService.login(body, clientMeta(req));
  sendTokens(res, result, { message: "Signed in" });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshCookie(req.cookies?.[REFRESH_TOKEN_COOKIE]);
  if (!token) {
    throw ApiError.unauthorized("No refresh token supplied", "REFRESH_MISSING");
  }
  const result = await authService.refreshSession(token, clientMeta(req));
  sendTokens(res, result, { message: "Session refreshed" });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshCookie(req.cookies?.[REFRESH_TOKEN_COOKIE]);
  await authService.logout(token);
  clearRefreshCookie(res);
  sendSuccess(res, null, { message: "Signed out" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, user);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const body = verifyEmailBodySchema.parse(req.body);
  await authService.verifyEmail(body.token);
  sendSuccess(res, null, { message: "Email verified" });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = forgotPasswordBodySchema.parse(req.body);
  await authService.requestPasswordReset(body.email);
  sendSuccess(res, null, { message: "If the account exists, a reset link has been sent" });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = resetPasswordBodySchema.parse(req.body);
  await authService.resetPassword(body.token, body.password);
  sendSuccess(res, null, { message: "Password updated, please sign in again" });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  const body = changePasswordBodySchema.parse(req.body);
  await authService.changePassword(
    req.user.id,
    body.currentPassword,
    body.newPassword,
    readRefreshCookie(req.cookies?.[REFRESH_TOKEN_COOKIE]),
  );
  sendSuccess(res, null, { message: "Password changed" });
});

export const applyInstructor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  const body = instructorApplicationBodySchema.parse(req.body);
  await authService.applyForInstructor(req.user.id, body.bio, body.website);
  sendSuccess(res, { status: "pending" }, { status: 201, message: "Application submitted for review" });
});
