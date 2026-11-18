import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import * as reviewController from "./review.controller.js";

// Mounted at /courses alongside the course and quiz routers.
export const reviewRoutes = Router();

/* ------------------------------- public ------------------------------- */
reviewRoutes.get("/:slug/reviews", reviewController.listReviews);

/* ------------------------------- learner ------------------------------ */
const learnerOnly = [authenticate] as const;

reviewRoutes.get("/id/:courseId/reviews/my", ...learnerOnly, reviewController.getMyReview);
reviewRoutes.put("/id/:courseId/reviews/my", ...learnerOnly, reviewController.upsertMyReview);
reviewRoutes.delete("/id/:courseId/reviews/my", ...learnerOnly, reviewController.deleteMyReview);
