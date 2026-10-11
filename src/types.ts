/**
 * PatientDesk voice model identifiers.
 *
 * Against the native API (`https://voice.patientdesk.ai`) the bare ids are used
 * (`alania-v2`, `duyu-1`). Aggregators such as LLMTR route the same models under
 * a namespaced id (`patientdesk/alania-v2`), so any string is accepted here.
 */
export type AlaniaModel = "alania-v1" | "alania-v2" | "antalia-mini" | (string & {});
export type DuyuModel = "duyu-1" | "whisper-1" | (string & {});

/** Output container for Alania text-to-speech. */
export type TtsFormat = "wav" | "mp3" | "opus" | "flac" | "aac" | "pcm" | "mulaw" | "alaw";

/** Built-in Alania voices; a saved voice id is also accepted. */
export type AlaniaVoice = "alania" | "alania2-f1" | "alania2-m1" | "alania2-m2" | "alania2-f2" | "antalia-mini" | (string & {});

/** Ready-made conversation styles, listed by `GET /v1/styles`. */
export type AlaniaStyle =
  | "support-warm"
  | "support-calm"
  | "sales-energetic"
  | "reception-smile"
  | (string & {});

/** Accepted container of the audio sent to Duyu. If omitted it is detected from the first bytes. */
export type SttFormat = "wav" | "mp3" | "m4a" | "webm" | "ogg" | "flac";

/** Shape of the Duyu response. */
export type SttResponseFormat = "json" | "text" | "verbose_json" | "srt" | "vtt";

/** Timestamp detail, only with `verbose_json`. */
export type TimestampGranularity = "segment" | "word";

/** Audio accepted by `transcribe()` and voice creation. */
export type AudioInput = Uint8Array | ArrayBuffer | Blob;

// ------------------------------------------------------------------ TTS ----

/** One pronunciation override. */
export interface PronunciationEntry {
  term: string;
  say_as: string;
}

/** `pronunciations` accepts a `{ term: say_as }` map or an array of entries. */
export type Pronunciations = Record<string, string> | PronunciationEntry[];

/** Voice sample for clone-on-request: bytes, or base64 / `data:` URI text. */
export type ReferenceAudio = Uint8Array | ArrayBuffer | Blob | string;

export interface SpeechCreateParams {
  /** Text to speak. Up to 5,000 characters; split longer text across requests. */
  input: string;
  /** Model id. Defaults to `alania-v1` (the API's own default is `alania-v2`). */
  model?: AlaniaModel;
  /** Voice id. Defaults to `alania` (the API's own default is `alania2-f1`). */
  voice?: AlaniaVoice;
  /** Container of the returned audio. Defaults to `wav`. */
  response_format?: TtsFormat;
  /**
   * Output sample rate: 8000, 16000, 22050, 24000, 44100 or 48000, capped at
   * the model's own rate (alania-v2: 48000, alania-v1: 24000). G.711 defaults
   * to 8000.
   */
  sample_rate?: number;
  /**
   * Delivery variation. alania-v1: 0–2.0, defaults to 0.30. alania-v2: 0.6–2.0,
   * defaults to 1.0.
   */
  temperature?: number;
  /** Provider seed. Same text + seed + settings reproduce the same audio. */
  seed?: number;
  /** Produce the audio as it is generated; see `speech.stream()`. */
  stream?: boolean;
  /** alania-v2: ready style id. Cannot be combined with `instructions` or `voice_description`. */
  style?: AlaniaStyle;
  /** alania-v2: how to speak, ≤200 characters, no parentheses. Non-English is translated. */
  instructions?: string;
  /** alania-v2: describe a brand-new voice, ≤200 characters. Cannot be combined with `instructions`. */
  voice_description?: string;
  /** alania-v2: sample to clone (3–30 s, ≤10 MB). Requires `consent: true`. */
  reference_audio?: ReferenceAudio;
  /** alania-v2: transcript of `reference_audio` (≤1,000 characters). Accepted, not used. */
  reference_text?: string;
  /** alania-v2: declare the speaker consented. Required with `reference_audio`. */
  consent?: boolean;
  /** Per-request pronunciation overrides (≤200 entries) that beat the saved dictionary. */
  pronunciations?: Pronunciations;
  /** alania-v2: guidance strength 1.0–5.0. Defaults to 2.0 (3.0 for voice design). */
  cfg?: number;
  /** alania-v1 only: 0.01–1.0, defaults to 0.9. alania-v2 ignores it. */
  top_p?: number;
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
  /** `Content-Type` of the audio (e.g. `audio/wav`, `audio/L16`). */
  readonly contentType: string;
  /** `x-disclosure` header (`ai-generated`), when present. */
  readonly disclosure: string | null;
  /** `x-request-id`: share it in support requests. */
  readonly requestId: string | null;
  /** `x-model`: the model that produced the audio. */
  readonly model: string | null;
  /** `x-characters`: billed characters (0 for the free `antalia-mini`). */
  readonly characters: number | null;
  /** `x-audio-seconds`: duration of the generated audio. Absent when streaming. */
  readonly audioSeconds: number | null;
  /** `x-queue-wait-ms`: time spent waiting for a generation slot. */
  readonly queueWaitMs: number | null;
  /** Sample rate parsed from `Content-Type` (`rate=`), when the server sends it. */
  readonly sampleRate: number | null;
  /** Whole audio as an ArrayBuffer. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Whole audio as a Blob (uses `contentType`). */
  blob(): Promise<Blob>;
  /** Raw byte stream (`Response.body`). `null` only for an empty body. */
  stream(): ReadableStream<Uint8Array> | null;
}

