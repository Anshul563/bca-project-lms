import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";
import * as authController from "./auth.controller.js";

export const authRoutes = Router();

// Brute-force sensitive endpoints carry a stricter, failure-counting limit.
authRoutes.post("/register", authLimiter, authController.register);
authRoutes.post("/login", authLimiter, authController.login);
authRoutes.post("/refresh", authController.refresh);
authRoutes.post("/logout", authController.logout);
authRoutes.post("/verify-email", authLimiter, authController.verifyEmail);
authRoutes.post("/forgot-password", authLimiter, authController.forgotPassword);
authRoutes.post("/reset-password", authLimiter, authController.resetPassword);

// Authenticated-only endpoints below this mount.
authRoutes.use(authenticate);
authRoutes.get("/me", authController.me);
authRoutes.post("/change-password", authController.changePassword);
authRoutes.post("/apply-instructor", authController.applyInstructor);
