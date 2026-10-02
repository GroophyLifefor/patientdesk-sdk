# Speech to text

Duyu is PatientDesk's speech-to-text model. The public endpoint is
`POST /audio/transcriptions` and it takes **base64 audio in a JSON body**. There
is no multipart upload and no `file_id`.

## Basic call

```ts
import { readFileSync } from "node:fs";

const { text } = await pd.audio.transcribe({
  audio: readFileSync("kayit.m4a"),
  audio_format: "m4a",   // optional, detected from the first bytes otherwise
  language: "tr",        // "tr" (default) or "auto"
  prompt: "ilaç: parol", // optional spelling hint
});
console.log(text);
```

You can pass raw bytes, an `ArrayBuffer` or a `Blob`. Prefer `audio_format` when
you know it, and let the server detect it when you do not.

## Parameters

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `audio` | `Uint8Array \| ArrayBuffer \| Blob` | none | Provide `audio` or `audioBase64`. |
| `audioBase64` | `string` | none | Pre-encoded audio, no data URL prefix. |
| `model` | `string` | `"duyu-1"` | |
| `audio_format` | `SttFormat` | detected | `wav`, `mp3`, `m4a`, `webm`, `ogg`, `flac`. |
| `language` | `string` | `"tr"` | `tr`, `auto`, or a full code. |
| `prompt` | `string` | unset | Names, drug names, ID formats. |
| `temperature` | `number` | `0` | Between 0 and 1. |
| `response_format` | `SttResponseFormat` | `"json"` | `json`, `text`, `verbose_json`, `srt`, `vtt`. |
| `timestamp_granularities` | `("segment" \| "word")[]` | unset | Only with `verbose_json`. |
| `extra` | `Record<string, unknown>` | unset | Merged into the body. |

The maximum audio size is about 9 MB per request.

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
| `duration` | `number` | Seconds, when reported. |
| `segments` | `TranscriptionSegment[]` | With `verbose_json`. |
| `words` | `TranscriptionWord[]` | With `verbose_json` and word granularity. |

## Base64 helper

`toBase64()` is exported if you need to build the payload yourself. A `data:`
URL prefix is stripped automatically when you pass `audioBase64`.

```ts
import { toBase64 } from "patientdesk-sdk";

const b64 = toBase64(new Uint8Array(buf)); // no data: prefix
await pd.audio.transcribe({ audioBase64: b64, audio_format: "wav" });
```

## Live transcription

For microphone use, the WebSocket session is lower latency than the REST call.
It is undocumented and experimental, so it lives on its own page:
[Streaming](streaming.md).

## Service-side decodes

PatientDesk's REST endpoint has been observed returning `400 undecodable_audio`,
or a bundled internal stack trace, for perfectly valid files. Those are upstream
faults. The live suite labels them for you, see [Testing](testing.md).
