import type { HttpCore } from "./client.js";
import { PatientDeskError } from "./errors.js";
import { toBase64, toUint8Array } from "./bytes.js";
import type {
  SpeechCreateParams,
  SpeechResponse,
  SpeechSocket,
  SpeechSocketEvents,
  SpeechSocketOptions,
  TtsFormat,
} from "./types.js";

export const CONTENT_TYPE: Record<TtsFormat, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  pcm: "audio/L16",
  mulaw: "audio/PCMU",
  alaw: "audio/PCMA",
};

export const MAX_INPUT_CHARS = 5_000;
/** Voice samples for clone-on-request: 10 MB per the docs. */
export const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

const DEFAULT_MODEL = "alania-v1";
const DEFAULT_VOICE = "alania";
const STOP_TIMEOUT_MS = 5_000;
const WAV_HEADER_BYTES = 44;

/** The API's default voice for a model; the SDK's own default stays Alania-1. */
function defaultVoiceFor(model: string): string {
  if (model === "alania-v1") return DEFAULT_VOICE;
  if (model === "antalia-mini") return "antalia-mini";
  if (model === "alania-v2" || model === "alania2" || model.endsWith("/alania-v2")) return "alania2-f1";
  return DEFAULT_VOICE;
}

/**
 * Alania text-to-speech.
 *
 * ```ts
 * const speech = await pd.speech.create({ input: "Randevunuz oluşturuldu." });
 * await Deno.writeFile("randevu.wav", new Uint8Array(await speech.arrayBuffer()));
 * ```
 */
export class SpeechApi {
  constructor(private readonly core: HttpCore) {}

  /** POST /audio/speech and return the audio response. */
  async create(params: SpeechCreateParams): Promise<SpeechResponse> {
    const response = await this.createRaw(params);
    const rawContentType = response.headers.get("content-type");
    const contentType =
      rawContentType?.split(";")[0]?.trim() ||
      CONTENT_TYPE[params.response_format ?? "wav"] ||
      "application/octet-stream";

    return {
      response,
      contentType,
      disclosure: response.headers.get("x-disclosure"),
      requestId: response.headers.get("x-request-id"),
      model: response.headers.get("x-model"),
      characters: numberHeader(response, "x-characters"),
      audioSeconds: numberHeader(response, "x-audio-seconds"),
      queueWaitMs: numberHeader(response, "x-queue-wait-ms"),
      sampleRate: rateFromContentType(rawContentType),
      arrayBuffer: () => response.arrayBuffer(),
      blob: async () => new Blob([await response.arrayBuffer()], { type: contentType }),
      stream: () => response.body,
    };
  }

  /**
   * Low-level variant: returns the raw `Response` so the caller can stream
   * `response.body` and pipe it straight to a player (lowest latency) or
   * forward the headers.
   */
  async createRaw(params: SpeechCreateParams): Promise<Response> {
    const body = await this.buildBody(params);
    return await this.core.request("/audio/speech", {
      method: "POST",
      headers: this.core.headers(),
      body: JSON.stringify(body),
    });
  }

