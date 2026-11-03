/** Details of a single validation / domain error surfaced to clients. */
export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

/** Pagination metadata attached to list responses. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Successful response envelope: `{ success, data, message?, meta? }`. */
export interface ApiEnvelope<TData = unknown> {
  success: true;
  data: TData;
  message?: string;
  meta?: PaginationMeta;
}

/** Error response envelope: `{ success, message, errors? }`. */
export interface ApiErrorEnvelope {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
}

export type ApiResponseBody<TData = unknown> = ApiEnvelope<TData> | ApiErrorEnvelope;

/** Utility for controllers returning pages of T. */
export type Paginated<T> = { items: T[] } & { meta: PaginationMeta };
