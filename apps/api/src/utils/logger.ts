import pino from "pino";

import { env } from "../config/env.js";

/** Root application logger (pino). Request-scoped logging uses pino-http. */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "lms-api", env: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.currentPassword",
      "body.newPassword",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = pino.Logger;
