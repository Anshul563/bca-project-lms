import { categoryCreateSchema, categoryUpdateSchema, idParamsSchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { CategoryModel } from "./category.model.js";
import * as courseService from "../courses/course.service.js";

function toPublicCategory(category: { _id: unknown; name: string; slug: string; description?: string | null }) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
  };
}

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const result = await courseService.listCategories();
  sendSuccess(res, result.items);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const category = await CategoryModel.findOne({ _id: id, deletedAt: null });
  if (!category) {
    throw ApiError.notFound("Category not found");
  }
  sendSuccess(res, toPublicCategory(category));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const body = categoryCreateSchema.parse(req.body);
  const category = await courseService.createCategory({
    ...body,
    ...(body.parent ? { parent: body.parent } : { parent: null }),
  });
  sendSuccess(res, toPublicCategory(category), { status: 201 });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const body = categoryUpdateSchema.parse(req.body);
  const category = await CategoryModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: body },
    { new: true, runValidators: true },
  );
  if (!category) {
    throw ApiError.notFound("Category not found");
  }
  sendSuccess(res, toPublicCategory(category), { message: "Category updated" });
});

/** Soft-deletes a category. Published courses keep functioning; they just lose the link. */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const result = await CategoryModel.updateOne({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date() } });
  if (result.matchedCount === 0) {
    throw ApiError.notFound("Category not found");
  }
  sendSuccess(res, null, { message: "Category deleted" });
});
