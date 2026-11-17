import { Router } from "express";

import { healthRoutes } from "../modules/health/health.routes.js";
import { authRoutes } from "./../modules/auth/auth.routes.js";
import { userRoutes } from "./../modules/users/users.routes.js";
import { categoryRoutes } from "./../modules/categories/category.routes.js";
import { courseRoutes } from "./../modules/courses/course.routes.js";
import { enrollmentRoutes } from "./../modules/enrollments/enrollment.routes.js";
import { progressRoutes } from "./../modules/progress/progress.routes.js";
import { quizRoutes } from "./../modules/quizzes/quiz.routes.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRoutes);
apiV1Router.use("/auth", authRoutes);
apiV1Router.use("/users", userRoutes);
apiV1Router.use("/categories", categoryRoutes);
apiV1Router.use("/courses", courseRoutes);
apiV1Router.use("/enrollments", enrollmentRoutes);
apiV1Router.use("/progress", progressRoutes);
apiV1Router.use("/courses", quizRoutes);
