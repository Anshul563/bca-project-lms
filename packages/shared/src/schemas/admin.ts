import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  COURSE_STATUSES,
  INSTRUCTOR_APPLICATION_STATUSES,
  USER_ROLES,
} from "../enums.js";
import { paginationQuerySchema } from "./common.js";

/* ------------------------- instructor applications ------------------------- */

export const adminApplicationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(INSTRUCTOR_APPLICATION_STATUSES).optional(),
});

export const adminApplicationReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.action !== "reject" || (value.reason?.length ?? 0) >= 3, {
    message: "A rejection reason (at least 3 characters) is required",
    path: ["reason"],
  });

export type AdminApplicationReviewInput = z.infer<typeof adminApplicationReviewSchema>;

/* -------------------------------- users -------------------------------- */

export const adminUserListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide at least one of: role, status",
  });

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

/* ------------------------------- courses ------------------------------- */

export const adminCourseListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(COURSE_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
});

export const adminCourseReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.action !== "reject" || (value.note?.length ?? 0) >= 3, {
    message: "A rejection note (at least 3 characters) is required",
    path: ["note"],
  });

export type AdminCourseReviewInput = z.infer<typeof adminCourseReviewSchema>;
