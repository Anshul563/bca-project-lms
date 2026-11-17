import {
  type CourseListQuery,
  type CourseList,
  type LessonDetail,
  type PublicCategory,
  type PublicCourseDetail,
  type PublicLesson,
  type PublicSection,
} from "@lms/shared";
import mongoose, { type Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { CategoryModel } from "../categories/category.model.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { LessonModel, type ILesson } from "./lesson.model.js";
import { CourseModel, type CourseDoc } from "./course.model.js";
import { SectionModel } from "./section.model.js";

const PUBLISHED_FILTER = { status: "published" as const, deletedAt: null };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "course";
  let candidate = base;
  let suffix = 2;
  while (await CourseModel.exists({ slug: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 50) {
      candidate = `${base}-${Date.now()}`;
      break;
    }
  }
  return candidate;
}

/* ------------------------------ categories ------------------------------ */

export async function createCategory(input: {
  name: string;
  slug?: string;
  description?: string;
  parent?: string | null;
}) {
  const slug = input.slug ?? slugify(input.name);
  if (await CategoryModel.exists({ slug })) {
    throw ApiError.conflict("A category with this slug already exists", "SLUG_TAKEN");
  }
  return CategoryModel.create({ ...input, slug });
}

export async function listCategories(): Promise<{ items: PublicCategory[]; count: number }> {
  const categories = await CategoryModel.find({ deletedAt: null }).sort({ name: 1 }).lean();
  const counts = await CourseModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { ...PUBLISHED_FILTER, categoryId: { $ne: null } } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const countByCategory = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return {
    items: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      ...(category.description ? { description: category.description } : {}),
      ...(countByCategory.get(String(category._id)) !== undefined
        ? { courseCount: countByCategory.get(String(category._id)) }
        : {}),
    })),
    count: categories.length,
  };
}

/* -------------------------------- courses -------------------------------- */

interface ListOptions {
  includeUnpublishedFor?: Types.ObjectId;
}

