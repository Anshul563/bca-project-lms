import {
  attemptBodySchema,
  courseIdParamsSchema,
  idParamsSchema,
  quizBodySchema,
} from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as quizService from "./quiz.service.js";

function caller(req: Request): { id: string; role: quizService.ProgressRole } {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return { id: req.user.id, role: req.user.role };
}

/* ------------------------------ instructor ------------------------------ */

export const upsertQuiz = asyncHandler(async (req: Request, res: Response) => {
  const { id: courseId } = idParamsSchema.parse(req.params);
  const body = quizBodySchema.parse(req.body);
  const user = caller(req);
  const quiz = await quizService.upsertQuiz(user.id, user.role, courseId, body);
  sendSuccess(res, quiz, { message: "Quiz saved" });
});

export const getQuizForInstructor = asyncHandler(async (req: Request, res: Response) => {
  const { id: courseId } = idParamsSchema.parse(req.params);
  const user = caller(req);
  const quiz = await quizService.getQuizForInstructor(user.id, user.role, courseId);
  sendSuccess(res, quiz);
});

export const listAttemptsForInstructor = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const user = caller(req);
  const attempts = await quizService.listAttemptsForInstructor(user.id, user.role, courseId);
  sendSuccess(res, attempts);
});

/* -------------------------------- student -------------------------------- */

export const getQuizForStudent = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const user = caller(req);
  const quiz = await quizService.getQuizForStudent(user.id, user.role, courseId);
  sendSuccess(res, quiz);
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const body = attemptBodySchema.parse(req.body);
  const user = caller(req);
  const result = await quizService.submitAttempt(user.id, user.role, courseId, body);
  sendSuccess(res, result, { status: 201, message: result.passed ? "Quiz passed" : "Quiz submitted" });
});

export const listMyAttempts = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = courseIdParamsSchema.parse(req.params);
  const user = caller(req);
  const attempts = await quizService.listMyAttempts(user.id, courseId);
  sendSuccess(res, attempts);
});
