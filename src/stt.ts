import type { HttpCore } from "./client.js";
import { PatientDeskError } from "./errors.js";
import { bytesToBlob, fromBase64, toBase64, toUint8Array } from "./bytes.js";
import type {
  SttFormat,
  SttStream,
  SttStreamEvents,
  SttStreamStartOptions,
  SubtitleResult,
  TranscribeBase,
  TranscribeParams,
  TranscribeParamsPlain,
  TranscribeParamsVerbose,
  Transcription,
} from "./types.js";

export const DEFAULT_STT_MODEL = "duyu-1";
/** The docs allow 100 MB / 2 hours per transcription. */
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

const AUDIO_META: Record<SttFormat, { ext: string; type: string }> = {
  wav: { ext: "wav", type: "audio/wav" },
  mp3: { ext: "mp3", type: "audio/mpeg" },
  m4a: { ext: "m4a", type: "audio/mp4" },
  webm: { ext: "webm", type: "audio/webm" },
  ogg: { ext: "ogg", type: "audio/ogg" },
  flac: { ext: "flac", type: "audio/flac" },
};

const STOP_TIMEOUT_MS = 5_000;
const WS_OPEN = 1;

/**
 * Duyu speech-to-text: a multipart REST call plus a WebSocket streaming client.
 *
 * ```ts
 * const { text } = await pd.audio.transcribe({ audio: bytes, audio_format: "m4a" });
 * ```
 */
export class AudioApi {
  constructor(private readonly core: HttpCore) {}

  /** `response_format` omitted or `json` → parsed transcript. */
  transcribe(params: TranscribeParams): Promise<Transcription>;
  /** `response_format: "text" | "srt" | "vtt"` → the raw string. */
  transcribe(params: TranscribeParamsPlain): Promise<SubtitleResult>;
  /** `response_format: "verbose_json"` → transcript with segments/words. */
  transcribe(params: TranscribeParamsVerbose): Promise<Transcription>;
  async transcribe(
    params: TranscribeParams | TranscribeParamsPlain | TranscribeParamsVerbose,
  ): Promise<Transcription | string> {
    const format = params.response_format ?? "json";
    const { bytes, filename, type } = await resolveAudio(params);

    const form = new FormData();
    form.append("file", bytesToBlob(bytes, type), filename);
    form.append("model", params.model ?? DEFAULT_STT_MODEL);
    if (params.language !== undefined) form.append("language", params.language);
    if (params.prompt !== undefined) form.append("prompt", params.prompt);
    if (params.response_format !== undefined) form.append("response_format", params.response_format);
    if (params.temperature !== undefined) form.append("temperature", String(params.temperature));
    if (format === "verbose_json") {
      for (const granularity of (params as TranscribeParamsVerbose).timestamp_granularities ?? []) {
        form.append("timestamp_granularities[]", granularity);
      }
    }
    for (const [key, value] of Object.entries(params.extra ?? {})) {
      form.append(key, typeof value === "string" ? value : JSON.stringify(value));
    }

    const response = await this.core.request("/audio/transcriptions", {
      method: "POST",
      headers: this.core.authHeaders(),
      body: form,
    });

    if (format === "text" || format === "srt" || format === "vtt") {
      return await response.text();
    }
    return (await response.json()) as Transcription;
  }

