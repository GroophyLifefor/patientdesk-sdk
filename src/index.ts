/**
 * patientdesk-sdk — unofficial SDK for PatientDesk Turkish voice models.
 *
 * - {@link PatientDesk.speech} → Alania text-to-speech (`POST /v1/audio/speech`)
 * - {@link PatientDesk.audio}  → Duyu speech-to-text (`POST /v1/audio/transcriptions`, plus undocumented WebSocket streaming)
 * - {@link fetchStatus}        → Statuspage health check (no API key)
 *
 * Not affiliated with or endorsed by PatientDesk.
 */
export { DEFAULT_BASE_URL, DEFAULT_STATUS_URL, PatientDesk, RETRYABLE_STATUS } from "./client.js";
export type {
  HttpCore,
  PatientDeskOptions,
  WebSocketConstructor,
  WebSocketLike,
} from "./client.js";
export { SpeechApi, CONTENT_TYPE, MAX_INPUT_CHARS } from "./tts.js";
export { AudioApi, DEFAULT_STT_MODEL, MAX_AUDIO_BYTES, toBase64 } from "./stt.js";
export {
  fetchStatus,
  isOperational,
  statusDescription,
} from "./status.js";
export type {
  FetchStatusOptions,
  StatusPage,
  StatusResponse,
  StatusSummary,
} from "./status.js";
export { PatientDeskError, describeBody, parseRetryAfter } from "./errors.js";
export type { PatientDeskErrorInit } from "./errors.js";
export type {
  AlaniaModel,
  AudioInput,
  DuyuModel,
  SpeechCreateParams,
  SpeechResponse,
  SttFormat,
  SttResponseFormat,
  SttStream,
  SttStreamEvents,
  SttStreamStartOptions,
  SubtitleResult,
  TimestampGranularity,
  TranscribeBase,
  TranscribeParams,
  TranscribeParamsPlain,
  TranscribeParamsVerbose,
  Transcription,
  TranscriptionSegment,
  TranscriptionWord,
  TtsFormat,
} from "./types.js";
