import mongoose from "mongoose";

import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// Enable server-side filter sanitization so injected query operators
// (e.g. `$ne`, `$regex`) can never reach the database.
mongoose.set("sanitizeFilter", true);

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
