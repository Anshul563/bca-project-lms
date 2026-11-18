import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface IReview {
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDoc = HydratedDocument<IReview>;

const reviewSchema = new mongoose.Schema<IReview>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One review per learner per course.
reviewSchema.index({ course: 1, user: 1 }, { unique: true });
reviewSchema.index({ course: 1, createdAt: -1 });

export type ReviewModelType = Model<IReview>;

export const ReviewModel =
  (mongoose.models.Review as ReviewModelType | undefined) ?? mongoose.model<IReview>("Review", reviewSchema);
