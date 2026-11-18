import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { env } from "./env.js";

/**
 * Local development storage for uploaded media.
 *
 * The storage provider is intentionally local-only in this build: production
 * deployments mount a persistent volume (or swap this module for an object
 * storage adapter) behind the same URL contract — the API only ever returns a
 * URL string and the database never stores binaries.
 */
export const uploadsDir = resolve(process.cwd(), env.LOCAL_STORAGE_PATH);

mkdirSync(uploadsDir, { recursive: true });

/** Normalised public path prefix, e.g. `/uploads`. */
export const uploadsPublicPrefix = `/${env.LOCAL_STORAGE_PUBLIC_URL_PREFIX.replace(/^\/+|\/+$/g, "")}`;

export const UPLOAD_MIME_LIMITS: Record<string, number> = {
  "image/jpeg": 5 * 1024 * 1024,
  "image/png": 5 * 1024 * 1024,
  "image/webp": 5 * 1024 * 1024,
  "image/gif": 5 * 1024 * 1024,
  "application/pdf": 20 * 1024 * 1024,
  "video/mp4": 200 * 1024 * 1024,
  "video/webm": 200 * 1024 * 1024,
  "video/quicktime": 200 * 1024 * 1024,
};

export const MAX_UPLOAD_BYTES = Math.max(...Object.values(UPLOAD_MIME_LIMITS));
