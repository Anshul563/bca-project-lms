import type { CourseLevel, PublicEnrollment } from "@lms/shared";
import type { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { CourseModel } from "../courses/course.model.js";
import { EnrollmentModel, type EnrollmentDoc } from "./enrollment.model.js";

interface EnrollmentWithCourse {
  enrollment: EnrollmentDoc;
  course: {
    _id: Types.ObjectId;
    slug: string;
    title: string;
    thumbnail?: string;
    level: string;
    totalDurationMinutes: number;
  } | null;
}

export function toPublicEnrollment(entry: EnrollmentWithCourse): PublicEnrollment {
  const { enrollment, course } = entry;
  return {
    id: String(enrollment._id),
    status: enrollment.status,
    progressPercent: enrollment.progressPercent,
    enrolledAt: enrollment.createdAt.toISOString(),
    ...(enrollment.completedAt ? { completedAt: enrollment.completedAt.toISOString() } : {}),
    course: course
      ? {
          id: String(course._id),
          slug: course.slug,
          title: course.title,
          ...(course.thumbnail ? { thumbnail: course.thumbnail } : {}),
          level: course.level as CourseLevel,
          totalDurationMinutes: course.totalDurationMinutes,
        }
      : null,
  };
}

export async function enroll(userId: string, courseId: string): Promise<PublicEnrollment> {
  const course = await CourseModel.findOne({ _id: courseId, status: "published", deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found or not open for enrollment");
  }
  if (course.price > 0) {
    // Paid courses enroll through the order/payment flow (`POST /orders`).
    throw new ApiError(
      402,
      "PAYMENT_REQUIRED",
      "This is a paid course — complete checkout to enroll",
    );
  }

  const enrollment = await activateEnrollmentRecord(userId, course);
  return toPublicEnrollment({ enrollment, course: course as never });
}

/**
 * Creates (or reactivates a cancelled) enrollment and bumps the course
 * counter. Shared by free enrollment and the payment success path.
 */
export async function activateEnrollmentRecord(
  userId: string,
  course: { _id: Types.ObjectId },
): Promise<EnrollmentDoc> {
  const existing = await EnrollmentModel.findOne({ user: userId, course: course._id });
  if (existing && existing.status === "cancelled") {
    existing.status = "active";
    existing.progressPercent = 0;
    existing.cancelledAt = undefined;
    existing.completedAt = undefined;
    await existing.save();
    await CourseModel.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
    return existing;
  }
  if (existing) {
    throw ApiError.conflict("You are already enrolled in this course", "ALREADY_ENROLLED");
  }

  const enrollment = await EnrollmentModel.create({ user: userId, course: course._id });
  await CourseModel.updateOne({ _id: course._id }, { $inc: { enrollmentCount: 1 } });
  return enrollment;
}

export async function listMyEnrollments(
  userId: string,
  options: { status?: "active" | "completed" | "cancelled" } = {},
): Promise<PublicEnrollment[]> {
  const entries = await EnrollmentModel.find({
    user: userId,
    ...(options.status ? { status: options.status } : {}),
  })
    .sort({ createdAt: -1 })
    .populate<{ course: EnrollmentWithCourse["course"] }>(
      "course",
      "slug title thumbnail level totalDurationMinutes",
    )
    .lean();

  return entries.map((entry) =>
    toPublicEnrollment({
      enrollment: entry as unknown as EnrollmentDoc,
      course: entry.course,
    }),
  );
}

export async function cancelEnrollment(userId: string, enrollmentId: string): Promise<PublicEnrollment> {
  const enrollment = await EnrollmentModel.findOne({ _id: enrollmentId, user: userId });
  if (!enrollment) {
    throw ApiError.notFound("Enrollment not found");
  }
  if (enrollment.status !== "active") {
    throw ApiError.conflict("Only active enrollments can be cancelled", "INVALID_STATUS");
  }
  enrollment.status = "cancelled";
  enrollment.cancelledAt = new Date();
  await enrollment.save();
  await CourseModel.updateOne({ _id: enrollment.course }, { $inc: { enrollmentCount: -1 } });
  return toPublicEnrollment({ enrollment, course: null });
}
