# Streaming

`transcribeStream()` speaks the WebSocket protocol that PatientDesk's own voice
endpoint uses at `wss://voice.patientdesk.ai/v1/audio/stream`. It is **not** in
PatientDesk's public documentation, so treat it as experimental. The protocol
mirrors what the Ömer desktop assistant uses in production.

This page describes behavior that can change without notice. For a supported
path, use the REST endpoint in [Speech to text](speech-to-text.md).

## A known endpoint change

The endpoint once took the key as a `key` query parameter. It now expects a
`token` query parameter. A `key` connection opens but never sends a `ready`
frame, and any other parameter name gets `missing_api_key`. The SDK sends
`token`. If a socket connects and then just sits there, check this first.

Authentication is passed in the URL for a browser `WebSocket`, which cannot set
headers. Treat the URL as a secret and do not log it.

The handshake is also intermittently refused. A fresh socket sometimes closes
with code `1006` before the `ready` frame, roughly one attempt in five in our
observations. Retry the connection a few times before assuming a client bug. The
[live suite](testing.md) does exactly that.

## Opening a session

```ts
const stream = pd.audio.transcribeStream(
  {
    ready: (info) => console.log("ready", info.model),
    final: (text) => console.log("final:", text),
    error: (message) => console.error(message),
    close: (code, reason) => console.log("closed", code, reason),
  },
  { sampleRate: 16000, eagerFinal: true },
);

stream.sendAudio(pcmChunk); // raw 16-bit PCM, mono
stream.stop();              // sends {type:"stop"} then closes
await stream.closed;
```

## Handshake

The client opens the socket and sends a JSON `start` frame on `open`:

```json
{ "type": "start", "sampleRate": 16000, "eager_final": true }
```

After that it sends raw audio as **binary** frames. Use 16 kHz mono signed
16-bit little-endian PCM. Extra fields can be merged into the `start` frame with
`options.extra`.

## Events

| Callback | When | Arguments |
| --- | --- | --- |
| `ready` | Server handshake. | `{ model, raw }` |
| `final` | Final transcript for an utterance. | `(text, raw)` |
| `error` | Server error frame, or a socket error. | `(message, raw)` |
| `close` | Socket closed. | `(code, reason)` |

Server frames are JSON: `ready`, `final`, `error`.

## The returned handle

| Member | Type | Notes |
| --- | --- | --- |
| `sendAudio(chunk)` | `(Uint8Array) => void` | No-op unless the socket is open. |
| `stop()` | `() => void` | Sends `{type:"stop"}` then closes with code `1000`. |
| `closed` | `Promise<void>` | Resolves when the socket closes. |

`stop()` tells the server the utterance ended so it can flush a final transcript
before the socket closes.

## Requirements

Streaming needs a `WebSocket` implementation. In Node 20 and 21 there is no
global `WebSocket`, so inject one. From Node 22 the global exists.

```ts
import WebSocket from "ws";
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey, WebSocket });
```

If no implementation is available, `transcribeStream()` throws a
`PatientDeskError` with code `no_websocket` before opening anything.

## Full example

```ts
const stream = pd.audio.transcribeStream({
  final: (text) => transcript.push(text),
});

// 160 ms of silence-trimmed 16 kHz mono PCM per frame
for await (const frame of microphoneFrames()) {
  stream.sendAudio(frame);
}
stream.stop();
await stream.closed;
console.log(transcript.join(" "));
```

## Limits

The endpoint is undocumented, so there is no SLA. Expect the framing, the sample
rate and the event names to be the moving parts if PatientDesk changes it. Pin a
version and read [Testing](testing.md) to see how the live suite covers it.
