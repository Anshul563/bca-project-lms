import {
  adminApplicationListQuerySchema,
  adminApplicationReviewSchema,
  adminCourseListQuerySchema,
  adminCourseReviewSchema,
  adminUserListQuerySchema,
  adminUserUpdateSchema,
  idParamsSchema,
} from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as adminService from "./admin.service.js";

function callerId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user.id;
}

/* ------------------------- instructor applications ------------------------- */

export const listInstructorApplications = asyncHandler(async (req: Request, res: Response) => {
  const query = adminApplicationListQuerySchema.parse(req.query);
  const result = await adminService.listInstructorApplications(query);
  sendSuccess(res, result.items, { meta: result.meta });
});

export const reviewInstructorApplication = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = adminApplicationReviewSchema.parse(req.body);
  const application = await adminService.reviewInstructorApplication(callerId(req), id, body);
  sendSuccess(res, application, {
    message: body.action === "approve" ? "Instructor approved" : "Application rejected",
  });
});

/* --------------------------------- users --------------------------------- */

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = adminUserListQuerySchema.parse(req.query);
  const result = await adminService.listUsers(query);
  sendSuccess(res, result.items, { meta: result.meta });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = adminUserUpdateSchema.parse(req.body);
  const user = await adminService.updateUser(callerId(req), id, body);
  sendSuccess(res, user, { message: "User updated" });
});

/* -------------------------------- courses -------------------------------- */

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const query = adminCourseListQuerySchema.parse(req.query);
  const result = await adminService.listCoursesForModeration(query);
  sendSuccess(res, result.items, { meta: result.meta });
});

export const reviewCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = adminCourseReviewSchema.parse(req.body);
  const course = await adminService.reviewCourse(id, body);
  sendSuccess(res, course, {
    message: body.action === "approve" ? "Course published" : "Course sent back to the instructor",
  });
});
