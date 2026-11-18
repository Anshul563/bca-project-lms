import { Router } from "express";

import { authenticate, authorize } from "../../middlewares/authenticate.js";
import { uploadFile, uploadSingleFile } from "./upload.controller.js";

export const uploadRoutes = Router();

// Only instructors/admins upload media (course thumbnails, lesson materials).
uploadRoutes.post("/", authenticate, authorize("instructor", "admin"), uploadSingleFile, uploadFile);
