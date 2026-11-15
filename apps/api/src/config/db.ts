import mongoose from "mongoose";

import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// NOTE: `sanitizeFilter` is intentionally NOT enabled. It wraps every value
// containing `$`-operators in `$eq`, which breaks all standard operator
// queries ($gt, $elemMatch, $in...). It is only needed when raw user objects
// flow into filters; here every filter is built server-side from Zod-validated
// scalars, and request bodies pass through the in-house sanitizer first.
// See docs/DECISIONS.md ("NoSQL injection strategy").

if (env.NODE_ENV === "development") {
  mongoose.set("debug", (collection, method, arg1, arg2) => {
    logger.debug({ collection, method, arg1, arg2 }, "mongoose");
  });
}

export async function connectDatabase(databaseUri = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (error) => logger.error({ error }, "MongoDB error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  return mongoose.connect(databaseUri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
