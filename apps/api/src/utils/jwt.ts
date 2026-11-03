import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

export interface AccessTokenPayload {
  sub: string;
  role: "student" | "instructor" | "admin";
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  jti: string;
}

export function signAccessToken(userId: string, role: AccessTokenPayload["role"]): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}

export function signRefreshToken(
  userId: string,
  role: AccessTokenPayload["role"],
  jti: string,
): string {
  return jwt.sign({ sub: userId, role, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw ApiError.unauthorized("Invalid access token");
    }
    return { sub: payload.sub, role: payload.role as AccessTokenPayload["role"] };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Access token expired", "TOKEN_EXPIRED");
    }
    throw ApiError.unauthorized("Invalid access token", "TOKEN_INVALID");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      throw ApiError.unauthorized("Invalid refresh token");
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized("Refresh token expired", "REFRESH_EXPIRED");
    }
    throw ApiError.unauthorized("Invalid refresh token", "REFRESH_INVALID");
  }
}
