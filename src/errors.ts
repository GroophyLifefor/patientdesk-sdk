import type { PatientDeskErrorBody, PatientDeskErrorDetails } from "./types.js";

export interface PatientDeskErrorInit {
  status: number;
  code?: string;
  body?: PatientDeskErrorBody | unknown;
  retryAfterSeconds?: number;
  resetAt?: string;
}

/**
 * Error thrown for any non-2xx response (and transport failures wrapped by the
 * client). Carries the parsed PatientDesk error shape plus the rate-limit
 * fields so callers can schedule a retry from `resetsAt`.
 */
export class PatientDeskError extends Error {
  /** HTTP status. `0` for a transport/timeout failure without a response. */
  readonly status: number;
  /** Machine-readable code, e.g. `rate_limit_error`, `model_retired`. */
  readonly code?: string;
  /** Parsed error body, when the response had JSON. */
  readonly body?: PatientDeskErrorBody | unknown;
  /** `error.details.reason`, when present. */
  readonly reason?: string;
  /** `error.details.scope`: `user` or `pool`. */
  readonly scope?: string;
  /** Seconds until the limit resets (from `Retry-After` or `details`). */
  readonly retryAfterSeconds?: number;
  /** ISO time the limit resets (from `error.details.resetAt`). */
  readonly resetAt?: string;

  constructor(message: string, init: PatientDeskErrorInit) {
    super(message);
    this.name = "PatientDeskError";
    this.status = init.status;
    if (init.code) this.code = init.code;
    if (init.body !== undefined) this.body = init.body;
    if (init.retryAfterSeconds !== undefined) this.retryAfterSeconds = init.retryAfterSeconds;
    if (init.resetAt) this.resetAt = init.resetAt;

    const details = detailsOf(init.body);
    if (details) {
      if (typeof details.reason === "string") this.reason = details.reason;
      if (typeof details.scope === "string") this.scope = details.scope;
      if (this.retryAfterSeconds === undefined && typeof details.retryAfterSeconds === "number") {
        this.retryAfterSeconds = details.retryAfterSeconds;
      }
      if (!this.resetAt && typeof details.resetAt === "string") this.resetAt = details.resetAt;
    }

    Object.setPrototypeOf(this, PatientDeskError.prototype);
  }

  /** `true` when the request can be retried after `resetsAt`. */
  get isRateLimit(): boolean {
    return this.status === 429;
  }

  /** Date the daily allowance resets, when known. */
  get resetsAt(): Date | null {
    if (this.resetAt) {
      const date = new Date(this.resetAt);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (this.retryAfterSeconds !== undefined) return new Date(Date.now() + this.retryAfterSeconds * 1000);
    return null;
  }
}

function detailsOf(body: unknown): PatientDeskErrorDetails | undefined {
  if (!body || typeof body !== "object") return undefined;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== "object") return undefined;
  return details as PatientDeskErrorDetails;
}

/** Pull the message + code out of a PatientDesk error body. */
export function describeBody(body: unknown, status: number): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      const code = (error as { code?: unknown }).code;
      return {
        message: typeof message === "string" && message ? message : `PatientDesk HTTP ${status}`,
        code: typeof code === "string" ? code : undefined,
      };
    }
  }
  return { message: `PatientDesk HTTP ${status}` };
}

/** Parse a `Retry-After` header (seconds or HTTP date). */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return Math.max(0, Math.round((date.getTime() - Date.now()) / 1000));
  return undefined;
}
