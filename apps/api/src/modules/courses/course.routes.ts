import { Router } from "express";

import { authenticate, authorize, optionalAuthenticate } from "../../middlewares/authenticate.js";
import * as courseController from "./course.controller.js";

export const courseRoutes = Router();

/* ------------------------------ public ------------------------------ */
courseRoutes.use(optionalAuthenticate);
courseRoutes.get("/", courseController.listCourses);
courseRoutes.get("/:slug", courseController.getCourse);

/* ---------------------------- instructor ---------------------------- */
const instructorOnly = [authenticate, authorize("instructor", "admin")] as const;

courseRoutes.post("/", ...instructorOnly, courseController.createCourse);
courseRoutes.get("/mine/all", ...instructorOnly, courseController.listMyCourses);
courseRoutes.get("/id/:id", ...instructorOnly, courseController.getMyCourse);
courseRoutes.patch("/id/:id", ...instructorOnly, courseController.updateCourse);
courseRoutes.delete("/id/:id", ...instructorOnly, courseController.deleteCourse);
courseRoutes.post("/id/:id/submit-for-review", ...instructorOnly, courseController.submitCourseForReview);

courseRoutes.post("/id/:courseId/sections", ...instructorOnly, courseController.createSection);
courseRoutes.patch("/id/:courseId/sections/:sectionId", ...instructorOnly, courseController.updateSection);
courseRoutes.delete("/id/:courseId/sections/:sectionId", ...instructorOnly, courseController.deleteSection);
courseRoutes.put("/id/:courseId/sections/reorder", ...instructorOnly, courseController.reorderSections);

courseRoutes.post("/id/:courseId/sections/:sectionId/lessons", ...instructorOnly, courseController.createLesson);
courseRoutes.patch("/id/:courseId/lessons/:lessonId", ...instructorOnly, courseController.updateLesson);
courseRoutes.delete("/id/:courseId/lessons/:lessonId", ...instructorOnly, courseController.deleteLesson);
courseRoutes.put("/id/:courseId/sections/:sectionId/lessons/reorder", ...instructorOnly, courseController.reorderLessons);
