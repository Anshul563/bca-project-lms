import { Router } from "express";

import { authenticate, authorize } from "../../middlewares/authenticate.js";
import * as quizController from "./quiz.controller.js";

export const quizRoutes = Router();

quizRoutes.use(authenticate);

/* ---------------------------- instructor ---------------------------- */
const instructorOnly = [authorize("instructor", "admin")] as const;

quizRoutes.post("/id/:id/quizzes", ...instructorOnly, quizController.upsertQuiz);
quizRoutes.get("/id/:id/quizzes", ...instructorOnly, quizController.getQuizForInstructor);
quizRoutes.get("/id/:courseId/quizzes/attempts", ...instructorOnly, quizController.listAttemptsForInstructor);

/* ------------------------------ student ------------------------------ */
quizRoutes.get("/id/:courseId/quiz", quizController.getQuizForStudent);
quizRoutes.post("/id/:courseId/quiz/attempts", quizController.submitAttempt);
quizRoutes.get("/id/:courseId/quiz/attempts/my", quizController.listMyAttempts);
