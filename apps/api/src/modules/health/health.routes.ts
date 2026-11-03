import { Router } from "express";
import mongoose from "mongoose";

import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export const healthRoutes = Router();

export const DB_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
} as const;

export type DatabaseState = (typeof DB_STATES)[keyof typeof DB_STATES] | "unknown";

export function getDatabaseState(readyState: number): DatabaseState {
  return DB_STATES[readyState as keyof typeof DB_STATES] ?? "unknown";
}

/**
 * GET /api/v1/health — liveness + database readiness.
 * 200 when the API can serve traffic and Mongo is reachable, 503 otherwise.
 */
healthRoutes.get("/", (_req, res) => {
  const readyState = mongoose.connection.readyState;
  const dbReady = readyState === 1;
  const payload = {
    status: dbReady ? "ok" : "degraded",
    env: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    database: getDatabaseState(readyState),
  };
  sendSuccess(res, payload, { status: dbReady ? 200 : 503 });
});
