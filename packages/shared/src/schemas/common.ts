import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

/** MongoDB ObjectId shape, usable in params validation before DB lookup. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format: lowercase words separated by hyphens");

/** Reshape a param-only schema (e.g. { id }) into a params object. */
export const idParamsSchema = z.object({ id: objectIdSchema });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const SORT_DIRECTIONS = { asc: "asc", desc: "desc" } as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS];

/** Pick the given cursor keys out of raw query/search params before parsing. */
export const listQuerySchema = paginationQuerySchema.extend({
  sortBy: z.string().max(50).optional(),
  sortDir: z.enum(SORT_DIRECTIONS).default("asc"),
  search: z.string().trim().max(200).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
