import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import * as progressController from "./progress.controller.js";

export const progressRoutes = Router();

progressRoutes.use(authenticate);

progressRoutes.get("/courses/:courseId", progressController.getProgress);
progressRoutes.post("/courses/:courseId/lessons/:lessonId/complete", progressController.completeLesson);