  /**
   * Live transcription over WebSocket (`wss://…/v1/audio/stream`): send a
   * `start` frame, then raw PCM as binary frames. The server emits `ready`,
   * `vad`, `segment_start`, `partial`, `segment_end`, `final`, `stopped` and
   * `error`. Auth is `?key=` by default; pass `options.token` for a session
   * token instead.
   *
   * ```ts
   * const stream = pd.audio.transcribeStream({
   *   partial: (draft) => console.log("…", draft),
   *   final: (text) => console.log(text),
   * });
   * stream.sendAudio(pcmChunk);
   * stream.stop(); // the open sentence is finalized before the close
   * await stream.closed;
   * ```
   */
  transcribeStream(events: SttStreamEvents = {}, options: SttStreamStartOptions = {}): SttStream {
    const WS = this.core.wsImpl;
    if (!WS) {
      throw new PatientDeskError(
        "No `WebSocket` available. Pass a `WebSocket` implementation to the client for streaming STT.",
        { status: 0, code: "no_websocket" },
      );
    }

    const auth = options.token
      ? `token=${encodeURIComponent(options.token)}`
      : `key=${encodeURIComponent(this.core.apiKey)}`;
    const socket = new WS(`${this.core.wsOrigin}/v1/audio/stream?${auth}`);
    socket.binaryType = "arraybuffer";

    let settled = false;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const finish = () => {
      if (settled) return;
      settled = true;
      if (stopTimer) clearTimeout(stopTimer);
      resolveClosed();
    };

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "start",
          sampleRate: options.sampleRate ?? 16000,
          eager_final: options.eagerFinal ?? true,
          ...(options.partials !== undefined ? { partials: options.partials } : {}),
          ...(options.partialMs !== undefined ? { partial_ms: options.partialMs } : {}),
          ...options.extra,
        }),
      );
    };

    socket.onmessage = (event) => {
      let message: {
        type?: string;
        text?: string;
        model?: string;
        message?: string;
        quota?: unknown;
        prob?: number;
        active?: boolean;
        start?: number;
        end?: number;
        audio_s?: number;
        infer_ms?: number;
        rtf?: number;
      };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      switch (message.type) {
        case "ready":
          events.ready?.({ model: message.model, quota: message.quota, raw: message });
          break;
        case "vad":
          events.vad?.({ prob: message.prob, active: message.active, raw: message });
          break;
        case "segment_start":
          events.segmentStart?.({ start: message.start, raw: message });
          break;
        case "partial":
          events.partial?.(String(message.text ?? ""), message);
          break;
        case "segment_end":
          events.segmentEnd?.({ end: message.end, raw: message });
          break;
        case "final":
          events.final?.(String(message.text ?? ""), message);
          break;
        case "stopped":
          events.stopped?.({ audioSeconds: message.audio_s, raw: message });
          break;
        case "error":
          events.error?.(String(message.message ?? "unknown error"), message);
          break;
      }
    };

    socket.onerror = () => {
      events.error?.("WebSocket error", undefined);
    };

    socket.onclose = (event) => {
      events.close?.(event?.code ?? 1000, event?.reason ?? "");
      finish();
    };

    return {
      sendAudio(chunk: Uint8Array) {
        if (socket.readyState === WS_OPEN) socket.send(chunk);
      },
      stop() {
        // Tell the server the utterance ended: it finalizes the open sentence
        // (`final` + `stopped`) and then closes. Force the close if that never
        // arrives so callers cannot hang.
        try {
          if (socket.readyState === WS_OPEN) socket.send(JSON.stringify({ type: "stop" }));
        } catch {
          /* already closing */
        }
        stopTimer = setTimeout(() => {
          try {
            socket.close(1000, "client stop");
          } catch {
            /* already gone */
          }
        }, STOP_TIMEOUT_MS);
      },
      closed,
    };
  }
}

async function resolveAudio(
  params: TranscribeBase,
): Promise<{ bytes: Uint8Array; filename: string; type: string }> {
  let bytes: Uint8Array;
  if (typeof params.audioBase64 === "string" && params.audioBase64) {
    bytes = fromBase64(params.audioBase64);
  } else if (params.audio !== undefined) {
    bytes = await toUint8Array(params.audio);
  } else {
    throw new TypeError("Provide `audio` (bytes/blob) or `audioBase64`.");
  }
  if (!bytes.length) throw new TypeError("`audio` is empty.");
  if (bytes.length > MAX_AUDIO_BYTES) {
    throw new RangeError(
      `\`audio\` is ${bytes.length} bytes; Duyu accepts at most 100 MB (and 2 hours) per request.`,
    );
  }
  const meta = params.audio_format ? AUDIO_META[params.audio_format] : undefined;
  return {
    bytes,
    filename: meta ? `audio.${meta.ext}` : "audio.bin",
    type: meta?.type ?? "application/octet-stream",
  };
}

export { toBase64 };
