import { PatientDeskError, describeBody, parseRetryAfter } from "./errors.js";
import { AudioApi } from "./stt.js";
import { SpeechApi } from "./tts.js";

/** Minimal `WebSocket` surface the streaming STT client needs. */
export interface WebSocketLike {
  binaryType?: string;
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  send(data: string | ArrayBuffer | ArrayBufferView | Blob): void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketConstructor {
  new (url: string, protocols?: string | string[]): WebSocketLike;
}

export interface PatientDeskOptions {
  /** API key, e.g. `pd_live_...`. Falls back to `PATIENDESK_API_KEY` / `PATIENDESK_KEY`. */
  apiKey?: string;
  /** Base URL of the API. Defaults to `https://voice.patientdesk.ai/v1`. */
  baseUrl?: string;
  /** Custom `fetch` implementation. Defaults to the global one. */
  fetch?: typeof fetch;
  /** Custom `WebSocket` implementation, needed only for streaming STT. */
  WebSocket?: WebSocketConstructor;
  /** Retries for `429`, `5xx` and network failures. Defaults to 2 (3 attempts). */
  maxRetries?: number;
  /** Per-request timeout in milliseconds. Defaults to 120000. `0` disables it. */
  timeout?: number;
  /** Extra headers sent on every request. */
  defaultHeaders?: Record<string, string>;
}

/** The HTTP core shared by the typed APIs. */
export interface HttpCore {
  readonly baseUrl: string;
  readonly wsOrigin: string;
  readonly apiKey: string;
  readonly fetchImpl: typeof fetch;
  readonly wsImpl: WebSocketConstructor | undefined;
  headers(extra?: Record<string, string>): Record<string, string>;
  request(path: string, init?: RequestInit): Promise<Response>;
}

export const DEFAULT_BASE_URL = "https://voice.patientdesk.ai/v1";
export const DEFAULT_STATUS_URL = "https://status.patientdesk.ai/api/v2/status.json";

function resolveEnvKey(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.PATIENDESK_API_KEY ?? env?.PATIENDESK_KEY;
}

function wsOriginOf(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  url.search = "";
  url.hash = "";
  return url.origin;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffMs(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) return Math.min(retryAfter * 1000, 30_000);
  const base = Math.min(250 * 2 ** attempt, 4_000);
  return base + Math.floor(Math.random() * 100);
}

/** Statuses and network failures that are retried automatically. */
export const RETRYABLE_STATUS: ReadonlySet<number> = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/**
 * Unofficial PatientDesk client.
 *
 * ```ts
 * const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });
 * const speech = await pd.speech.create({ input: "Merhaba dünya" });
 * const bytes = new Uint8Array(await speech.arrayBuffer());
 * ```
 */
export class PatientDesk implements HttpCore {
  readonly baseUrl: string;
  readonly wsOrigin: string;
  readonly apiKey: string;
  readonly fetchImpl: typeof fetch;
  readonly wsImpl: WebSocketConstructor | undefined;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly defaultHeaders: Record<string, string>;

  /** Text-to-speech (Alania). */
  readonly speech: SpeechApi;
  /** Speech-to-text (Duyu). */
  readonly audio: AudioApi;

  constructor(options: PatientDeskOptions = {}) {
    const key = options.apiKey ?? resolveEnvKey();
    if (!key) {
      throw new PatientDeskError(
        "Missing API key. Pass `apiKey` or set PATIENDESK_API_KEY in the environment.",
        { status: 401, code: "missing_api_key" },
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!fetchImpl) {
      throw new PatientDeskError("No global `fetch` found. Pass a `fetch` implementation.", {
        status: 0,
        code: "no_fetch",
      });
    }

    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.wsOrigin = wsOriginOf(this.baseUrl);
    this.fetchImpl = fetchImpl;
    this.wsImpl = options.WebSocket ?? (globalThis.WebSocket as unknown as WebSocketConstructor | undefined);
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.timeout = Math.max(0, options.timeout ?? 120_000);
    this.defaultHeaders = options.defaultHeaders ?? {};

    this.speech = new SpeechApi(this);
    this.audio = new AudioApi(this);
  }

  /** Authorization + content headers for a JSON request. */
  headers(extra?: Record<string, string>): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
      ...this.defaultHeaders,
      ...extra,
    };
  }

  /**
   * Perform a request with timeout, retry/backoff and PatientDesk error mapping.
   * Retries `429`/`5xx`/network failures, honouring `Retry-After` and
   * `error.details.retryAfterSeconds`; never retries other `4xx`.
   */
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const callerSignal = init.signal ?? undefined;
      const onCallerAbort = () => controller.abort(callerSignal?.reason);
      if (callerSignal) {
        if (callerSignal.aborted) controller.abort(callerSignal.reason);
        else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (this.timeout > 0) {
        timer = setTimeout(() => controller.abort(new Error("PatientDesk request timed out")), this.timeout);
      }

      try {
        // A signal that is already aborted never fires another 'abort' event, so
        // a fetch implementation that only listens for it would hang. Fail now.
        if (controller.signal.aborted) {
          throw controller.signal.reason ?? new Error("PatientDesk request aborted");
        }
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if (response.ok) return response;

        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        const retryable = retryAfter !== undefined || RETRYABLE_STATUS.has(response.status);
        if (!retryable || attempt === this.maxRetries) {
          throw await this.toError(response, retryAfter);
        }
        await sleep(backoffMs(attempt, retryAfter), callerSignal);
      } catch (err) {
        if (err instanceof PatientDeskError) throw err;
        if (callerSignal?.aborted) throw err;
        lastError = err;
        if (attempt === this.maxRetries) {
          throw new PatientDeskError(
            err instanceof Error ? err.message : `PatientDesk request failed: ${String(err)}`,
            { status: 0, code: "network_error" },
          );
        }
        await sleep(backoffMs(attempt), callerSignal);
      } finally {
        if (timer) clearTimeout(timer);
        if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
      }
    }

    throw new PatientDeskError(
      lastError instanceof Error ? lastError.message : "PatientDesk request failed",
      { status: 0, code: "unknown" },
    );
  }

  /** Build a `PatientDeskError` from a failed response, consuming its body. */
  private async toError(response: Response, retryAfter?: number): Promise<PatientDeskError> {
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      /* not JSON */
    }
    const { message, code } = describeBody(body, response.status);
    return new PatientDeskError(message, {
      status: response.status,
      code,
      body,
      retryAfterSeconds: retryAfter,
    });
  }
}
