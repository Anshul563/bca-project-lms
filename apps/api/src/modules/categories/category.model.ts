import mongoose, { type HydratedDocument, type Model } from "mongoose";
import type { PublicCategory } from "@lms/shared";

export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  parent?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

export type CategoryDoc = HydratedDocument<ICategory>;

const categorySchema = new mongoose.Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type CategoryModelType = Model<ICategory>;

export const CategoryModel =
  (mongoose.models.Category as CategoryModelType | undefined) ??
  mongoose.model<ICategory>("Category", categorySchema);

export function toPublicCategory(category: CategoryDoc | HydratedDocument<ICategory>): PublicCategory {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
  };
}
