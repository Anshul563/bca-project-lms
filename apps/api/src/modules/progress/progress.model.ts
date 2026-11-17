import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface ILessonProgress {
  user: mongoose.Types.ObjectId;
  lesson: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  completedAt: Date;
}

export type LessonProgressDoc = HydratedDocument<ILessonProgress>;

const lessonProgressSchema = new mongoose.Schema<ILessonProgress>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// One completion record per user per lesson.
lessonProgressSchema.index({ user: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ user: 1, course: 1 });

export type LessonProgressModelType = Model<ILessonProgress>;

export const LessonProgressModel =
  (mongoose.models.LessonProgress as LessonProgressModelType | undefined) ??
  mongoose.model<ILessonProgress>("LessonProgress", lessonProgressSchema);
