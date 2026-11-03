import type { NextFunction, Request, RequestHandler, Response } from "express";

const MONGO_OPERATOR_PATTERN = /^\$/;
const MONGO_KEY_DOTS = /\./;

/**
 * Recursively remove Mongo operator keys (`$...`, dotted paths) from a value,
 * preventing NoSQL injection through parsed request bodies.
 */
export function stripMongoOperators(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripMongoOperators);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (MONGO_OPERATOR_PATTERN.test(key) || MONGO_KEY_DOTS.test(key)) {
        continue;
      }
      result[key] = stripMongoOperators(item);
    }
    return result;
  }
  return value;
}

/**
 * Sanitize request body in place. Query strings are protected separately by
 * Mongoose's `sanitizeFilter`; route params are whitelisted at the router.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
    req.body = stripMongoOperators(req.body);
  }
  next();
}

/** Utility reused by file-upload validators. */
export function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 200);
}

export const sanitizerMiddleware: RequestHandler = sanitizeBody;
