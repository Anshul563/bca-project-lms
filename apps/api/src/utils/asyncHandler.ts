import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

/**
 * Express 5 forwards rejected handler promises to the error middleware by
 * itself, but wrapping keeps call sites synchronous and typed for handlers
 * that also do non-promise work; behaviorally it is pass-through.
 */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
