import { courseIdParamsSchema, lessonParamsSchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as progressService from "./progress.service.js";

function caller(req: Request): { id: string; role: progressService.ProgressRole } {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return { id: req.user.id, role: req.user.role };
}

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const user = caller(req);
  const progress = await progressService.getCourseProgress(user.id, user.role, courseId);
  sendSuccess(res, progress);
});

export const completeLesson = asyncHandler(async (req: Request, res: Response) => {
  const { courseId, lessonId } = lessonParamsSchema.parse(req.params);
  const user = caller(req);
  const progress = await progressService.completeLesson(user.id, user.role, courseId, lessonId);
  sendSuccess(res, progress, { message: "Lesson marked as complete" });
});
