import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import * as orderController from "./order.controller.js";

export const orderRoutes = Router();

orderRoutes.use(authenticate);

orderRoutes.post("/", orderController.createOrder);
orderRoutes.get("/my", orderController.listMyOrders);
orderRoutes.post("/:id/pay", orderController.payOrder);
