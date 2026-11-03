import { ZodError } from "zod";
import mongoose from "mongoose";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    sendError(res, error.status, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      ...(issue.path.length > 0 && { field: issue.path.join(".") }),
    }));
    sendError(res, 422, "Validation failed", details);
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      code: item.kind as string,
      message: item.message,
      field: item.path,
    }));
    sendError(res, 422, "Validation failed", details);
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    sendError(res, 400, `Invalid value for ${error.path}`, [
      { code: "CAST_ERROR", message: `Invalid value for ${error.path}`, field: error.path },
    ]);
    return;
  }

  const isSyntaxBody = error instanceof SyntaxError && "body" in error;
  if (isSyntaxBody) {
    sendError(res, 400, "Malformed JSON body");
    return;
  }

  logger.error({ error: error instanceof Error ? error.stack : error, requestId: req.id, url: req.originalUrl }, "Unhandled error");

  const message =
    error instanceof Error && !env.isProduction
      ? error.message
      : "Internal server error";
  sendError(res, 500, message);
}
