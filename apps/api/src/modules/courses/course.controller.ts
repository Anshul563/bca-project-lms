import {
  courseCreateSchema,
  courseListQuerySchema,
  courseUpdateSchema,
  idParamsSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
  objectIdSchema,
  reorderSchema,
  sectionCreateSchema,
  slugSchema,
} from "@lms/shared";
import type { Request, Response } from "express";
import { Types } from "mongoose";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { LessonModel } from "./lesson.model.js";
import { SectionModel } from "./section.model.js";
import * as courseService from "./course.service.js";

function instructorId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user.id;
}

function toLessonPayload(lesson: { _id: Types.ObjectId; title: string; type: string; durationMinutes: number; isFreePreview: boolean }) {
  return {
    id: String(lesson._id),
    title: lesson.title,
    type: lesson.type,
    durationMinutes: lesson.durationMinutes,
    isFreePreview: lesson.isFreePreview,
  };
}

/* ------------------------------- public ------------------------------- */

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const query = courseListQuerySchema.parse(req.query);
  const result = await courseService.listCourses(query);
  sendSuccess(res, result.items, { meta: result.meta });
});

export const getCourse = asyncHandler(async (req: Request, res: Response) => {
  const slug = slugSchema.parse(req.params.slug);
  const viewerId = req.user?.id;
  const result = await courseService.getCourseBySlug(slug, { forOwnerOrAdminId: viewerId });
  if (!result || (result.course.status !== "published" && !result.isOwner)) {
    throw ApiError.notFound("Course not found");
  }
  sendSuccess(res, result.course);
});

/* ----------------------------- instructor CRUD ----------------------------- */

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const body = courseCreateSchema.parse(req.body);
  const course = await courseService.createCourse(instructorId(req), body);
  sendSuccess(res, { id: String(course._id), slug: course.slug, title: course.title, status: course.status }, { status: 201 });
});

export const listMyCourses = asyncHandler(async (req: Request, res: Response) => {
  const query = courseListQuerySchema.parse({ ...req.query, sort: req.query.sort ?? "newest" });
  const result = await courseService.listCourses(
    { ...query, sort: "newest" },
    { includeUnpublishedFor: new Types.ObjectId(instructorId(req)) },
  );
  sendSuccess(res, result.items, { meta: result.meta });
});

export const getMyCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const course = await courseService.requireOwnedCourse(id, instructorId(req));

  const [sections, lessons] = await Promise.all([
    SectionModel.find({ course: course._id }).sort({ order: 1 }).lean(),
    LessonModel.find({ course: course._id }).sort({ order: 1 }).lean(),
  ]);

  const lessonsBySection = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = String(lesson.section);
    lessonsBySection.set(key, [...(lessonsBySection.get(key) ?? []), lesson]);
  }

  sendSuccess(res, {
    id: String(course._id),
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    thumbnail: course.thumbnail,
    previewVideoUrl: course.previewVideoUrl,
    categoryId: course.categoryId ? String(course.categoryId) : undefined,
    level: course.level,
    language: course.language,
    price: course.price,
    tags: course.tags,
    requirements: course.requirements,
    learningOutcomes: course.learningOutcomes,
    status: course.status,
    ratingAverage: course.ratingAverage,
    ratingCount: course.ratingCount,
    enrollmentCount: course.enrollmentCount,
    totalDurationMinutes: course.totalDurationMinutes,
    sections: sections.map((section) => ({
      id: String(section._id),
      title: section.title,
      order: section.order,
      lessons: (lessonsBySection.get(String(section._id)) ?? []).map(toLessonPayload),
    })),
  });
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = courseUpdateSchema.parse(req.body);
  await courseService.requireOwnedCourse(id, instructorId(req));
  const course = await courseService.updateCourse(id, body);
  sendSuccess(res, { id: String(course._id), slug: course.slug, status: course.status }, { message: "Course updated" });
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await courseService.requireOwnedCourse(id, instructorId(req));
  await courseService.softDeleteCourse(id);
  sendSuccess(res, null, { message: "Course deleted" });
});

