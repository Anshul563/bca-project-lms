import { enrollBodySchema, idParamsSchema, listEnrollmentsQuerySchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as enrollmentService from "./enrollment.service.js";

function userId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user.id;
}

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = enrollBodySchema.parse(req.body);
  const enrollment = await enrollmentService.enroll(userId(req), courseId);
  sendSuccess(res, enrollment, { status: 201, message: "Enrolled successfully" });
});

export const listMyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const { status } = listEnrollmentsQuerySchema.parse(req.query);
  const items = await enrollmentService.listMyEnrollments(userId(req), {
    ...(status ? { status } : {}),
  });
  sendSuccess(res, items);
});

export const cancelEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const enrollment = await enrollmentService.cancelEnrollment(userId(req), id);
  sendSuccess(res, enrollment, { message: "Enrollment cancelled" });
});