export async function listCourses(
  query: CourseListQuery,
  options: ListOptions = {},
): Promise<CourseList> {
  const { page, limit, search, sort } = query;
  const filters: Record<string, unknown> = { deletedAt: null };

  if (options.includeUnpublishedFor) {
    filters.$or = [
      PUBLISHED_FILTER,
      { instructor: options.includeUnpublishedFor },
    ];
  } else {
    filters.status = "published";
  }

  if (search) {
    filters.$text = { $search: search };
  }
  if (query.category) {
    const category = await CategoryModel.findOne({ slug: query.category, deletedAt: null }).select("_id");
    if (!category) {
      return { items: [], meta: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
    }
    filters.categoryId = category._id;
  }
  if (query.level) {
    filters.level = query.level;
  }
  if (query.language) {
    filters.language = query.language;
  }
  if (query.priceType === "free") {
    filters.price = 0;
  } else if (query.priceType === "paid") {
    filters.price = { $gt: 0 };
  }
  if (query.minRating !== undefined) {
    filters.ratingAverage = { $gte: query.minRating };
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "popular"
      ? { enrollmentCount: -1 }
      : sort === "rating"
        ? { ratingAverage: -1, ratingCount: -1 }
        : sort === "price_asc"
          ? { price: 1 }
          : sort === "price_desc"
            ? { price: -1 }
            : { createdAt: -1 };

  const [items, total] = await Promise.all([
    CourseModel.find(filters)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ instructor: { _id: Types.ObjectId; name: string; avatar?: string } }>(
        "instructor",
        "name avatar",
      )
      .populate<{ categoryId?: { _id: Types.ObjectId; name: string; slug: string } }>(
        "categoryId",
        "name slug",
      )
      .lean(),
    CourseModel.countDocuments(filters),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items: items.map((course) => ({
      id: String(course._id),
      slug: course.slug,
      title: course.title,
      ...(course.subtitle ? { subtitle: course.subtitle } : {}),
      ...(course.thumbnail ? { thumbnail: course.thumbnail } : {}),
      level: course.level,
      language: course.language,
      price: course.price,
      ratingAverage: course.ratingAverage,
      ratingCount: course.ratingCount,
      enrollmentCount: course.enrollmentCount,
      totalDurationMinutes: course.totalDurationMinutes,
      ...(course.categoryId ? { category: { id: String(course.categoryId._id), name: course.categoryId.name, slug: course.categoryId.slug } } : {}),
      instructor: {
        id: String(course.instructor._id),
        name: course.instructor.name,
        ...(course.instructor.avatar ? { avatar: course.instructor.avatar } : {}),
      },
      ...(course.publishedAt ? { publishedAt: course.publishedAt.toISOString() } : {}),
    })),
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function getCourseBySlug(
  slug: string,
  options: { forOwnerOrAdminId?: string } = {},
): Promise<{ course: PublicCourseDetail; isOwner: boolean } | null> {
  const course = await CourseModel.findOne({ slug, deletedAt: null }).populate<{
    instructor: { _id: Types.ObjectId; name: string; avatar?: string; bio?: string } | null;
  }>("instructor", "name avatar bio");

  if (!course) {
    return null;
  }

  const isOwner = options.forOwnerOrAdminId !== undefined && String(course.instructor?._id ?? "") === options.forOwnerOrAdminId;

  const sections = await SectionModel.find({ course: course._id }).sort({ order: 1 }).lean();
  const lessons = await LessonModel.find({ course: course._id }).sort({ order: 1 }).lean();

  const lessonsBySection = new Map<string, (ILesson & { _id: Types.ObjectId })[]>();
  // Curriculum outline is public for published courses (standard practice —
  // learners browse titles/durations); lesson *content* stays gated via
  // getLessonContent. Drafts show everything to their owner only.
  const canSeeFullOutline = course.status === "published" || isOwner;
  for (const lesson of lessons) {
    const key = String(lesson.section);
    const bucket = lessonsBySection.get(key) ?? [];
    const visible = canSeeFullOutline || lesson.isFreePreview;
    if (visible) {
      bucket.push(lesson);
    }
    lessonsBySection.set(key, bucket);
  }

  const publicSections: PublicSection[] = sections
    .filter((section) => (lessonsBySection.get(String(section._id)) ?? []).length > 0)
    .map((section) => {
      const lessonList = lessonsBySection.get(String(section._id)) ?? [];
      const publicLessons: PublicLesson[] = lessonList.map((lesson) => ({
        id: String(lesson._id),
        title: lesson.title,
        type: lesson.type,
        durationMinutes: lesson.durationMinutes,
        isFreePreview: lesson.isFreePreview,
      }));
      return {
        id: String(section._id),
        title: section.title,
        order: section.order,
        lessons: publicLessons,
      };
    });

  const instructor = course.instructor;
  const category = course.categoryId
    ? await CategoryModel.findById(course.categoryId).select("name slug").lean()
    : null;

  return {
    isOwner,
    course: {
      id: String(course._id),
      slug: course.slug,
      title: course.title,
      ...(course.subtitle ? { subtitle: course.subtitle } : {}),
      description: course.description,
      ...(course.thumbnail ? { thumbnail: course.thumbnail } : {}),
      ...(course.previewVideoUrl ? { previewVideoUrl: course.previewVideoUrl } : {}),
      level: course.level,
      language: course.language,
      price: course.price,
      ratingAverage: course.ratingAverage,
      ratingCount: course.ratingCount,
      enrollmentCount: course.enrollmentCount,
      totalDurationMinutes: course.totalDurationMinutes,
      tags: course.tags,
      requirements: course.requirements,
      learningOutcomes: course.learningOutcomes,
      status: course.status,
      category: category ? { id: String(category._id), name: category.name, slug: category.slug } : undefined,
      sections: publicSections,
      instructor: {
        id: String(instructor?._id ?? ""),
        name: instructor?.name ?? "",
        ...(instructor?.avatar ? { avatar: instructor.avatar } : {}),
        bio: instructor?.bio ?? "",
      },
      ...(course.publishedAt ? { publishedAt: course.publishedAt.toISOString() } : {}),
    },
  };
}

export async function createCourse(instructorId: string, input: { title: string } & Record<string, unknown>): Promise<CourseDoc> {
  const slug = await uniqueSlug(input.title as string);
  const course = await CourseModel.create({
    ...input,
    title: input.title,
    slug,
    instructor: instructorId,
    status: "draft",
  });
  return course;
}

export async function requireOwnedCourse(courseId: string, instructorId: string): Promise<CourseDoc> {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  if (String(course.instructor) !== instructorId) {
    throw ApiError.forbidden("You can only manage your own courses", "NOT_COURSE_OWNER");
  }
  return course;
}

export async function requireOwnedCourseBySlug(slug: string, instructorId: string): Promise<CourseDoc> {
  const course = await CourseModel.findOne({ slug, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  if (String(course.instructor) !== instructorId) {
    throw ApiError.forbidden("You can only manage your own courses", "NOT_COURSE_OWNER");
  }
  return course;
}

export async function updateCourse(courseId: string, updates: Record<string, unknown>): Promise<CourseDoc> {
  const course = await CourseModel.findByIdAndUpdate(courseId, { $set: updates }, { new: true, runValidators: true });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  return course;
}

export async function submitForReview(courseId: string): Promise<CourseDoc> {
  const course = await CourseModel.findById(courseId);
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  const sectionsCount = await SectionModel.countDocuments({ course: course._id });
  const lessonsCount = await LessonModel.countDocuments({ course: course._id });
  if (sectionsCount === 0 || lessonsCount === 0) {
    throw ApiError.badRequest(
      "Add at least one section and one lesson before submitting for review",
      "CURRICULUM_INCOMPLETE",
    );
  }
  if (course.status !== "draft" && course.status !== "archived") {
    throw ApiError.conflict(`Course is already ${course.status.replace("_", " ")}`, "INVALID_STATUS");
  }
  course.status = "pending_review";
  await course.save();
  return course;
}

export async function softDeleteCourse(courseId: string): Promise<void> {
  await CourseModel.updateOne({ _id: courseId }, { $set: { deletedAt: new Date() } });
}

/* ---------------------------- sections / lessons ---------------------------- */

async function nextSectionOrder(courseId: Types.ObjectId): Promise<number> {
  const last = await SectionModel.findOne({ course: courseId }).sort({ order: -1 }).select("order").lean();
  return (last?.order ?? -1) + 1;
}

async function nextLessonOrder(sectionId: Types.ObjectId): Promise<number> {
  const last = await LessonModel.findOne({ section: sectionId }).sort({ order: -1 }).select("order").lean();
  return (last?.order ?? -1) + 1;
}

export async function createSection(courseId: string, title: string) {
  const course = await CourseModel.findOne({ _id: courseId, deletedAt: null });
  if (!course) {
    throw ApiError.notFound("Course not found");
  }
  return SectionModel.create({ course: course._id, title, order: await nextSectionOrder(course._id) });
}

export async function updateSection(sectionId: string, title: string) {
  const section = await SectionModel.findByIdAndUpdate(sectionId, { $set: { title } }, { new: true });
  if (!section) {
    throw ApiError.notFound("Section not found");
  }
  return section;
}

export async function deleteSection(sectionId: string): Promise<void> {
  const section = await SectionModel.findById(sectionId);
  if (!section) {
    throw ApiError.notFound("Section not found");
  }
  await LessonModel.deleteMany({ section: section._id });
  await section.deleteOne();
}

export async function reorderSections(courseId: string, orderedIds: string[]): Promise<void> {
  const sections = await SectionModel.find({ course: courseId }).select("_id");
  const ownedIds = new Set(sections.map((section) => String(section._id)));
  if (orderedIds.length !== sections.length || !orderedIds.every((id) => ownedIds.has(id))) {
    throw ApiError.badRequest("orderedIds must be a permutation of all section ids", "INVALID_ORDER");
  }
  const updates = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, course: courseId }, update: { $set: { order: index } } },
  }));
  await SectionModel.bulkWrite(updates);
}

export async function createLesson(courseId: string, sectionId: string, input: Record<string, unknown>) {
  const section = await SectionModel.findOne({ _id: sectionId, course: courseId });
  if (!section) {
    throw ApiError.notFound("Section not found");
  }
  const lesson = await LessonModel.create({
    ...input,
    course: courseId,
    section: sectionId,
    order: await nextLessonOrder(section._id),
  });
  await recalculateCourseDuration(courseId);
  return lesson;
}

export async function updateLesson(lessonId: string, updates: Record<string, unknown>) {
  const lesson = await LessonModel.findByIdAndUpdate(lessonId, { $set: updates }, { new: true, runValidators: true });
  if (!lesson) {
    throw ApiError.notFound("Lesson not found");
  }
  await recalculateCourseDuration(String(lesson.course));
  return lesson;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const lesson = await LessonModel.findById(lessonId);
  if (!lesson) {
    throw ApiError.notFound("Lesson not found");
  }
  await lesson.deleteOne();
  await recalculateCourseDuration(String(lesson.course));
}

export async function reorderLessons(courseId: string, sectionId: string, orderedIds: string[]): Promise<void> {
  const lessons = await LessonModel.find({ course: courseId, section: sectionId }).select("_id");
  const ownedIds = new Set(lessons.map((lesson) => String(lesson._id)));
  if (orderedIds.length !== lessons.length || !orderedIds.every((id) => ownedIds.has(id))) {
    throw ApiError.badRequest("orderedIds must be a permutation of the section's lesson ids", "INVALID_ORDER");
  }
  const updates = orderedIds.map((id, index) => ({
    updateOne: { filter: { _id: id, section: sectionId }, update: { $set: { order: index } } },
  }));
  await LessonModel.bulkWrite(updates);
}

export async function recalculateCourseDuration(courseId: string): Promise<void> {
  const result = await LessonModel.aggregate<{ total: number }>([
    { $match: { course: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: null, total: { $sum: "$durationMinutes" } } },
  ]);
  const total = result[0]?.total ?? 0;
  await CourseModel.updateOne({ _id: courseId }, { $set: { totalDurationMinutes: total } });
}

/* ------------------------------ lesson content ------------------------------ */

export interface LessonContentViewer {
  id?: string;
  role?: string;
}

/**
 * Returns the full lesson payload (video URL, article body, attachments) for
 * authorized viewers: the course owner, admins, actively-enrolled students,
 * and anonymous visitors for free previews of published courses.
 */
export async function getLessonContent(
  slug: string,
  lessonId: string,
  viewer: LessonContentViewer,
): Promise<LessonDetail | null> {
  const course = await CourseModel.findOne({ slug, deletedAt: null });
  if (!course) {
    return null;
  }

  const lesson = await LessonModel.findOne({ _id: lessonId, course: course._id });
  if (!lesson) {
    return null;
  }

  const isOwner = viewer.id !== undefined && String(course.instructor) === viewer.id;
  const isAdmin = viewer.role === "admin";
  if (!isOwner && !isAdmin) {
    const published = course.status === "published";
    if (published && lesson.isFreePreview) {
      // Free previews are open to everyone.
    } else if (!viewer.id) {
      throw ApiError.unauthorized("Sign in to access this lesson", "SIGN_IN_REQUIRED");
    } else {
      const enrolled = await EnrollmentModel.exists({
        user: viewer.id,
        course: course._id,
        status: { $in: ["active", "completed"] },
      });
      if (!enrolled) {
        throw ApiError.forbidden("Enroll in this course to access this lesson", "NOT_ENROLLED");
      }
    }
  }

  return {
    id: String(lesson._id),
    title: lesson.title,
    type: lesson.type,
    durationMinutes: lesson.durationMinutes,
    isFreePreview: lesson.isFreePreview,
    ...(lesson.videoUrl ? { videoUrl: lesson.videoUrl } : {}),
    ...(lesson.content ? { content: lesson.content } : {}),
    ...(lesson.fileUrl ? { fileUrl: lesson.fileUrl } : {}),
    ...(lesson.externalUrl ? { externalUrl: lesson.externalUrl } : {}),
    attachments: lesson.attachments,
  };
}
