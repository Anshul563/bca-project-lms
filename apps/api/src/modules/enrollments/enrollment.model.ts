import mongoose, { type HydratedDocument, type Model } from "mongoose";
import type { EnrollmentStatus } from "@lms/shared";

export interface IEnrollment {
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  status: EnrollmentStatus;
  progressPercent: number;
  lastAccessedLesson?: mongoose.Types.ObjectId;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
}

export type EnrollmentDoc = HydratedDocument<IEnrollment>;

const enrollmentSchema = new mongoose.Schema<IEnrollment>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    status: { type: String, enum: ["active", "completed", "cancelled"], default: "active", index: true },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    lastAccessedLesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

// One enrollment per user per course.
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, status: 1, createdAt: -1 });
enrollmentSchema.index({ course: 1 });

export type EnrollmentModelType = Model<IEnrollment>;

export const EnrollmentModel =
  (mongoose.models.Enrollment as EnrollmentModelType | undefined) ??
  mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
