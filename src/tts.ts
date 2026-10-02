import type { HttpCore } from "./client.js";
import type { SpeechCreateParams, SpeechResponse, TtsFormat } from "./types.js";

export const CONTENT_TYPE: Record<TtsFormat, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  pcm: "audio/L16",
};

export const MAX_INPUT_CHARS = 5_000;

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
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      CONTENT_TYPE[params.response_format ?? "wav"] ||
      "application/octet-stream";

    return {
      response,
      contentType,
      disclosure: response.headers.get("x-disclosure"),
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
    const input = params.input;
    if (typeof input !== "string" || !input.trim()) {
      throw new TypeError("`input` must be a non-empty string.");
    }
    if (input.length > MAX_INPUT_CHARS) {
      throw new RangeError(
        `\`input\` is ${input.length} characters; Alania accepts at most ${MAX_INPUT_CHARS}. Split the text across requests.`,
      );
    }

    const body: Record<string, unknown> = {
      model: params.model ?? "alania-v1",
      input,
      voice: params.voice ?? "alania",
      response_format: params.response_format ?? "wav",
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.seed !== undefined ? { seed: params.seed } : {}),
      ...(params.stream !== undefined ? { stream: params.stream } : {}),
      ...params.extra,
    };

    return await this.core.request("/audio/speech", {
      method: "POST",
      headers: this.core.headers(),
      body: JSON.stringify(body),
    });
  }
}
