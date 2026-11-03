import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { apiV1Router } from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import { globalLimiter } from "./middlewares/rateLimiter.js";
import { sanitizeBody } from "./utils/sanitize.js";
import { logger } from "./utils/logger.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url !== undefined && req.url.startsWith("/api/v1/health"),
      },
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id =
          typeof existing === "string" && existing.length > 0 ? existing : randomUUID();
        res.setHeader("x-request-id", id);
        req.id = id;
        return id;
      },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());
  app.use(compression());
  app.use(sanitizeBody);
  app.use(globalLimiter);

  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