  /**
   * HTTP streaming: sends `stream: true` and yields PCM as it is generated.
   *
   * A streamed `wav` response starts with a 44-byte RIFF header whose length
   * fields are `0xFFFFFFFF`; this helper strips it. Network chunks can split a
   * sample, so a leftover byte is carried into the next frame. For `mulaw` /
   * `alaw` one byte is one sample and nothing is carried.
   *
   * ```ts
   * for await (const pcm of pd.speech.stream({ input: longText, response_format: "pcm" })) {
   *   player.write(pcm); // 48 kHz mono PCM16 for alania-v2
   * }
   * ```
   */
  async *stream(params: SpeechCreateParams): AsyncGenerator<Uint8Array, void, unknown> {
    const format = params.response_format ?? "wav";
    const response = await this.createRaw({ ...params, stream: true });
    const body = response.body;
    if (!body) {
      throw new PatientDeskError("The API returned an empty audio stream.", { status: 0, code: "empty_stream" });
    }
    const reader = body.getReader();
    const needsTwoByteAlignment = format === "wav" || format === "pcm";
    let headerStripped = format !== "wav";
    let pending: Uint8Array | null = null;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || !value.length) continue;
        let chunk: Uint8Array = pending && pending.length ? concat(pending, value) : value;
        pending = null;
        if (!headerStripped) {
          if (chunk.length < WAV_HEADER_BYTES) {
            pending = chunk;
            continue;
          }
          if (isRiffWave(chunk)) chunk = chunk.subarray(WAV_HEADER_BYTES);
          headerStripped = true;
        }
        if (needsTwoByteAlignment && chunk.length % 2 === 1) {
          pending = chunk.subarray(chunk.length - 1);
          chunk = chunk.subarray(0, chunk.length - 1);
        }
        if (chunk.length) yield chunk;
      }
      if (pending && pending.length) yield pending;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * WebSocket session for speaking many sentences over one connection
   * (`wss://…/v1/audio/speech/stream`). Auth is `?key=` by default; pass
   * `options.token` to use a short-lived session token instead.
   *
   * ```ts
   * const socket = pd.speech.socket({
   *   speechStart: (info) => console.log(info.sampleRate),
   *   audio: (pcm) => player.write(pcm),
   * });
   * await socket.speak({ model: "alania-v2", input: "Randevunuz oluşturuldu." });
   * socket.stop();
   * await socket.closed;
   * ```
   */
  socket(events: SpeechSocketEvents = {}, options: SpeechSocketOptions = {}): SpeechSocket {
    const WS = this.core.wsImpl;
    if (!WS) {
      throw new PatientDeskError(
        "No `WebSocket` available. Pass a `WebSocket` implementation to the client for streaming TTS.",
        { status: 0, code: "no_websocket" },
      );
    }

    const auth = options.token
      ? `token=${encodeURIComponent(options.token)}`
      : `key=${encodeURIComponent(this.core.apiKey)}`;
    let url = `${this.core.wsOrigin}/v1/audio/speech/stream?${auth}`;
    if (options.model) url += `&model=${encodeURIComponent(options.model)}`;
    if (options.encoding) url += `&encoding=${encodeURIComponent(options.encoding)}`;
    if (options.sampleRate) url += `&sample_rate=${options.sampleRate}`;

    const socket = new WS(url);
    socket.binaryType = "arraybuffer";

    const queue: string[] = [];
    let ready = false;
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

    socket.onmessage = (event) => {
      const data = event.data;
      if (typeof data !== "string") {
        if (data instanceof ArrayBuffer) events.audio?.(new Uint8Array(data));
        else if (ArrayBuffer.isView(data)) events.audio?.(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        return;
      }
      let message: {
        type?: string;
        model?: string;
        voice?: string;
        sample_rate?: number;
        encoding?: string;
        characters?: number;
        audio_s?: number;
        infer_ms?: number;
        message?: string;
        [key: string]: unknown;
      };
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      switch (message.type) {
        case "ready":
          ready = true;
          events.ready?.({
            model: message.model,
            voice: message.voice,
            sampleRate: message.sample_rate,
            encoding: message.encoding,
            raw: message,
          });
          for (const payload of queue.splice(0)) socket.send(payload);
          break;
        case "speech_start":
          events.speechStart?.({
            characters: message.characters,
            model: message.model,
            voice: message.voice,
            sampleRate: message.sample_rate,
            raw: message,
          });
          break;
        case "speech_end":
          events.speechEnd?.({ audioSeconds: message.audio_s, inferMs: message.infer_ms, raw: message });
          break;
        case "stopped":
          events.stopped?.(message);
          break;
        case "error":
          events.error?.(String(message.message ?? "unknown error"), message);
          break;
      }
    };

    socket.onerror = () => events.error?.("WebSocket error", undefined);
    socket.onclose = (event) => {
      events.close?.(event?.code ?? 1000, event?.reason ?? "");
      finish();
    };

    return {
      speak: async (params: SpeechCreateParams): Promise<void> => {
        // A `speak` without an explicit model uses the connection's model.
        const body = await this.buildBody({ ...params, model: params.model ?? options.model });
        const payload = JSON.stringify({ type: "speak", ...body });
        if (ready && socket.readyState === 1) socket.send(payload);
        else queue.push(payload);
      },
      stop() {
        try {
          if (socket.readyState === 1) socket.send(JSON.stringify({ type: "stop" }));
        } catch {
          /* already closing */
        }
        // The server answers with `speech_end`/`stopped` and closes; force it
        // closed if that never arrives so callers cannot hang.
        stopTimer = setTimeout(() => {
          try {
            socket.close(1000, "client stop");
          } catch {
            /* already gone */
          }
        }, STOP_TIMEOUT_MS);
      },
      close() {
        try {
          socket.close(1000, "client close");
        } catch {
          /* already gone */
        }
      },
      closed,
    };
  }

  /** Validate params and build the JSON body shared by REST and WebSocket. */
  private async buildBody(params: SpeechCreateParams): Promise<Record<string, unknown>> {
    const input = params.input;
    if (typeof input !== "string" || !input.trim()) {
      throw new TypeError("`input` must be a non-empty string.");
    }
    if (input.length > MAX_INPUT_CHARS) {
      throw new RangeError(
        `\`input\` is ${input.length} characters; Alania accepts at most ${MAX_INPUT_CHARS}. Split the text across requests.`,
      );
    }

    const model = params.model ?? DEFAULT_MODEL;
    const referenceAudio =
      params.reference_audio !== undefined ? await encodeReferenceAudio(params.reference_audio) : undefined;

    return {
      model,
      input,
      voice: params.voice ?? defaultVoiceFor(model),
      response_format: params.response_format ?? "wav",
      ...(params.sample_rate !== undefined ? { sample_rate: params.sample_rate } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.seed !== undefined ? { seed: params.seed } : {}),
      ...(params.stream !== undefined ? { stream: params.stream } : {}),
      ...(params.style !== undefined ? { style: params.style } : {}),
      ...(params.instructions !== undefined ? { instructions: params.instructions } : {}),
      ...(params.voice_description !== undefined ? { voice_description: params.voice_description } : {}),
      ...(referenceAudio !== undefined ? { reference_audio: referenceAudio } : {}),
      ...(params.reference_text !== undefined ? { reference_text: params.reference_text } : {}),
      ...(params.consent !== undefined ? { consent: params.consent } : {}),
      ...(params.pronunciations !== undefined ? { pronunciations: params.pronunciations } : {}),
      ...(params.cfg !== undefined ? { cfg: params.cfg } : {}),
      ...(params.top_p !== undefined ? { top_p: params.top_p } : {}),
      ...params.extra,
    };
  }
}

/** Bytes/Blob → base64; strings pass through (already base64 or a data URI). */
async function encodeReferenceAudio(reference: Uint8Array | ArrayBuffer | Blob | string): Promise<string> {
  if (typeof reference === "string") return reference;
  const bytes = await toUint8Array(reference);
  if (!bytes.length) throw new TypeError("`reference_audio` is empty.");
  if (bytes.length > MAX_REFERENCE_BYTES) {
    throw new RangeError(`\`reference_audio\` is ${bytes.length} bytes; the maximum is 10 MB.`);
  }
  return toBase64(bytes);
}

function numberHeader(response: Response, name: string): number | null {
  const value = response.headers.get(name);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rateFromContentType(contentType: string | null): number | null {
  const match = contentType?.match(/rate=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isRiffWave(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  );
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
