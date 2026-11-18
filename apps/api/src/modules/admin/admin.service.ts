import type {
  AdminApplicationReviewInput,
  AdminCourseReviewInput,
  AdminCourseSummary,
  AdminInstructorApplication,
  AdminUserSummary,
  AdminUserUpdateInput,
  PaginationMeta,
} from "@lms/shared";
import mongoose, { type Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { CourseModel } from "../courses/course.model.js";
import { InstructorApplicationModel } from "../users/instructorApplication.model.js";
import { UserModel } from "../users/user.model.js";

function paginate(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

/** Escapes user input before building a case-insensitive regex search. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------- instructor applications ------------------------- */

interface LeanApplication {
  _id: Types.ObjectId;
  bio: string;
  website?: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  user: { _id: Types.ObjectId; name: string; email: string };
}

function toAdminApplication(application: LeanApplication): AdminInstructorApplication {
  return {
    id: String(application._id),
    user: {
      id: String(application.user._id),
      name: application.user.name,
      email: application.user.email,
    },
    bio: application.bio,
    ...(application.website ? { website: application.website } : {}),
    status: application.status,
    ...(application.reviewNote ? { reviewNote: application.reviewNote } : {}),
    ...(application.reviewedAt ? { reviewedAt: application.reviewedAt.toISOString() } : {}),
    createdAt: application.createdAt.toISOString(),
  };
}

export async function listInstructorApplications(query: {
  status?: "pending" | "approved" | "rejected";
  page: number;
  limit: number;
}): Promise<{ items: AdminInstructorApplication[]; meta: PaginationMeta }> {
  const filter = query.status ? { status: query.status } : {};
  const [total, applications] = await Promise.all([
    InstructorApplicationModel.countDocuments(filter),
    InstructorApplicationModel.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("user", "name email")
      .lean(),
  ]);

  return {
    items: (applications as unknown as LeanApplication[]).map(toAdminApplication),
    meta: paginate(total, query.page, query.limit),
  };
}

export async function reviewInstructorApplication(
  adminId: string,
  applicationId: string,
  body: AdminApplicationReviewInput,
): Promise<AdminInstructorApplication> {
  const application = await InstructorApplicationModel.findById(applicationId);
  if (!application) {
    throw ApiError.notFound("Application not found");
  }
  if (application.status !== "pending") {
    throw ApiError.conflict("This application has already been reviewed", "ALREADY_REVIEWED");
  }

  application.status = body.action === "approve" ? "approved" : "rejected";
  application.reviewedBy = new mongoose.Types.ObjectId(adminId);
  application.reviewedAt = new Date();
  if (body.action === "reject") {
    application.reviewNote = body.reason;
  }
  await application.save();

  if (body.action === "approve") {
    // Approval promotes the applicant in place; sessions keep working.
    await UserModel.updateOne({ _id: application.user }, { $set: { role: "instructor" } });
  }

  const populated = await InstructorApplicationModel.findById(application._id)
    .populate("user", "name email")
    .lean();
  return toAdminApplication(populated as unknown as LeanApplication);
}

/* --------------------------------- users --------------------------------- */

interface LeanUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: "student" | "instructor" | "admin";
  status: "active" | "suspended";
  createdAt: Date;
  lastLoginAt?: Date;
}

function toAdminUser(user: LeanUser): AdminUserSummary {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
  };
}

export async function listUsers(query: {
  search?: string;
  role?: "student" | "instructor" | "admin";
  status?: "active" | "suspended";
  page: number;
  limit: number;
}): Promise<{ items: AdminUserSummary[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (query.role) {
    filter.role = query.role;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [total, users] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("name email role status createdAt lastLoginAt")
      .lean(),
  ]);

  return {
    items: (users as unknown as LeanUser[]).map(toAdminUser),
    meta: paginate(total, query.page, query.limit),
  };
}

export async function updateUser(
  adminId: string,
  userId: string,
  body: AdminUserUpdateInput,
): Promise<AdminUserSummary> {
  if (adminId === userId) {
    throw ApiError.badRequest(
      "You cannot change your own role or status — ask another admin",
      "CANNOT_MODIFY_SELF",
    );
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const wasActiveAdmin = user.role === "admin" && user.status === "active";

  if (body.role !== undefined) {
    user.role = body.role;
  }
  if (body.status !== undefined) {
    user.status = body.status;
    if (body.status === "suspended") {
      // Suspension must take effect immediately: kill refresh sessions.
      user.refreshSessions = [];
    }
  }

  const isActiveAdmin = user.role === "admin" && user.status === "active";
  if (wasActiveAdmin && !isActiveAdmin) {
    const otherAdmins = await UserModel.countDocuments({
      _id: { $ne: user._id },
      role: "admin",
      status: "active",
    });
    if (otherAdmins === 0) {
      throw ApiError.conflict("Cannot remove the last active admin", "LAST_ADMIN");
    }
  }

  await user.save();
  return toAdminUser(user as unknown as LeanUser);
}

/* -------------------------------- courses -------------------------------- */

interface LeanCourse {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  status: "draft" | "pending_review" | "published" | "archived";
  price: number;
  level: AdminCourseSummary["level"];
  totalDurationMinutes: number;
  createdAt: Date;
  publishedAt?: Date;
  reviewNote?: string;
  instructor?: { _id: Types.ObjectId; name: string } | null;
}

function toAdminCourse(course: LeanCourse): AdminCourseSummary {
  return {
    id: String(course._id),
    slug: course.slug,
    title: course.title,
    status: course.status,
    price: course.price,
    level: course.level,
    totalDurationMinutes: course.totalDurationMinutes,
    instructor: {
      id: String(course.instructor?._id ?? ""),
      name: course.instructor?.name ?? "Unknown",
    },
    createdAt: course.createdAt.toISOString(),
    ...(course.publishedAt ? { publishedAt: course.publishedAt.toISOString() } : {}),
    ...(course.reviewNote ? { reviewNote: course.reviewNote } : {}),
  };
}

export async function listCoursesForModeration(query: {
  status?: "draft" | "pending_review" | "published" | "archived";
  search?: string;
  page: number;
  limit: number;
}): Promise<{ items: AdminCourseSummary[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.status) {
    filter.status = query.status;
  }
  if (query.search) {
    filter.title = new RegExp(escapeRegex(query.search), "i");
  }

  const [total, courses] = await Promise.all([
    CourseModel.countDocuments(filter),
    CourseModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("instructor", "name")
      .lean(),
  ]);

  return {
    items: (courses as unknown as LeanCourse[]).map(toAdminCourse),
    meta: paginate(total, query.page, query.limit),
  };
}

/** Approves (publishes) or rejects (drafts + note) a course awaiting review. */
export async function reviewCourse(
  courseId: string,
  body: AdminCourseReviewInput,
): Promise<AdminCourseSummary> {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  if (course.status !== "pending_review") {
    throw ApiError.conflict("Only courses awaiting review can be moderated", "NOT_PENDING_REVIEW");
  }

  if (body.action === "approve") {
    course.status = "published";
    course.publishedAt = new Date();
    course.reviewNote = undefined;
  } else {
    course.status = "draft";
    course.reviewNote = body.note;
  }
  await course.save();

  const populated = await CourseModel.findById(course._id).populate("instructor", "name").lean();
  return toAdminCourse(populated as unknown as LeanCourse);
}
