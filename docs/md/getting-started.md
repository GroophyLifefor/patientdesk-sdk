# Getting started

`patientdesk-sdk` is an **unofficial** client for PatientDesk's Turkish voice
models. It wraps **Alania** text-to-speech and **Duyu** speech-to-text, the
account/catalog endpoints (`/v1/voices`, `/v1/pronunciations`, `/v1/styles`,
`/v1/alania/models`, usage) and keyless health checks. It has zero runtime
dependencies and uses the global `fetch`, `FormData`, `Blob` and `WebSocket`,
all of which can be injected.

> Not affiliated with, endorsed by, or supported by PatientDesk. It is an
> independent client for their public, OpenAI-compatible API.

## Overview

```mermaid
flowchart LR
  install[Install package] --> client[new PatientDesk]
  client --> tts["speech.create()<br/>Alania TTS"]
  client --> stt["audio.transcribe()<br/>Duyu STT"]
  client --> stream["speech.stream() / socket()<br/>transcribeStream()"]
  client --> account["voices / pronunciations<br/>styles / models / usage"]
  client --> status["fetchStatus()<br/>fetchAlaniaHealth()"]
```

**Need:** [Node.js 20+](https://nodejs.org/), an API key from
[speech.patientdesk.ai](https://speech.patientdesk.ai). Deno, Bun and edge
runtimes work too, since only standard globals are used.

## 1. Install

```sh
npm install patientdesk-sdk
```

## 2. Set the API key

The client reads `PATIENDESK_API_KEY`, falling back to `PATIENDESK_KEY`. You can
also pass it directly to the constructor.

```sh
# macOS / Linux
export PATIENDESK_API_KEY="pd_live_..."

# Windows PowerShell
$env:PATIENDESK_API_KEY="pd_live_..."
```

## 3. First request

```ts
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

// Text to speech (Alania). The SDK defaults to alania-v1 (24 kHz) for backward
// compatibility; pass model: "alania-v2" for the API's current default (48 kHz).
const speech = await pd.speech.create({
  input: "Randevunuz oluşturuldu.",
  response_format: "wav",
});
const wav = new Uint8Array(await speech.arrayBuffer());

// Speech to text (Duyu)
const { text } = await pd.audio.transcribe({
  audio: wav,
  audio_format: "wav",
  language: "tr",
});
console.log(text);
```

## 4. Health check (no key)

```ts
import { fetchStatus, fetchAlaniaHealth, isOperational, statusDescription } from "patientdesk-sdk";

const status = await fetchStatus();
console.log(statusDescription(status)); // "All Systems Operational"
console.log(isOperational(status) ? "up" : "degraded");

const health = await fetchAlaniaHealth(); // GET /health/alania, per-model status
console.log(health.status, health.models?.["alania-v2"]?.status);
```

## What is on the client

| Member | Type | What it does |
| --- | --- | --- |
| `pd.speech` | `SpeechApi` | Alania text-to-speech, HTTP streaming and the WebSocket session. |
| `pd.audio` | `AudioApi` | Duyu speech-to-text, multipart REST and WebSocket streaming. |
| `pd.voices` | `VoicesApi` | List, save and delete voices (`/v1/voices`). |
| `pd.pronunciations` | `PronunciationsApi` | Manage the saved pronunciation dictionary. |
| `pd.styles` | `StylesApi` | List the ready-made style ids. |
| `pd.models` | `ModelsApi` | List the Alania model catalog. |
| `pd.usage()` | `Promise<UsageResponse>` | Account quota usage. |
| `pd.baseUrl` | `string` | Resolved API base URL. |
| `pd.origin` | `string` | HTTPS origin (no `/v1`), for health checks. |
| `pd.apiKey` | `string` | Resolved API key. |
| `pd.fetchImpl` | `typeof fetch` | The `fetch` in use. |
| `pd.wsImpl` | `WebSocketConstructor` | The `WebSocket` in use, if any. |

## Where to go next

- [Node.js recipes](recipes.md): speak, transcribe a file, use the microphone.
- [Text to speech](text-to-speech.md): every Alania parameter and output shape.
- [Speech to text](speech-to-text.md): formats, timestamps, subtitles.
- [Streaming](streaming.md): HTTP streaming and both WebSocket sessions.
- [Errors](errors.md): retries, backoff and rate limits.
- [Testing](testing.md): how to run the offline and live suites.

## Not sure it is us

Add `PATIENDESK_BASE_URL` to point the client at a proxy or a mock, and inject a
custom `fetch`. See [Configuration](configuration.md).