/** Connection settings for `speech.socket()`. */
export interface SpeechSocketOptions {
  /** Default model for every `speak` on this connection. */
  model?: AlaniaModel;
  /** Output encoding for the connection. Defaults to `pcm_s16le`. */
  encoding?: "pcm_s16le" | "mulaw" | "alaw";
  /** Output sample rate for the connection. */
  sampleRate?: number;
  /** Authenticate with `?token=` (a session token) instead of the API key. */
  token?: string;
}

export interface SpeechSocketEvents {
  /** Server handshake: `model`, `voice`, `sample_rate`, `encoding`, `usage`. */
  ready?: (info: { model?: string; voice?: string; sampleRate?: number; encoding?: string; raw: unknown }) => void;
  /** Audio has started for the current `speak`: `characters`, `disclosure`, … */
  speechStart?: (info: { characters?: number; model?: string; voice?: string; sampleRate?: number; raw: unknown }) => void;
  /** Binary audio chunk (PCM16 or G.711, mono). */
  audio?: (chunk: Uint8Array) => void;
  /** The current `speak` finished: `audio_s`, `infer_ms`. */
  speechEnd?: (info: { audioSeconds?: number; inferMs?: number; raw: unknown }) => void;
  /** The `stop` message was acknowledged and the server is closing. */
  stopped?: (raw: unknown) => void;
  /** Server error frame: `message`, `code`, `category`, `retry_after`. */
  error?: (message: string, raw: unknown) => void;
  /** Socket closed (code, reason). */
  close?: (code: number, reason: string) => void;
}

/** Handle returned by `speech.socket()`. */
export interface SpeechSocket {
  /** Queue a sentence to speak. Messages are sent in order, one at a time. */
  speak(params: SpeechCreateParams): void;
  /** Ask the server to finish; `speech_end`/`stopped` arrive before the close. */
  stop(): void;
  /** Close the socket immediately. */
  close(): void;
  /** Resolves when the socket closes. */
  closed: Promise<void>;
}

// --------------------------------------------------------------- catalog ----

export interface AlaniaStyleInfo {
  id: string;
  object?: string;
  name?: string;
  description?: string;
}

export interface StylesListResponse {
  object?: string;
  data: AlaniaStyleInfo[];
}

export interface AlaniaModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
  default?: boolean;
  legacy?: boolean;
  free?: boolean;
  sample_rate?: number;
  status?: string;
}

export interface ModelsListResponse {
  object?: string;
  data: AlaniaModelInfo[];
}

/** `GET /v1/alania/usage` — shape is provider-defined; fields are read as-is. */
export type UsageResponse = { object?: string } & Record<string, unknown>;

