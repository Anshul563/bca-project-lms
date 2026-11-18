import mongoose, { type HydratedDocument, type Model } from "mongoose";
import type { CourseLevel, CourseStatus } from "@lms/shared";

export interface ICourse {
  title: string;
  slug: string;
  subtitle?: string;
  description: string;
  thumbnail?: string;
  previewVideoUrl?: string;
  categoryId?: mongoose.Types.ObjectId;
  tags: string[];
  level: CourseLevel;
  language: string;
  price: number;
  instructor: mongoose.Types.ObjectId;
  status: CourseStatus;
  requirements: string[];
  learningOutcomes: string[];
  ratingAverage: number;
  ratingCount: number;
  enrollmentCount: number;
  totalDurationMinutes: number;
  publishedAt?: Date;
  /** Admin feedback after a rejected review submission (cleared on approval). */
  reviewNote?: string;
  deletedAt?: Date | null;
  createdAt: Date;
}

export type CourseDoc = HydratedDocument<ICourse>;

const courseSchema = new mongoose.Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true },
    subtitle: { type: String, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10_000 },
    thumbnail: { type: String },
    previewVideoUrl: { type: String },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    tags: { type: [String], default: [] },
    level: { type: String, enum: ["beginner", "intermediate", "advanced", "all_levels"], default: "beginner", index: true },
    language: { type: String, default: "English", index: true },
    price: { type: Number, default: 0, min: 0 },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "archived"],
      default: "draft",
      index: true,
    },
    requirements: { type: [String], default: [] },
    learningOutcomes: { type: [String], default: [] },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    enrollmentCount: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
    publishedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/** Catalog queries: published + non-deleted, by recency or popularity. */
courseSchema.index({ status: 1, deletedAt: 1, createdAt: -1 });
courseSchema.index({ status: 1, deletedAt: 1, ratingAverage: -1 });
courseSchema.index({ status: 1, deletedAt: 1, enrollmentCount: -1 });
courseSchema.index({ instructor: 1, status: 1 });

// Text search across title/subtitle/tags for the catalog search box.
courseSchema.index(
  { title: "text", subtitle: "text", tags: "text" },
  { name: "course_text_search", weights: { title: 10, subtitle: 5, tags: 3 } },
);

export type CourseModelType = Model<ICourse>;

export const CourseModel =
  (mongoose.models.Course as CourseModelType | undefined) ??
  mongoose.model<ICourse>("Course", courseSchema);
