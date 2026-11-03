import mongoose, { type HydratedDocument, type Model, type InferSchemaType } from "mongoose";
import type { InstructorApplicationStatus } from "@lms/shared";

export const INSTRUCTOR_APPLICATION_STATUSES_MONGO: readonly InstructorApplicationStatus[] = [
  "pending",
  "approved",
  "rejected",
] as const;

const instructorApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    bio: { type: String, required: true, trim: true, maxlength: 1000 },
    website: { type: String },
    status: {
      type: String,
      enum: INSTRUCTOR_APPLICATION_STATUSES_MONGO,
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

instructorApplicationSchema.index({ status: 1, createdAt: -1 });

export type InstructorApplicationDoc = HydratedDocument<InferSchemaType<typeof instructorApplicationSchema>>;

export const InstructorApplicationModel =
  (mongoose.models.InstructorApplication as Model<InferSchemaType<typeof instructorApplicationSchema>> | undefined) ??
  mongoose.model("InstructorApplication", instructorApplicationSchema);
