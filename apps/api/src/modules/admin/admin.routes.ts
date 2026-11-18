import { Router } from "express";

import { authenticate, authorize } from "../../middlewares/authenticate.js";
import * as adminController from "./admin.controller.js";

// Dedicated /admin prefix — router-level auth is safe here (no public paths
// share this mount).
export const adminRoutes = Router();

adminRoutes.use(authenticate, authorize("admin"));

adminRoutes.get("/instructor-applications", adminController.listInstructorApplications);
adminRoutes.patch("/instructor-applications/:id", adminController.reviewInstructorApplication);

adminRoutes.get("/users", adminController.listUsers);
adminRoutes.patch("/users/:id", adminController.updateUser);

adminRoutes.get("/courses", adminController.listCourses);
adminRoutes.patch("/courses/:id/review", adminController.reviewCourse);
