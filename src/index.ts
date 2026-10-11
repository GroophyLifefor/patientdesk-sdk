/**
 * patientdesk-sdk — unofficial SDK for PatientDesk Turkish voice models.
 *
 * - {@link PatientDesk.speech} → Alania text-to-speech (`POST /v1/audio/speech`, streaming, WebSocket)
 * - {@link PatientDesk.audio}  → Duyu speech-to-text (`POST /v1/audio/transcriptions`, WebSocket streaming)
 * - {@link PatientDesk.voices}, {@link PatientDesk.pronunciations}, {@link PatientDesk.styles}, {@link PatientDesk.models}
 * - {@link fetchStatus}, {@link fetchAlaniaHealth} → health checks (no API key)
 *
 * Not affiliated with or endorsed by PatientDesk.
 */
export { DEFAULT_BASE_URL, DEFAULT_ORIGIN, DEFAULT_STATUS_URL, PatientDesk, RETRYABLE_STATUS } from "./client.js";
export type {
  HttpCore,
  PatientDeskOptions,
  WebSocketConstructor,
  WebSocketLike,
} from "./client.js";
export { SpeechApi, CONTENT_TYPE, MAX_INPUT_CHARS, MAX_REFERENCE_BYTES } from "./tts.js";
export { AudioApi, DEFAULT_STT_MODEL, MAX_AUDIO_BYTES, toBase64 } from "./stt.js";
export { VoicesApi } from "./voices.js";
export { PronunciationsApi } from "./pronunciations.js";
export { ModelsApi, StylesApi } from "./catalog.js";
export {
  fetchAlaniaHealth,
  fetchStatus,
  isOperational,
  statusDescription,
} from "./status.js";
export type {
  FetchHealthOptions,
  FetchStatusOptions,
  StatusPage,
  StatusResponse,
  StatusSummary,
} from "./status.js";
export { PatientDeskError, describeBody, parseRetryAfter } from "./errors.js";
export type { PatientDeskErrorInit } from "./errors.js";
export { fromBase64 } from "./bytes.js";
export type { ByteSource } from "./bytes.js";
export type {
  AlaniaHealthResponse,
  AlaniaModel,
  AlaniaModelInfo,
  AlaniaStyle,
  AlaniaStyleInfo,
  AlaniaVoice,
  AudioInput,
  DeletePronunciationResponse,
  DeleteVoiceResponse,
  DuyuModel,
  ModelsListResponse,
  Pronunciation,
  PronunciationEntry,
  Pronunciations,
  PronunciationsListResponse,
  ReferenceAudio,
  SavePronunciationParams,
  SaveVoiceParams,
  SaveVoiceResponse,
  SpeechCreateParams,
  SpeechResponse,
  SpeechSocket,
  SpeechSocketEvents,
  SpeechSocketOptions,
  SttFormat,
  SttResponseFormat,
  SttStream,
  SttStreamEvents,
  SttStreamStartOptions,
  StylesListResponse,
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
  UsageResponse,
  Voice,
  VoicesListResponse,
} from "./types.js";
