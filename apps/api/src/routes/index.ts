import { Router } from "express";

import { healthRoutes } from "../modules/health/health.routes.js";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRoutes);
