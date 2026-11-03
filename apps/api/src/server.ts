import "dotenv/config";

import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

export async function startServer(): Promise<void> {
  const app = createApp();

  try {
    await connectDatabase();
  } catch (error) {
    logger.error({ error }, "Failed to connect to MongoDB at boot");
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception, exiting");
  process.exit(1);
});

startServer().catch((error) => {
  logger.fatal({ error }, "Fatal error during server startup");
  process.exit(1);
});
