/**
 * PatientDesk voice model identifiers.
 *
 * Against the native API (`https://voice.patientdesk.ai`) the bare ids
 * `alania-v1` / `duyu-1` are used. Aggregators such as LLMTR route the same
 * models under a namespaced id (`patientdesk/alania-v1`), so any string is
 * accepted here.
 */
export type AlaniaModel = "alania-v1" | (string & {});
export type DuyuModel = "duyu-1" | (string & {});

/** Output container for Alania text-to-speech. */
export type TtsFormat = "wav" | "mp3" | "opus" | "flac" | "aac" | "pcm";

/** Accepted container of the audio sent to Duyu. If omitted it is detected from the first bytes. */
export type SttFormat = "wav" | "mp3" | "m4a" | "webm" | "ogg" | "flac";

/** Shape of the Duyu response. */
export type SttResponseFormat = "json" | "text" | "verbose_json" | "srt" | "vtt";

/** Timestamp detail, only with `verbose_json`. */
export type TimestampGranularity = "segment" | "word";

/** Audio accepted by `transcribe()`. */
export type AudioInput = Uint8Array | ArrayBuffer | Blob;

// ------------------------------------------------------------------ TTS ----

export interface SpeechCreateParams {
  /** Text to speak. Up to 5,000 characters; split longer text across requests. */
  input: string;
  /** Model id. Defaults to `alania-v1`. */
  model?: AlaniaModel;
  /** Single built-in voice. Defaults to `alania`. */
  voice?: string;
  /** Container of the returned audio. Defaults to `wav` (24 kHz, mono, 16-bit). */
  response_format?: TtsFormat;
  /** Delivery variation, 0..1. Defaults to 0.30; higher is less consistent. */
  temperature?: number;
  /** Provider seed. Same text + same seed is not guaranteed to be byte-identical. */
  seed?: number;
  /**
   * @deprecated The native API ignores this field and returns the audio in one
   * piece. Kept only for forward compatibility; prefer `speech.create()` and
   * stream the returned `Response.body` yourself.
   */
  stream?: boolean;
  /** Extra fields merged into the request body (forward compatibility). */
  extra?: Record<string, unknown>;
}

/**
 * Result of a TTS request. The response is the audio itself, so several views
 * are exposed over the same body. Read it once.
 */
export interface SpeechResponse {
  /** Raw `Response`. Its body can only be consumed once. */
  readonly response: Response;
  /** `Content-Type` of the audio (e.g. `audio/wav`). */
  readonly contentType: string;
  /** Value of the `X-Disclosure` header (`ai-generated`), when present. */
  readonly disclosure: string | null;
  /** Whole audio as an ArrayBuffer. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Whole audio as a Blob (uses `contentType`). */
  blob(): Promise<Blob>;
  /** Raw byte stream (`Response.body`). `null` only for an empty body. */
  stream(): ReadableStream<Uint8Array> | null;
}

// ------------------------------------------------------------------ STT ----

export interface TranscribeBase {
  /** Audio to transcribe. Provide exactly one of `audio` or `audioBase64`. */
  audio?: AudioInput;
  /** Pre-encoded base64 audio (no data URL prefix). Alternative to `audio`. */
  audioBase64?: string;
  /** Model id. Defaults to `duyu-1`. */
  model?: DuyuModel;
  /** Container of `audio`. Omit to let the server detect it. */
  audio_format?: SttFormat;
  /** `tr` (default) or `auto`. */
  language?: "tr" | "auto" | (string & {});
  /** Spelling hint: drug names, person names, ID formats. */
  prompt?: string;
  /** Between 0 and 1. Defaults to 0. */
  temperature?: number;
  /** Extra fields merged into the request body (forward compatibility). */
  extra?: Record<string, unknown>;
}

/** `response_format` omitted or `json` → the typed JSON transcript. */
export type TranscribeParams = TranscribeBase & { response_format?: "json" };

/** `response_format: "verbose_json"` → transcript with segments/words. */
export type TranscribeParamsVerbose = TranscribeBase & {
  response_format: "verbose_json";
  timestamp_granularities?: TimestampGranularity[];
};

/** `response_format: "text" | "srt" | "vtt"` → the raw text. */
export type TranscribeParamsPlain = TranscribeBase & { response_format: "text" | "srt" | "vtt" };

/** `response_format: "srt" | "vtt"` — the subtitle text itself. */
export type SubtitleResult = string;

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface TranscriptionSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

// -------------------------------------------------------------- errors -----

export interface PatientDeskErrorDetails {
  reason?: string;
  scope?: "user" | "pool" | (string & {});
  resetAt?: string;
  retryAfterSeconds?: number;
  [key: string]: unknown;
}

/** Parsed body of an error response. */
export interface PatientDeskErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    details?: PatientDeskErrorDetails;
  };
}

// --------------------------------------------------- experimental stream ----

export interface SttStreamStartOptions {
  /** Input sample rate in Hz. Defaults to 16000. */
  sampleRate?: number;
  /** Ask the server for an early final result. Defaults to true. */
  eagerFinal?: boolean;
  /** Extra fields merged into the `start` frame. */
  extra?: Record<string, unknown>;
}

export interface SttStreamEvents {
  /** Server handshake. */
  ready?: (info: { model?: string; raw: unknown }) => void;
  /** Final transcript for the current utterance. */
  final?: (text: string, raw: unknown) => void;
  /** Server-reported error. */
  error?: (message: string, raw: unknown) => void;
  /** Socket closed (code, reason). */
  close?: (code: number, reason: string) => void;
}

/** Handle returned by `transcribeStream()`. */
export interface SttStream {
  /** Send raw PCM (or any audio the server accepts) chunks. */
  sendAudio(chunk: Uint8Array): void;
  /** Close the session. */
  stop(): void;
  /** Resolves when the socket closes. */
  closed: Promise<void>;
}
