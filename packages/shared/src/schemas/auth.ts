import { z } from "zod";

import {
  LOGIN_LOCKOUT_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../constants.js";

const preparedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

const passwordRequirements = [
  { regex: /[a-z]/, detail: "contain a lowercase letter" },
  { regex: /[A-Z]/, detail: "contain an uppercase letter" },
  { regex: /[0-9]/, detail: "contain a digit" },
];

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
  .superRefine((value, ctx) => {
    for (const { regex, detail } of passwordRequirements) {
      if (!regex.test(value)) {
        ctx.addIssue({ code: "custom", message: `Password must ${detail}` });
      }
    }
  });

export const registerBodySchema = z.object({
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  email: preparedEmail,
  password: strongPasswordSchema,
});

export const loginBodySchema = z.object({
  email: preparedEmail,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX_LENGTH),
});

export const forgotPasswordBodySchema = z.object({ email: preparedEmail });

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: strongPasswordSchema,
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: strongPasswordSchema,
});

export const verifyEmailBodySchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export const updateProfileBodySchema = z.object({
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH).optional(),
  avatar: z.string().trim().url().max(500).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export const instructorApplicationBodySchema = z.object({
  bio: z.string().trim().min(30).max(1000),
  website: z.string().trim().url().max(300).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
export type InstructorApplicationBody = z.infer<typeof instructorApplicationBodySchema>;

/**
 * Lockout shape shared between the login service and its rate limiter so the
 * frontend can render remaining wait time.
 */
export const loginLockout = {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
};
