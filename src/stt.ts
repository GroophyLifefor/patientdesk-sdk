import type { HttpCore, WebSocketLike } from "./client.js";
import { PatientDeskError } from "./errors.js";
import type {
  AudioInput,
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
export const MAX_AUDIO_BYTES = 9 * 1024 * 1024; // ~9 MB per the docs

/**
 * Duyu speech-to-text: a base64 JSON REST call plus an undocumented WebSocket
 * streaming client.
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
    const audioBase64 = await resolveAudioBase64(params);

    const body: Record<string, unknown> = {
      model: params.model ?? DEFAULT_STT_MODEL,
      audio_base64: audioBase64,
      ...(params.audio_format !== undefined ? { audio_format: params.audio_format } : {}),
      ...(params.language !== undefined ? { language: params.language } : {}),
      ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
      ...(params.response_format !== undefined ? { response_format: params.response_format } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(format === "verbose_json" && (params as TranscribeParamsVerbose).timestamp_granularities
        ? { timestamp_granularities: (params as TranscribeParamsVerbose).timestamp_granularities }
        : {}),
      ...params.extra,
    };

    const response = await this.core.request("/audio/transcriptions", {
      method: "POST",
      headers: this.core.headers(),
      body: JSON.stringify(body),
    });

    if (format === "text" || format === "srt" || format === "vtt") {
      return await response.text();
    }
    return (await response.json()) as Transcription;
  }

  /**
   * Live transcription over WebSocket. **Undocumented**: PatientDesk's public
   * docs describe Duyu only as the REST endpoint above. This mirrors the
   * protocol the Ömer desktop assistant uses in production
   * (`wss://voice.patientdesk.ai/v1/audio/stream`): send a `start` frame, then
   * raw PCM as binary frames, and read `ready` / `final` / `error` events.
   *
   * ```ts
   * const stream = pd.audio.transcribeStream({
   *   sampleRate: 16000,
   *   onFinal: (text) => console.log(text),
   * });
   * stream.sendAudio(pcmChunk);
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

    // The endpoint wants the key in a `token` query parameter. `key` connects
    // but never sends a ready frame, and the server replies with
    // `missing_api_key` when neither is understood.
    const url = `${this.core.wsOrigin}/v1/audio/stream?token=${encodeURIComponent(this.core.apiKey)}`;
    const socket = new WS(url);
    socket.binaryType = "arraybuffer";

    let settled = false;
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const finish = () => {
      if (settled) return;
      settled = true;
      resolveClosed();
    };

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "start",
          sampleRate: options.sampleRate ?? 16000,
          eager_final: options.eagerFinal ?? true,
          ...options.extra,
        }),
      );
    };

    socket.onmessage = (event) => {
      let message: { type?: string; text?: string; model?: string; message?: string };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === "ready") events.ready?.({ model: message.model, raw: message });
      else if (message.type === "final") events.final?.(String(message.text ?? ""), message);
      else if (message.type === "error") events.error?.(String(message.message ?? "unknown error"), message);
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
        if (socket.readyState === 1) socket.send(chunk);
      },
      stop() {
        // Tell the server the utterance ended so it can emit a final; then close.
        try {
          if (socket.readyState === 1) socket.send(JSON.stringify({ type: "stop" }));
        } catch {
          /* already closing */
        }
        try {
          socket.close(1000, "client stop");
        } catch {
          /* already closing */
        }
      },
      closed,
    };
  }
}

async function resolveAudioBase64(params: TranscribeBase): Promise<string> {
  if (typeof params.audioBase64 === "string" && params.audioBase64) return stripDataUrl(params.audioBase64);
  if (params.audio === undefined) {
    throw new TypeError("Provide `audio` (bytes/blob) or `audioBase64`.");
  }
  const bytes = await toUint8Array(params.audio);
  if (!bytes.length) throw new TypeError("`audio` is empty.");
  return toBase64(bytes);
}

async function toUint8Array(audio: AudioInput): Promise<Uint8Array> {
  if (audio instanceof Uint8Array) return audio;
  if (audio instanceof ArrayBuffer) return new Uint8Array(audio);
  if (typeof Blob !== "undefined" && audio instanceof Blob) {
    return new Uint8Array(await audio.arrayBuffer());
  }
  throw new TypeError("`audio` must be a Uint8Array, ArrayBuffer or Blob.");
}

function stripDataUrl(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma >= 0 ? value.slice(comma + 1) : value;
}

export function toBase64(bytes: Uint8Array): string {
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (typeof btoaFn === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoaFn(binary);
  }
  const BufferCtor = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (BufferCtor) return BufferCtor.from(bytes).toString("base64");
  throw new PatientDeskError("No base64 encoder available (need `btoa` or `Buffer`).", {
    status: 0,
    code: "no_base64",
  });
}
