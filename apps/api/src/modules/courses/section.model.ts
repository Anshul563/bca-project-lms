import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface ISection {
  course: mongoose.Types.ObjectId;
  title: string;
  order: number;
}

export type SectionDoc = HydratedDocument<ISection>;

const sectionSchema = new mongoose.Schema<ISection>(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

sectionSchema.index({ course: 1, order: 1 });

export type SectionModelType = Model<ISection>;

export const SectionModel =
  (mongoose.models.Section as SectionModelType | undefined) ??
  mongoose.model<ISection>("Section", sectionSchema);
