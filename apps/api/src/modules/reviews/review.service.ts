import type { PaginationQuery, PublicReview, ReviewInput } from "@lms/shared";
import mongoose, { type Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { CourseModel } from "../courses/course.model.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { ReviewModel } from "./review.model.js";

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  avatar?: string;
}

/** Shape of a lean review after `.populate("user", "name avatar")`. */
interface LeanReview {
  _id: Types.ObjectId;
  rating: number;
  comment?: string;
  user: PopulatedUser;
  createdAt: Date;
  updatedAt: Date;
}

function toPublicReview(review: LeanReview): PublicReview {
  return {
    id: String(review._id),
    rating: review.rating,
    ...(review.comment ? { comment: review.comment } : {}),
    user: {
      id: String(review.user._id),
      name: review.user.name,
      ...(review.user.avatar ? { avatar: review.user.avatar } : {}),
    },
    createdAt: review.createdAt.toISOString(),
    ...(review.updatedAt.getTime() !== review.createdAt.getTime()
      ? { updatedAt: review.updatedAt.toISOString() }
      : {}),
  };
}

/** Recomputes the course's denormalized rating average/count after any write. */
async function recomputeCourseRating(courseId: Types.ObjectId | string): Promise<void> {
  const [agg] = await ReviewModel.aggregate<{ average: number; count: number }>([
    { $match: { course: new mongoose.Types.ObjectId(String(courseId)) } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await CourseModel.updateOne(
    { _id: courseId },
    { $set: { ratingAverage: agg ? Math.round(agg.average * 10) / 10 : 0, ratingCount: agg?.count ?? 0 } },
  );
}

/** Public, paginated review list for a published course. */
export async function listReviews(
  slug: string,
  query: PaginationQuery,
): Promise<{
  items: PublicReview[];
  meta: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
}> {
  const course = await CourseModel.findOne({ slug, deletedAt: null, status: "published" }).select("_id");
  if (!course) {
    throw ApiError.notFound("Course not found");
  }

  const filter = { course: course._id };
  const [total, reviews] = await Promise.all([
    ReviewModel.countDocuments(filter),
    ReviewModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("user", "name avatar")
      .lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  return {
    items: (reviews as unknown as LeanReview[]).map(toPublicReview),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNext: query.page < totalPages,
      hasPrev: query.page > 1,
    },
  };
}

export async function getMyReview(userId: string, courseId: string): Promise<PublicReview | null> {
  const review = await ReviewModel.findOne({ user: userId, course: courseId })
    .populate("user", "name avatar")
    .lean();
  if (!review) {
    return null;
  }
  return { ...toPublicReview(review as unknown as LeanReview), isMine: true };
}

async function requireEnrolled(userId: string, courseId: string): Promise<void> {
  const enrolled = await EnrollmentModel.exists({
    user: userId,
    course: courseId,
    status: { $in: ["active", "completed"] },
  });
  if (!enrolled) {
    throw ApiError.forbidden("Enroll in this course to leave a review", "NOT_ENROLLED");
  }
}

/** Creates or replaces the caller's review (one per course). */
export async function upsertReview(userId: string, courseId: string, body: ReviewInput): Promise<PublicReview> {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null }).select("_id");
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  await requireEnrolled(userId, courseId);

  await ReviewModel.findOneAndUpdate(
    { user: userId, course: course._id },
    {
      $set: { rating: body.rating, ...(body.comment ? { comment: body.comment } : {}) },
      // Removing the comment text on edit must clear it, not keep the stale value.
      ...(body.comment ? {} : { $unset: { comment: 1 } }),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await recomputeCourseRating(course._id);

  const review = await getMyReview(userId, courseId);
  return review!;
}

export async function deleteMyReview(userId: string, courseId: string): Promise<void> {
  const review = await ReviewModel.findOneAndDelete({ user: userId, course: courseId });
  if (!review) {
    throw ApiError.notFound("You have not reviewed this course");
  }
  await recomputeCourseRating(review.course);
}
