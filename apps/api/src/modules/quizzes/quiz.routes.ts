import { Router } from "express";

import { authenticate, authorize } from "../../middlewares/authenticate.js";
import * as quizController from "./quiz.controller.js";

// Mounted at /courses alongside the course and review routers. Auth is applied
// per-route (not via router.use) so unrelated /courses requests that fall
// through to this router are never accidentally authenticated-gated.
export const quizRoutes = Router();

/* ---------------------------- instructor ---------------------------- */
const instructorOnly = [authenticate, authorize("instructor", "admin")] as const;

quizRoutes.post("/id/:id/quizzes", ...instructorOnly, quizController.upsertQuiz);
quizRoutes.get("/id/:id/quizzes", ...instructorOnly, quizController.getQuizForInstructor);
quizRoutes.get("/id/:courseId/quizzes/attempts", ...instructorOnly, quizController.listAttemptsForInstructor);

/* ------------------------------ student ------------------------------ */
quizRoutes.get("/id/:courseId/quiz", authenticate, quizController.getQuizForStudent);
quizRoutes.post("/id/:courseId/quiz/attempts", authenticate, quizController.submitAttempt);
quizRoutes.get("/id/:courseId/quiz/attempts/my", authenticate, quizController.listMyAttempts);
