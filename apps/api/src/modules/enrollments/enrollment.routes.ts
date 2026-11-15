import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import * as enrollmentController from "./enrollment.controller.js";

export const enrollmentRoutes = Router();

enrollmentRoutes.use(authenticate);

enrollmentRoutes.post("/", enrollmentController.enroll);
enrollmentRoutes.get("/my", enrollmentController.listMyEnrollments);
enrollmentRoutes.delete("/:id", enrollmentController.cancelEnrollment);
