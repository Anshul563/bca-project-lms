import type { ApiErrorDetail, PaginationMeta } from "@lms/shared";
import type { Response } from "express";

interface SendSuccessOptions {
  status?: number;
  message?: string;
  meta?: PaginationMeta;
}

export function sendSuccess<TData>(
  res: Response,
  data: TData,
  { status = 200, message, meta }: SendSuccessOptions = {},
): void {
  res.status(status).json({
    success: true as const,
    data,
    ...(message !== undefined && { message }),
    ...(meta !== undefined && { meta }),
  });
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  errors?: ApiErrorDetail[],
): void {
  res.status(status).json({
    success: false as const,
    message,
    ...(errors !== undefined && { errors }),
  });
}