export interface AlaniaHealthResponse {
  status?: string;
  service?: string;
  model?: string;
  models?: Record<string, { status?: string; sample_rate?: number; default?: boolean }>;
  limits_degraded?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------- voices ----

export interface Voice {
  id: string;
  object?: string;
  name?: string;
  gender?: string;
  language?: string;
  model?: AlaniaModel;
  sample_rate?: number;
  default?: boolean;
  f0_band_hz?: [number, number];
  kind?: "builtin" | "custom" | (string & {});
  /** Custom voices: how they were made. */
  source?: "clone" | "design" | (string & {});
  tuned?: boolean;
  beta?: boolean;
  transcript?: string;
  duration_s?: number;
  created_at?: number;
  voice_description?: string;
  warnings?: string[];
  quality?: Record<string, unknown>;
}

export interface VoicesListResponse {
  object?: string;
  data: Voice[];
}

/**
 * `POST /v1/voices` saves a voice for reuse.
 *
 * - Cloning: send `file` + `consent: true` (+ optional `transcript`).
 * - Design: send `voice_description`, `seed` and the `input` used to design it,
 *   plus the same `cfg`/`temperature`/`pronunciations` if they were used.
 */
export interface SaveVoiceParams {
  /** Voice name, up to 80 characters. */
  name: string;
  /** Cloning: sample file (3–30 s, ≤10 MB). */
  file?: AudioInput;
  /** Cloning: transcript of the sample (≤1,000 characters). */
  transcript?: string;
  /** Cloning: declare the speaker consented. Required with `file`. */
  consent?: boolean;
  /** Design: the description used when the voice was generated. */
  voice_description?: string;
  /** Design: the seed used when the voice was generated. */
  seed?: number;
  /** Design: the text used when the voice was generated. */
  input?: string;
  /** Design: send the same `cfg` used at generation time. */
  cfg?: number;
  /** Design: send the same `temperature` used at generation time. */
  temperature?: number;
  /** Design: send the same `pronunciations` used at generation time. */
  pronunciations?: Pronunciations;
}

export type SaveVoiceResponse = Voice;

export interface DeleteVoiceResponse {
  id: string;
  object?: string;
  deleted: boolean;
}

// --------------------------------------------------------- pronunciations ----

export interface Pronunciation {
  id: string;
  object?: string;
  term: string;
  say_as: string;
  created_at?: number;
}

export interface PronunciationsListResponse {
  object?: string;
  data: Pronunciation[];
}

export interface SavePronunciationParams {
  /** The word or phrase as it appears in the text (1–100 characters). */
  term: string;
  /** How to say it, in Turkish spelling (1–200 characters). */
  say_as: string;
}

export interface DeletePronunciationResponse {
  id: string;
  object?: string;
  deleted: boolean;
}

// ------------------------------------------------------------------ STT ----

export interface TranscribeBase {
  /** Audio to transcribe. Provide exactly one of `audio` or `audioBase64`. */
  audio?: AudioInput;
  /** Pre-encoded base64 audio (no data URL prefix). Alternative to `audio`. */
  audioBase64?: string;
  /** Model id. Defaults to `duyu-1`. */
  model?: DuyuModel;
  /** Container of `audio`. Used to name the upload; the server detects the real format. */
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
    category?: string;
    retry_after?: number;
    details?: PatientDeskErrorDetails;
  };
}

// ------------------------------------------------------- streaming STT -----

export interface SttStreamStartOptions {
  /** Input sample rate in Hz. Defaults to 16000. */
  sampleRate?: number;
  /** Ask the server for an early final result. Defaults to true. */
  eagerFinal?: boolean;
  /** Ask for draft transcripts while a sentence is still being spoken. */
  partials?: boolean;
  /** Draft interval in milliseconds; server default when omitted. */
  partialMs?: number;
  /** Authenticate with `?token=` (a session token) instead of the API key. */
  token?: string;
  /** Extra fields merged into the `start` frame. */
  extra?: Record<string, unknown>;
}

export interface SttStreamEvents {
  /** Server handshake: `model`, `quota`. */
  ready?: (info: { model?: string; quota?: unknown; raw: unknown }) => void;
  /** Voice-activity hint (about every 100 ms; immediate when `active` flips). */
  vad?: (info: { prob?: number; active?: boolean; raw: unknown }) => void;
  /** A sentence started. */
  segmentStart?: (info: { start?: number; raw: unknown }) => void;
  /** Draft transcript of the in-progress sentence (needs `partials: true`). */
  partial?: (text: string, raw: unknown) => void;
  /** A sentence ended; a `final` follows. */
  segmentEnd?: (info: { end?: number; raw: unknown }) => void;
  /** Final transcript for a sentence. `raw` carries `start`, `end`, `audio_s`, `infer_ms`, `rtf`. */
  final?: (text: string, raw: unknown) => void;
  /** Everything resolved; `audio_s` is the billed duration. */
  stopped?: (info: { audioSeconds?: number; raw: unknown }) => void;
  /** Server-reported error. */
  error?: (message: string, raw: unknown) => void;
  /** Socket closed (code, reason). */
  close?: (code: number, reason: string) => void;
}

/** Handle returned by `transcribeStream()`. */
export interface SttStream {
  /** Send raw PCM (or any audio the server accepts) chunks. */
  sendAudio(chunk: Uint8Array): void;
  /** Finish the session; the open sentence is finalized, then the socket closes. */
  stop(): void;
  /** Resolves when the socket closes. */
  closed: Promise<void>;
}
