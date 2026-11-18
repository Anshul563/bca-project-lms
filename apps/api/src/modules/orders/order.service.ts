import { randomBytes } from "node:crypto";

import type { PublicOrder } from "@lms/shared";
import type { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError.js";
import { CourseModel } from "../courses/course.model.js";
import { activateEnrollmentRecord } from "../enrollments/enrollment.service.js";
import { EnrollmentModel } from "../enrollments/enrollment.model.js";
import { OrderModel } from "./order.model.js";

/**
 * Payment provider abstraction. The MVP ships a deterministic mock that
 * "charges" immediately; a real provider (Stripe/Razorpay) implements the same
 * `charge` contract plus webhook-driven confirmation.
 */
interface PaymentProvider {
  charge(input: { orderId: string; amount: number; currency: string }): Promise<{ providerRef: string }>;
}

const mockProvider: PaymentProvider = {
  async charge(input) {
    return { providerRef: `mock_${input.orderId}_${randomBytes(3).toString("hex")}` };
  },
};

const provider = mockProvider;

interface LeanOrder {
  _id: Types.ObjectId;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  provider: "mock";
  paidAt?: Date;
  createdAt: Date;
  course: { _id: Types.ObjectId; slug: string; title: string; thumbnail?: string } | Types.ObjectId | null;
}

function toPublicOrder(order: LeanOrder): PublicOrder {
  const populated =
    order.course && typeof order.course === "object"
      ? (order.course as { _id: Types.ObjectId; slug: string; title: string; thumbnail?: string })
      : null;
  const course = populated
    ? {
        id: String(populated._id),
        slug: populated.slug,
        title: populated.title,
        ...(populated.thumbnail ? { thumbnail: populated.thumbnail } : {}),
      }
    : null;
  return {
    id: String(order._id),
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    createdAt: order.createdAt.toISOString(),
    ...(order.paidAt ? { paidAt: order.paidAt.toISOString() } : {}),
    course,
  };
}

const COURSE_POPULATE = { path: "course", select: "slug title thumbnail" } as const;

/**
 * Creates (or reuses) a pending order for a paid course. Free courses and
 * already-enrolled learners are rejected — they should not be paying twice.
 */
export async function createOrder(userId: string, courseId: string): Promise<PublicOrder> {
  const course = await CourseModel.findOne({
    _id: courseId,
    status: "published",
    deletedAt: null,
  });
  if (!course) {
    throw ApiError.notFound("Course not found or not open for enrollment");
  }
  if (course.price <= 0) {
    throw ApiError.badRequest("This course is free — enroll directly", "FREE_COURSE");
  }

  const enrolled = await EnrollmentModel.exists({
    user: userId,
    course: course._id,
    status: { $in: ["active", "completed"] },
  });
  if (enrolled) {
    throw ApiError.conflict("You are already enrolled in this course", "ALREADY_ENROLLED");
  }

  // Reuse an existing pending order so double clicks don't pile up orders.
  const pending = await OrderModel.findOne({ user: userId, course: course._id, status: "pending" });
  const order =
    pending ??
    (await OrderModel.create({
      user: userId,
      course: course._id,
      amount: course.price,
      currency: "USD",
      provider: "mock",
    }));

  const populated = await OrderModel.findById(order._id).populate(COURSE_POPULATE).lean();
  return toPublicOrder(populated as unknown as LeanOrder);
}

/**
 * Mock checkout confirmation: charges the provider, marks the order paid and
 * activates the enrollment. Idempotent for already-paid orders.
 */
export async function payOrder(userId: string, orderId: string): Promise<PublicOrder> {
  const order = await OrderModel.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw ApiError.notFound("Order not found");
  }

  if (order.status === "paid") {
    const populated = await OrderModel.findById(order._id).populate(COURSE_POPULATE).lean();
    return toPublicOrder(populated as unknown as LeanOrder);
  }
  if (order.status !== "pending") {
    throw ApiError.conflict("This order can no longer be paid", "ORDER_NOT_PENDING");
  }

  const course = await CourseModel.findOne({ _id: order.course, status: "published", deletedAt: null });
  if (!course) {
    throw ApiError.conflict("This course is no longer available for purchase", "COURSE_UNAVAILABLE");
  }

  const { providerRef } = await provider.charge({
    orderId: String(order._id),
    amount: order.amount,
    currency: order.currency,
  });

  order.status = "paid";
  order.providerRef = providerRef;
  order.paidAt = new Date();
  await order.save();

  // Payment success is the enrollment moment. If the learner was already
  // enrolled (e.g. a free grant landed first), activation is skipped.
  try {
    await activateEnrollmentRecord(userId, course);
  } catch (error) {
    const isAlreadyEnrolled =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ALREADY_ENROLLED";
    if (!isAlreadyEnrolled) {
      throw error;
    }
  }

  const populated = await OrderModel.findById(order._id).populate(COURSE_POPULATE).lean();
  return toPublicOrder(populated as unknown as LeanOrder);
}

export async function listMyOrders(userId: string): Promise<PublicOrder[]> {
  const orders = await OrderModel.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate(COURSE_POPULATE)
    .lean();
  return (orders as unknown as LeanOrder[]).map(toPublicOrder);
}
