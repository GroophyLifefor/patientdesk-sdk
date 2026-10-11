# Streaming

Three streaming paths are documented by PatientDesk. The SDK wraps all of them:

| Path | API | Use when |
| --- | --- | --- |
| HTTP TTS | `pd.speech.stream()` | One long text, play as it is generated. |
| WebSocket TTS | `pd.speech.socket()` | Many sentences over one connection (voice assistants). |
| WebSocket STT | `pd.audio.transcribeStream()` | Live microphone / phone audio, draft + final transcripts. |

## HTTP streaming (TTS)

```ts
for await (const pcm of pd.speech.stream({
  model: "alania-v2",
  input: longText,
  response_format: "pcm", // wav | pcm | mulaw | alaw only
})) {
  player.write(pcm);      // 48 kHz mono PCM16 (24 kHz for alania-v1)
}
```

- A streamed `wav` response starts with a 44-byte RIFF header whose length fields
  are `0xFFFFFFFF`, and the helper strips it.
- Network chunks can split a sample: the helper carries the leftover byte into
  the next frame.
- Long text is split at sentence boundaries server-side, with 250 ms of silence
  between parts.
- `mp3`, `opus`, `flac` and `aac` cannot stream, those requests return 400.

`createRaw({ stream: true })` returns the raw `Response` if you want to handle
the body yourself.

## WebSocket (TTS)

`wss://voice.patientdesk.ai/v1/audio/speech/stream` keeps one connection open and
speaks sentences in order. Auth is `?key=` (or `{ token }` for a session token).

```ts
const socket = pd.speech.socket(
  {
    ready: (info) => console.log(info.model, info.sampleRate),
    speechStart: (info) => console.log(info.characters, "chars, disclosure", info.raw.disclosure),
    audio: (chunk) => player.write(chunk),   // binary PCM16 or G.711
    speechEnd: (info) => console.log(info.audioSeconds, "s,", info.inferMs, "ms"),
  },
  { model: "alania-v2", encoding: "mulaw", sampleRate: 8000 },
);

await socket.speak({ input: "Randevunuz oluşturuldu." }); // queued until `ready`
socket.stop();  // `speech_end` + `stopped` arrive, then the server closes
await socket.closed;
```

`speak()` accepts the same fields as `speech.create()` and messages are processed
one at a time. The connection can set `model`, `encoding` (`pcm_s16le`, `mulaw`,
`alaw`) and `sample_rate` for every message.

## WebSocket (STT)

`wss://voice.patientdesk.ai/v1/audio/stream` takes raw PCM and emits a `final`
transcript shortly after each sentence ends. Auth is `?key=` (or `{ token }`).

```ts
const stream = pd.audio.transcribeStream(
  {
    ready: (info) => console.log("quota", info.quota),
    vad: (info) => (meter.level = info.active ? 1 : 0),
    partial: (draft) => console.log("…", draft),
    final: (text, raw) => console.log(text, raw.start, raw.end, raw.audio_s, raw.rtf),
    stopped: (info) => console.log("billed", info.audioSeconds),
    error: (message) => console.error(message),
  },
  { sampleRate: 16000, eagerFinal: true, partials: true, partialMs: 200 },
);

stream.sendAudio(pcmChunk); // raw 16-bit PCM, mono
stream.stop();              // finalizes the open sentence, then the server closes
await stream.closed;
```

| Option | Default | Notes |
| --- | --- | --- |
| `sampleRate` | `16000` | Input rate; the server resamples (8 kHz telephony works). |
| `eagerFinal` | `true` | Finalize without waiting for the silence threshold (~120 ms sooner). |
| `partials` | off | Ask for draft `partial` events while a sentence is spoken. |
| `partialMs` | server | Draft interval in milliseconds. |
| `token` | unset | Use `?token=` instead of the API key. |
| `extra` | unset | Merged into the `start` frame. |

Events: `ready` (`model`, `quota.remaining_s`), `vad` (`prob`, `active`),
`segment_start`, `partial`, `segment_end`, `final` (`text`, `start`, `end`,
`audio_s`, `infer_ms`, `rtf`), `stopped` (`audio_s`), `error`, `close`.

With 40–100 ms of audio per binary frame the server has enough to work with.
`examples/stt-live.mjs` does exactly that.

## Requirements

Streaming needs a `WebSocket` implementation. In Node 20 and 21 there is no
global `WebSocket`, so inject one. From Node 22 the global exists.

```ts
import WebSocket from "ws";
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey, WebSocket });
```

If no implementation is available, `transcribeStream()` / `socket()` throws a
`PatientDeskError` with code `no_websocket` before opening anything.

## Known flakiness

The Websocket handshake is intermittently refused: a fresh socket sometimes
closes with code `1006` before the `ready` frame. Retry two or three times before
treating it as a client bug, the live suites do exactly that.

Authentication is passed in the URL for a browser `WebSocket`, which cannot set
headers. Treat the URL as a secret and do not log it.
