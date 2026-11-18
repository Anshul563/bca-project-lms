import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Local development storage for uploaded media. A production deployment swaps
 * this for object storage (S3/R2) behind the same URL contract — the API only
 * ever returns a URL string.
 */
export const uploadsDir = join(process.cwd(), "uploads");

mkdirSync(uploadsDir, { recursive: true });

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
