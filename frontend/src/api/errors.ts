import { AxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export type FieldErrors = Record<string, string[]>;

/** Every failed API call rejects with this, whatever went wrong underneath. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, code: string, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Partial<ApiErrorBody>).code === "string" &&
    typeof (data as Partial<ApiErrorBody>).detail === "string"
  );
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "That request wasn't valid.",
  401: "Please log in to continue.",
  403: "You don't have permission to do that.",
  404: "We couldn't find that.",
  429: "Too many attempts. Wait a minute and try again.",
  500: "Something went wrong on our side. Please try again.",
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (!error.response) {
      return new ApiError(0, "network_error", "Can't reach the server. Check your connection.");
    }
    const { status, data } = error.response;
    if (isApiErrorBody(data) && status !== 429) {
      return new ApiError(status, data.code, data.detail, data.errors);
    }
    const message = FALLBACK_MESSAGES[status] ?? FALLBACK_MESSAGES[500];
    return new ApiError(status, "http_error", message);
  }
  return new ApiError(0, "unknown_error", "Something unexpected went wrong.");
}
