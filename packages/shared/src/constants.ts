import type { UserRole } from "./enums.js";

/** Name of the httpOnly cookie holding the refresh token. */
export const REFRESH_TOKEN_COOKIE = "lms_refresh_token";

/** Default access-token lifetime used when env does not override it. */
export const ACCESS_TOKEN_TTL_SECONDS_DEFAULT = 15 * 60;

/** Default refresh-token lifetime (days) used when env does not override it. */
export const REFRESH_TOKEN_TTL_DAYS_DEFAULT = 7;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/** Hard cap on consecutive failed logins before the account is locked out. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** Duration of the login lockout after MAX_FAILED_LOGIN_ATTEMPTS failures. */
export const LOGIN_LOCKOUT_MINUTES = 15;

export const NAME_MAX_LENGTH = 80;
export const NAME_MIN_LENGTH = 2;

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const COURSE_SLUG_MAX_LENGTH = 120;

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

/** Roles allowed to authenticate into the platform. */
export const AUTHENTICATABLE_ROLES: readonly UserRole[] = [
  "student",
  "instructor",
  "admin",
];
