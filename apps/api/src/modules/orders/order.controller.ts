import { idParamsSchema, orderBodySchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as orderService from "./order.service.js";

function callerId(req: Request): string {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user.id;
}

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = orderBodySchema.parse(req.body);
  const order = await orderService.createOrder(callerId(req), body.courseId);
  sendSuccess(res, order, { status: 201, message: "Order created" });
});

export const payOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const order = await orderService.payOrder(callerId(req), id);
  sendSuccess(res, order, { message: "Payment confirmed — you're enrolled" });
});

export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await orderService.listMyOrders(callerId(req));
  sendSuccess(res, orders);
});