export const submitCourseForReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  await courseService.requireOwnedCourse(id, instructorId(req));
  const course = await courseService.submitForReview(id);
  sendSuccess(res, { id: String(course._id), status: course.status }, { message: "Submitted for admin review" });
});

/* ------------------------------ sections ------------------------------ */

export const createSection = asyncHandler(async (req: Request, res: Response) => {
  const courseId = objectIdSchema.parse(req.params.courseId);
  const body = sectionCreateSchema.parse(req.body);
  await courseService.requireOwnedCourse(courseId, instructorId(req));
  const section = await courseService.createSection(courseId, body.title);
  sendSuccess(res, { id: String(section._id), title: section.title, order: section.order }, { status: 201 });
});

export const updateSection = asyncHandler(async (req: Request, res: Response) => {
  const sectionId = objectIdSchema.parse(req.params.sectionId);
  const body = sectionCreateSchema.parse(req.body);
  const section = await SectionModel.findById(sectionId);
  if (!section) {
    throw ApiError.notFound("Section not found");
  }
  await courseService.requireOwnedCourse(String(section.course), instructorId(req));
  const updated = await courseService.updateSection(sectionId, body.title);
  sendSuccess(res, { id: String(updated._id), title: updated.title, order: updated.order }, { message: "Section updated" });
});

export const deleteSection = asyncHandler(async (req: Request, res: Response) => {
  const sectionId = objectIdSchema.parse(req.params.sectionId);
  const section = await SectionModel.findById(sectionId);
  if (!section) {
    throw ApiError.notFound("Section not found");
  }
  await courseService.requireOwnedCourse(String(section.course), instructorId(req));
  await courseService.deleteSection(sectionId);
  sendSuccess(res, null, { message: "Section deleted" });
});

export const reorderSections = asyncHandler(async (req: Request, res: Response) => {
  const courseId = objectIdSchema.parse(req.params.courseId);
  const body = reorderSchema.parse(req.body);
  await courseService.requireOwnedCourse(courseId, instructorId(req));
  await courseService.reorderSections(courseId, body.orderedIds);
  sendSuccess(res, null, { message: "Sections reordered" });
});

/* ------------------------------- lessons ------------------------------- */

export const createLesson = asyncHandler(async (req: Request, res: Response) => {
  const courseId = objectIdSchema.parse(req.params.courseId);
  const sectionId = objectIdSchema.parse(req.params.sectionId);
  const body = lessonCreateSchema.parse(req.body);
  await courseService.requireOwnedCourse(courseId, instructorId(req));
  const lesson = await courseService.createLesson(courseId, sectionId, body);
  sendSuccess(res, toLessonPayload(lesson), { status: 201 });
});

export const updateLesson = asyncHandler(async (req: Request, res: Response) => {
  const lessonId = objectIdSchema.parse(req.params.lessonId);
  const body = lessonUpdateSchema.parse(req.body);
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) {
    throw ApiError.notFound("Lesson not found");
  }
  await courseService.requireOwnedCourse(String(lesson.course), instructorId(req));
  const updated = await courseService.updateLesson(lessonId, body);
  sendSuccess(res, toLessonPayload(updated), { message: "Lesson updated" });
});

export const deleteLesson = asyncHandler(async (req: Request, res: Response) => {
  const lessonId = objectIdSchema.parse(req.params.lessonId);
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) {
    throw ApiError.notFound("Lesson not found");
  }
  await courseService.requireOwnedCourse(String(lesson.course), instructorId(req));
  await courseService.deleteLesson(lessonId);
  sendSuccess(res, null, { message: "Lesson deleted" });
});

export const reorderLessons = asyncHandler(async (req: Request, res: Response) => {
  const courseId = objectIdSchema.parse(req.params.courseId);
  const sectionId = objectIdSchema.parse(req.params.sectionId);
  const body = reorderSchema.parse(req.body);
  await courseService.requireOwnedCourse(courseId, instructorId(req));
  await courseService.reorderLessons(courseId, sectionId, body.orderedIds);
  sendSuccess(res, null, { message: "Lessons reordered" });
});
