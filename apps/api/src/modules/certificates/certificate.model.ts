import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface ICertificate {
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  /** Human-verifiable code, e.g. `LMS-2026-A1B2C3D4`. */
  serial: string;
  issuedAt: Date;
  /** Quiz score captured at issuance (when the course has a quiz). */
  quizScorePercent?: number;
  lessonsCompleted: number;
  totalLessons: number;
}

export type CertificateDoc = HydratedDocument<ICertificate>;

const certificateSchema = new mongoose.Schema<ICertificate>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    serial: { type: String, required: true, unique: true, index: true },
    issuedAt: { type: Date, required: true },
    quizScorePercent: { type: Number, min: 0, max: 100 },
    lessonsCompleted: { type: Number, required: true, min: 0 },
    totalLessons: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// One certificate per learner per course — issuance is idempotent.
certificateSchema.index({ user: 1, course: 1 }, { unique: true });
certificateSchema.index({ user: 1, issuedAt: -1 });

export type CertificateModelType = Model<ICertificate>;

export const CertificateModel =
  (mongoose.models.Certificate as CertificateModelType | undefined) ??
  mongoose.model<ICertificate>("Certificate", certificateSchema);
