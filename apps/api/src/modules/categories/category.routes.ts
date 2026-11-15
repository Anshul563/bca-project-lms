import { Router } from "express";

import { authenticate, authorize } from "../../middlewares/authenticate.js";
import * as categoryController from "./category.controller.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", categoryController.listCategories);
categoryRoutes.get("/:id", categoryController.getCategory);

categoryRoutes.use(authenticate, authorize("admin"));
categoryRoutes.post("/", categoryController.createCategory);
categoryRoutes.patch("/:id", categoryController.updateCategory);
categoryRoutes.delete("/:id", categoryController.deleteCategory);
