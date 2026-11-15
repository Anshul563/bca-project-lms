import mongoose, { type HydratedDocument, type Model } from "mongoose";
import type { LessonType } from "@lms/shared";

export interface ILesson {
  course: mongoose.Types.ObjectId;
  section: mongoose.Types.ObjectId;
  title: string;
  type: LessonType;
  videoUrl?: string;
  content?: string;
  fileUrl?: string;
  externalUrl?: string;
  durationMinutes: number;
  isFreePreview: boolean;
  attachments: { name: string; url: string }[];
  order: number;
}

export type LessonDoc = HydratedDocument<ILesson>;

const lessonSchema = new mongoose.Schema<ILesson>(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["video", "article", "pdf", "link"], default: "video" },
    videoUrl: { type: String },
    content: { type: String },
    fileUrl: { type: String },
    externalUrl: { type: String },
    durationMinutes: { type: Number, default: 0 },
    isFreePreview: { type: Boolean, default: false },
    attachments: {
      type: [{ name: String, url: String }],
      default: [],
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

lessonSchema.index({ section: 1, order: 1 });
lessonSchema.index({ course: 1, isFreePreview: 1 });

export type LessonModelType = Model<ILesson>;

export const LessonModel =
  (mongoose.models.Lesson as LessonModelType | undefined) ??
  mongoose.model<ILesson>("Lesson", lessonSchema);
