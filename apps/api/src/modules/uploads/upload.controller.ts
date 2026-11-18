import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { extname } from "node:path";

import type { UploadedFile } from "@lms/shared";
import type { Request, Response } from "express";
import multer from "multer";

import {
  MAX_UPLOAD_BYTES,
  UPLOAD_MIME_LIMITS,
  uploadsDir,
  uploadsPublicPrefix,
} from "../../config/uploads.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase().slice(0, 10)}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!(file.mimetype in UPLOAD_MIME_LIMITS)) {
      callback(
        ApiError.badRequest(
          `Unsupported file type: ${file.mimetype}. Allowed: JPEG/PNG/WebP/GIF, PDF, MP4/WebM/MOV.`,
          "UNSUPPORTED_FILE_TYPE",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

/** Wraps multer so its errors become our standard 400 envelope. */
export function uploadSingleFile(req: Request, res: Response, next: (error?: unknown) => void): void {
  uploader.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        error.code === "LIMIT_FILE_SIZE"
          ? ApiError.badRequest("File exceeds the maximum allowed size", "FILE_TOO_LARGE")
          : ApiError.badRequest(error.message, "UPLOAD_ERROR"),
      );
      return;
    }
    next(error ?? undefined);
  });
}

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("No file uploaded — send multipart/form-data in the 'file' field", "NO_FILE");
  }

  const limit = UPLOAD_MIME_LIMITS[req.file.mimetype]!;
  if (req.file.size > limit) {
    await rm(req.file.path, { force: true });
    throw ApiError.badRequest(
      `This file type allows up to ${Math.round(limit / (1024 * 1024))} MB`,
      "FILE_TOO_LARGE",
    );
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  const uploaded: UploadedFile = {
    url: `${origin}${uploadsPublicPrefix}/${req.file.filename}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };
  sendSuccess(res, uploaded, { status: 201, message: "File uploaded" });
});
