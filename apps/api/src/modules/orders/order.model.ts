import mongoose, { type HydratedDocument, type Model } from "mongoose";

export const ORDER_STATUSES = ["pending", "paid", "failed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrder {
  user: mongoose.Types.ObjectId;
  course: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: OrderStatus;
  provider: "mock";
  providerRef?: string;
  paidAt?: Date;
  createdAt: Date;
}

export type OrderDoc = HydratedDocument<IOrder>;

const orderSchema = new mongoose.Schema<IOrder>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD", uppercase: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    provider: { type: String, enum: ["mock"], default: "mock" },
    providerRef: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

// Fast lookup of a learner's orders and pending-order reuse.
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, course: 1, status: 1 });

export type OrderModelType = Model<IOrder>;

export const OrderModel =
  (mongoose.models.Order as OrderModelType | undefined) ?? mongoose.model<IOrder>("Order", orderSchema);
