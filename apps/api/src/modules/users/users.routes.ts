import { Router } from "express";

import { updateProfileBodySchema } from "@lms/shared";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { authenticate } from "../../middlewares/authenticate.js";
import * as authService from "../auth/auth.service.js";

export const userRoutes = Router();

/** Profile of the signed-in user (self service). */
userRoutes.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const user = await authService.getMe(req.user.id);
    sendSuccess(res, user);
  }),
);

userRoutes.patch(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const body = updateProfileBodySchema.parse(req.body);
    const user = await authService.updateProfile(req.user.id, body);
    sendSuccess(res, user, { message: "Profile updated" });
  }),
);
