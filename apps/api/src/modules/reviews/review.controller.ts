import { courseIdParamsSchema, paginationQuerySchema, reviewBodySchema, slugSchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as reviewService from "./review.service.js";

function callerId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user.id;
}

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const slug = slugSchema.parse(req.params.slug);
  const query = paginationQuerySchema.parse(req.query);
  const result = await reviewService.listReviews(slug, query);
  sendSuccess(res, result.items, { meta: result.meta });
});

export const getMyReview = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const review = await reviewService.getMyReview(callerId(req), courseId);
  sendSuccess(res, review);
});

export const upsertMyReview = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const body = reviewBodySchema.parse(req.body);
  const review = await reviewService.upsertReview(callerId(req), courseId, body);
  sendSuccess(res, review, { message: "Review saved" });
});

export const deleteMyReview = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  await reviewService.deleteMyReview(callerId(req), courseId);
  sendSuccess(res, null, { message: "Review removed" });
});
