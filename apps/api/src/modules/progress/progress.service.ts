import type { CourseProgress } from "@lms/shared";

import { ApiError } from "../../utils/ApiError.js";
import { CourseModel, type CourseDoc } from "../courses/course.model.js";
import { LessonModel } from "../courses/lesson.model.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { LessonProgressModel } from "./progress.model.js";

export type ProgressRole = "student" | "instructor" | "admin";

/** Enrollment (active/completed) or course ownership/admin grants access. */
async function requireCourseAccess(
  userId: string,
  role: ProgressRole,
  course: CourseDoc,
): Promise<void> {
  if (role === "admin" || String(course.instructor) === userId) {
    return;
  }
  const enrollment = await EnrollmentModel.exists({
    user: userId,
    course: course._id,
    status: { $in: ["active", "completed"] },
  });
  if (!enrollment) {
    throw ApiError.forbidden("Enroll in this course to track progress", "NOT_ENROLLED");
  }
}

async function requireEnrollableCourse(courseId: string): Promise<CourseDoc> {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  return course;
}

export async function getCourseProgress(userId: string, role: ProgressRole, courseId: string): Promise<CourseProgress> {
  const course = await requireEnrollableCourse(courseId);
  await requireCourseAccess(userId, role, course);

  const lessons = await LessonModel.find({ course: course._id }).select("_id").lean();
  const lessonIds = lessons.map((lesson) => lesson._id);
  const totalLessons = lessonIds.length;

  const completions = await LessonProgressModel.find({
    user: userId,
    course: course._id,
  })
    .select("lesson completedAt")
    .lean();
  const completedLessonIds = completions.map((entry) => String(entry.lesson));

  const enrollment = await EnrollmentModel.findOne({ user: userId, course: course._id });

  return {
    courseId,
    status: enrollment?.status ?? "active",
    totalLessons,
    completedLessons: completions.length,
    progressPercent: totalLessons === 0 ? 0 : Math.round((completions.length / totalLessons) * 100),
    completedLessonIds,
    ...(enrollment?.lastAccessedLesson ? { lastLessonId: String(enrollment.lastAccessedLesson) } : {}),
    ...(enrollment?.completedAt ? { completedAt: enrollment.completedAt.toISOString() } : {}),
  };
}

/**
 * Marks a lesson complete (idempotent) and recomputes the enrollment's
 * `progressPercent`, `lastAccessedLesson`, and auto-completes at 100%.
 */
export async function completeLesson(
  userId: string,
  role: ProgressRole,
  courseId: string,
  lessonId: string,
): Promise<CourseProgress> {
  const course = await requireEnrollableCourse(courseId);
  await requireCourseAccess(userId, role, course);

  const lesson = await LessonModel.findOne({ _id: lessonId, course: course._id });
  if (!lesson) {
    throw ApiError.notFound("Lesson not found in this course");
  }

  // Enrollment must exist and not be cancelled.
  const enrollment = await EnrollmentModel.findOne({ user: userId, course: course._id });
  if (!enrollment) {
    throw ApiError.forbidden("Enroll in this course to track progress", "NOT_ENROLLED");
  }
  if (enrollment.status === "cancelled") {
    throw ApiError.conflict("Your enrollment is cancelled — re-enroll to continue", "ENROLLMENT_CANCELLED");
  }

  // Idempotent upsert: completing twice must not change anything.
  await LessonProgressModel.updateOne(
    { user: userId, lesson: lesson._id },
    { $setOnInsert: { course: course._id, completedAt: new Date() } },
    { upsert: true },
  );

  const [totalLessons, completedLessons] = await Promise.all([
    LessonModel.countDocuments({ course: course._id }),
    LessonProgressModel.countDocuments({ user: userId, course: course._id }),
  ]);

  const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const finished = totalLessons > 0 && completedLessons >= totalLessons;

  enrollment.progressPercent = progressPercent;
  enrollment.lastAccessedLesson = lesson._id;
  if (finished && enrollment.status !== "completed") {
    enrollment.status = "completed";
    enrollment.completedAt = new Date();
  }
  await enrollment.save();

  const completions = await LessonProgressModel.find({ user: userId, course: course._id })
    .select("lesson")
    .lean();

  return {
    courseId,
    status: enrollment.status,
    totalLessons,
    completedLessons,
    progressPercent,
    completedLessonIds: completions.map((entry) => String(entry.lesson)),
    lastLessonId: String(lesson._id),
    ...(enrollment.completedAt ? { completedAt: enrollment.completedAt.toISOString() } : {}),
  };
}
