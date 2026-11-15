import type { ApiErrorDetail, PaginationMeta } from "@lms/shared";

/**
 * Typed fetch wrapper for the LMS API.
 *
 * - Parses the `{ success, data | message, errors? }` envelope.
 * - Holds the short-lived access token in memory.
 * - On `401 TOKEN_EXPIRED`, silently rotates the refresh cookie once
 *   (single-flight so parallel requests share one refresh) and retries.
 */

const rawBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";
const apiUrl = `${rawBase.replace(/\/$/, "")}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiErrorDetail[];

  constructor(status: number, message: string, code = "REQUEST_FAILED", fieldErrors: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  method?: ApiMethod;
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: prevents infinite retry loops. */
  skipAuthRetry?: boolean;
}

interface EnvelopeOk<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

interface EnvelopeFail {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Exchanges the httpOnly refresh cookie for a new access token. */
export async function refreshSession(): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const envelope = (await res.json()) as EnvelopeOk<{ accessToken: string }>;
    setAccessToken(envelope.data.accessToken);
    return envelope.data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

/** Single-flight refresh shared by concurrent failing requests. */
export function refreshSessionOnce(): Promise<string | null> {
  refreshInFlight ??= refreshSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function rawFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    signal: options.signal,
  });
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = payload as EnvelopeOk<T> | EnvelopeFail | null;
  if (response.ok && envelope?.success === true) {
    return envelope.data;
  }

  if (envelope && envelope.success === false) {
    throw new ApiError(response.status, envelope.message, codeFromErrors(envelope.errors), envelope.errors ?? []);
  }
  throw new ApiError(response.status, response.statusText || "Request failed");
}

function codeFromErrors(errors?: ApiErrorDetail[]): string {
  return errors?.[0]?.code ?? "REQUEST_FAILED";
}

/** Core request: returns the envelope `data` or throws `ApiError`. */
export async function apiFetch<TData>(path: string, options: ApiRequestOptions = {}): Promise<TData> {
  const response = await rawFetch(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshSessionOnce();
    if (refreshed) {
      const retry = await rawFetch(path, { ...options, skipAuthRetry: true });
      return parseEnvelope<TData>(retry);
    }
  }

  return parseEnvelope<TData>(response);
}

/** Like `apiFetch`, but also surfaces the envelope's pagination `meta`. */
export async function apiFetchWithMeta<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ data: TData; meta?: PaginationMeta }> {
  const response = await rawFetch(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshSessionOnce();
    if (refreshed) {
      const retry = await rawFetch(path, { ...options, skipAuthRetry: true });
      return parseEnvelopeWithMeta<TData>(retry);
    }
  }

  return parseEnvelopeWithMeta<TData>(response);
}

async function parseEnvelopeWithMeta<T>(response: Response): Promise<{ data: T; meta?: PaginationMeta }> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = payload as EnvelopeOk<T> | EnvelopeFail | null;
  if (response.ok && envelope?.success === true) {
    return { data: envelope.data, ...(envelope.meta ? { meta: envelope.meta } : {}) };
  }

  if (envelope && envelope.success === false) {
    throw new ApiError(response.status, envelope.message, codeFromErrors(envelope.errors), envelope.errors ?? []);
  }
  throw new ApiError(response.status, response.statusText || "Request failed");
}

/** Mutations used by forms; returns `{ data }` or a serializable failure. */
export async function tryApi<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ ok: true; data: TData } | { ok: false; error: ApiError }> {
  try {
    return { ok: true, data: await apiFetch<TData>(path, options) };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error };
    }
    return { ok: false, error: new ApiError(0, "Network error — is the API running?", "NETWORK") };
  }
}
