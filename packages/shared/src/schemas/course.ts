import { z } from "zod";

import { COURSE_LEVELS } from "../enums.js";
import { COURSE_SLUG_MAX_LENGTH } from "../constants.js";
import { listQuerySchema, objectIdSchema, slugSchema } from "./common.js";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema.max(COURSE_SLUG_MAX_LENGTH).optional(),
  description: z.string().trim().max(500).optional(),
  parent: objectIdSchema.nullish(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const courseCreateSchema = z.object({
  title: z.string().trim().min(5).max(120),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(30).max(10_000),
  categoryId: objectIdSchema.optional(),
  level: z.enum(COURSE_LEVELS).default("beginner"),
  language: z.string().trim().min(2).max(40).default("English"),
  price: z.coerce.number().min(0).max(100_000).default(0),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  requirements: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  learningOutcomes: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
});

export const courseUpdateSchema = courseCreateSchema
  .partial()
  .extend({
    thumbnail: z.string().trim().max(500).optional(),
    previewVideoUrl: z.string().trim().max(500).optional(),
  });

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

export const sectionCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
});

export type SectionCreateInput = z.infer<typeof sectionCreateSchema>;

export const lessonAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1).max(500),
});

export const lessonCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.enum(["video", "article", "pdf", "link"]).default("video"),
  videoUrl: z.string().trim().max(500).optional(),
  content: z.string().max(20_000).optional(),
  fileUrl: z.string().trim().max(500).optional(),
  externalUrl: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(600).default(0),
  isFreePreview: z.boolean().default(false),
  attachments: z.array(lessonAttachmentSchema).max(10).default([]),
});

export const lessonUpdateSchema = lessonCreateSchema.partial();

export type LessonCreateInput = z.infer<typeof lessonCreateSchema>;
export type LessonUpdateInput = z.infer<typeof lessonUpdateSchema>;

export const reorderSchema = z.object({
  orderedIds: z.array(objectIdSchema).min(1),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

export const enrollBodySchema = z.object({
  courseId: objectIdSchema,
});

export type EnrollInput = z.infer<typeof enrollBodySchema>;

export const listEnrollmentsQuerySchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;

export const courseIdParamsSchema = z.object({
  courseId: objectIdSchema,
});

export const lessonParamsSchema = z.object({
  courseId: objectIdSchema,
  lessonId: objectIdSchema,
});

/** Public catalog filters (all optional). */
export const courseListQuerySchema = listQuerySchema.extend({
  category: slugSchema.optional(),
  level: z.enum(COURSE_LEVELS).optional(),
  language: z.string().trim().max(40).optional(),
  priceType: z.enum(["free", "paid"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["newest", "popular", "rating", "price_asc", "price_desc"]).default("newest"),
});

export type CourseListQuery = z.infer<typeof courseListQuerySchema>;
