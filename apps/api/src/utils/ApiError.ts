import type { ApiErrorDetail } from "@lms/shared";

/**
 * Operational error carrying an HTTP status and machine-readable code.
 * Services throw this; the error handler turns it into the response envelope.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: ApiErrorDetail[]): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED"): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(message = "You do not have access to this resource", code = "FORBIDDEN"): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND"): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT", details?: ApiErrorDetail[]): ApiError {
    return new ApiError(409, code, message, details);
  }

  static validation(message: string, details: ApiErrorDetail[]): ApiError {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }

  static tooManyRequests(message = "Too many requests, please slow down", code = "RATE_LIMITED"): ApiError {
    return new ApiError(429, code, message);
  }

  static internal(message = "Something went wrong", code = "INTERNAL_ERROR"): ApiError {
    return new ApiError(500, code, message);
  }
}
