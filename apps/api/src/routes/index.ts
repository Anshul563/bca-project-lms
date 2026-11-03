import { Router } from "express";

import { healthRoutes } from "../modules/health/health.routes.js";
import { authRoutes } from "./../modules/auth/auth.routes.js";
import { userRoutes } from "./../modules/users/users.routes.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRoutes);
apiV1Router.use("/auth", authRoutes);
apiV1Router.use("/users", userRoutes);
