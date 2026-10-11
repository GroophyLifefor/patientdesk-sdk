# Speech to text

Duyu is PatientDesk's speech-to-text model. The public endpoint is
`POST /audio/transcriptions` and it takes **multipart/form-data** with a `file`
field. Up to 100 MB / 2 hours per request. Longer audio is split server-side.
`audioBase64` is still accepted by the SDK: it is decoded locally and uploaded
as the same `file` part.

## Basic call

```ts
import { readFileSync } from "node:fs";

const { text } = await pd.audio.transcribe({
  audio: readFileSync("kayit.m4a"),
  audio_format: "m4a",   // names the upload; the server detects the format
  language: "tr",        // "tr" (default) or "auto"
  prompt: "ilaç: parol", // optional spelling hint
});
console.log(text);
```

You can pass raw bytes, an `ArrayBuffer` or a `Blob`. `audio_format` only names
the uploaded file (extension + MIME type). Duyu detects the real container from
the first bytes, so omitting it is safe.

## Parameters

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `audio` | `Uint8Array \| ArrayBuffer \| Blob` | none | Provide `audio` or `audioBase64`. |
| `audioBase64` | `string` | none | Pre-encoded audio; decoded locally, data URL prefix allowed. |
| `model` | `string` | `"duyu-1"` | `whisper-1` is accepted for compatibility. |
| `audio_format` | `SttFormat` | detected | `wav`, `mp3`, `m4a`, `webm`, `ogg`, `flac`; names the upload. |
| `language` | `string` | `"tr"` | `tr`, `auto`, or a full code. |
| `prompt` | `string` | unset | Names, drug names, ID formats. |
| `temperature` | `number` | `0` | Between 0 and 1. |
| `response_format` | `SttResponseFormat` | `"json"` | `json`, `text`, `verbose_json`, `srt`, `vtt`. |
| `timestamp_granularities` | `("segment" \| "word")[]` | unset | Only with `verbose_json`. |
| `extra` | `Record<string, unknown>` | unset | Merged into the form fields. |

The maximum audio size is 100 MB (and 2 hours) per request. The SDK rejects
larger input locally with a `RangeError`.

## Response shapes

`response_format` decides the return type, and the overloads reflect it.

| `response_format` | Returns |
| --- | --- |
| omitted or `json` | `Transcription` |
| `verbose_json` | `Transcription` with `segments` and `words` |
| `text`, `srt`, `vtt` | `string` |

```ts
// verbose_json -> segments and word timings
const detailed = await pd.audio.transcribe({
  audio: bytes,
  response_format: "verbose_json",
  timestamp_granularities: ["word"],
});
for (const w of detailed.words ?? []) {
  console.log(`${w.start.toFixed(2)}s ${w.word}`);
}

// srt -> the subtitle text itself
const srt = await pd.audio.transcribe({ audio: bytes, response_format: "srt" });
```

The `Transcription` shape:

| Field | Type | Notes |
| --- | --- | --- |
| `text` | `string` | The transcript. |
| `task` | `string` | e.g. `transcribe`. |
| `language` | `string` | Detected or requested language. |
| `duration` | `number` | Seconds; this is the billed duration. |
| `segments` | `TranscriptionSegment[]` | With `verbose_json`. |
| `words` | `TranscriptionWord[]` | With `verbose_json` and word granularity. |

## Base64 helper

`toBase64()` is exported if you need to build a payload yourself, and
`fromBase64()` decodes one. A `data:` URL prefix is stripped automatically.

```ts
import { toBase64 } from "patientdesk-sdk";

const b64 = toBase64(new Uint8Array(buf)); // no data: prefix
await pd.audio.transcribe({ audioBase64: b64, audio_format: "wav" });
```

## Live transcription

For microphone use, the WebSocket session is lower latency than the REST call:
draft `partial` transcripts while speaking, a `final` line after the sentence,
and `vad`/`segment_*` events. It is documented and lives on its own page:
[Streaming](streaming.md).

## Service-side decodes

PatientDesk's REST endpoint has been observed returning `400 undecodable_audio`,
or a bundled internal stack trace, for perfectly valid files. Those are upstream
faults. The live suite labels them for you, see [Testing](testing.md).
