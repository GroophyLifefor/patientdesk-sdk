import { DEFAULT_STATUS_URL } from "./client.js";

export interface StatusPage {
  id?: string;
  name?: string;
  url?: string;
  time_zone?: string;
  updated_at?: string;
}

export interface StatusSummary {
  indicator?: string;
  description?: string;
}

export interface StatusResponse {
  page?: StatusPage;
  status?: StatusSummary;
  [key: string]: unknown;
}

export interface FetchStatusOptions {
  /** Override the status endpoint. Defaults to `https://status.patientdesk.ai/api/v2/status.json`. */
  url?: string;
  /** Custom `fetch`. Defaults to the global one. */
  fetch?: typeof fetch;
  /** Timeout in milliseconds. Defaults to 10000. */
  timeout?: number;
  /** Abort signal. */
  signal?: AbortSignal;
  /** Number of retries for network errors / 5xx. Defaults to 1. */
  retries?: number;
}

/** Indicators Statuspage uses; anything other than `none` is degraded. */
const DEGRADED = new Set(["minor", "major", "critical", "maintenance"]);

/**
 * Fetch PatientDesk's Statuspage summary (`/api/v2/status.json`).
 * This is a standalone helper: it takes no API key, so a `full-test` can check
 * service health before touching the paid/live endpoints.
 */
export async function fetchStatus(options: FetchStatusOptions = {}): Promise<StatusResponse> {
  const url = options.url ?? DEFAULT_STATUS_URL;
  const doFetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!doFetch) throw new Error("No global `fetch` found. Pass a `fetch` implementation.");
  const timeout = options.timeout ?? 10_000;
  const retries = Math.max(0, options.retries ?? 1);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const caller = options.signal;
    const onAbort = () => controller.abort(caller?.reason);
    if (caller) {
      if (caller.aborted) controller.abort(caller.reason);
      else caller.addEventListener("abort", onAbort, { once: true });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeout > 0) timer = setTimeout(() => controller.abort(new Error("status request timed out")), timeout);
    try {
      const res = await doFetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`status endpoint returned HTTP ${res.status}`);
      return (await res.json()) as StatusResponse;
    } catch (err) {
      lastError = err;
      if (caller?.aborted || attempt === retries) break;
    } finally {
      if (timer) clearTimeout(timer);
      if (caller) caller.removeEventListener("abort", onAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** `true` when the status page reports no degradation. */
export function isOperational(status: StatusResponse | undefined | null): boolean {
  const indicator = status?.status?.indicator;
  if (!indicator) return false;
  return !DEGRADED.has(indicator.toLowerCase());
}

/** Human-readable summary, e.g. `All Systems Operational`. */
export function statusDescription(status: StatusResponse | undefined | null): string {
  return status?.status?.description ?? "unknown";
}
