# Text to speech

Alania is PatientDesk's text-to-speech model. One endpoint, `POST /audio/speech`,
takes JSON and returns the audio itself as the response body.

> **Default model:** PatientDesk's API now defaults to `alania-v2` (48 kHz). This
> SDK keeps sending `alania-v1` + `alania` (24 kHz) unless you pass a model, so
> existing code does not change. Pass `model: "alania-v2"` for the current model.

## Basic call

```ts
const speech = await pd.speech.create({
  model: "alania-v2",
  voice: "alania2-f1",
  input: "Yarın saat 14:05 için randevunuz var.",
  response_format: "mp3",
});

speech.contentType;   // "audio/mpeg"
speech.disclosure;    // "ai-generated" (x-disclosure)
speech.model;         // "alania-v2" (x-model)
speech.characters;    // billed characters (x-characters; 0 for antalia-mini)
speech.audioSeconds;  // x-audio-seconds (absent while streaming)
speech.queueWaitMs;   // x-queue-wait-ms
```

`create()` returns a `SpeechResponse`, a thin view over the one response body.

| Member | Type | Notes |
| --- | --- | --- |
| `response` | `Response` | The raw response. Its body can be read once. |
| `contentType` | `string` | From the `Content-Type` header, or the format table. |
| `disclosure` | `string \| null` | `x-disclosure`, normally `ai-generated`. |
| `requestId` | `string \| null` | `x-request-id`; share it in support requests. |
| `model` | `string \| null` | `x-model`. |
| `characters` | `number \| null` | Billed characters. |
| `audioSeconds` | `number \| null` | Duration of the generated audio. |
| `queueWaitMs` | `number \| null` | Time spent waiting for a generation slot. |
| `sampleRate` | `number \| null` | Parsed from `Content-Type` (`rate=`), when present. |
| `arrayBuffer()` | `Promise<ArrayBuffer>` | Whole audio. |
| `blob()` | `Promise<Blob>` | Whole audio with the right `type`. |
| `stream()` | `ReadableStream<Uint8Array> \| null` | The raw body stream. |

Read the body **once**. Pick one of `arrayBuffer`, `blob` or `stream`.

## Common parameters

| Field | Type | SDK default | Notes |
| --- | --- | --- | --- |
| `input` | `string` | required | Up to 5,000 characters. Longer text throws `RangeError`. |
| `model` | `string` | `"alania-v1"` | `alania-v2`, `alania-v1`, `antalia-mini` (free). The API's own default is `alania-v2`. |
| `voice` | `string` | model's voice | Defaults: `alania` (v1), `alania2-f1` (v2), `antalia-mini`. Saved voice ids work too. |
| `response_format` | `TtsFormat` | `"wav"` | `wav`, `mp3`, `opus`, `flac`, `aac`, `pcm`, `mulaw`, `alaw`. |
| `sample_rate` | `number` | model's rate | `8000`, `16000`, `22050`, `24000`, `44100`, `48000` (capped at the model). G.711 defaults to 8000. |
| `temperature` | `number` | server side | v1: 0–2.0 (default 0.30) · v2: 0.6–2.0 (default 1.0). |
| `seed` | `number` | unset | Same text + seed + settings reproduce the same audio. |
| `stream` | `boolean` | `false` | Stream the audio as it is generated; see [Streaming](streaming.md). |
| `extra` | `Record<string, unknown>` | unset | Merged into the body for forward compatibility. |

## Alania-2 fields

| Field | Type | Notes |
| --- | --- | --- |
| `style` | `string` | Ready style id: `support-warm`, `support-calm`, `sales-energetic`, `reception-smile` (`pd.styles.list()`). Cannot combine with `instructions`/`voice_description`. |
| `instructions` | `string` | How to speak, ≤200 characters, no parentheses. Non-English is translated. |
| `voice_description` | `string` | Design a new voice from a description, ≤200 characters. Combine with `seed` to reproduce it. |
| `reference_audio` | `Uint8Array \| ArrayBuffer \| Blob \| string` | Clone from a 3–30 s sample (≤10 MB); bytes or base64/data URI. |
| `reference_text` | `string` | Transcript of the sample (≤1,000 chars). Accepted, not used. |
| `consent` | `boolean` | Required with `reference_audio`: declares the speaker consented. |
| `pronunciations` | `object \| array` | Per-request overrides, e.g. `{ PatientDesk: "Peyşınt Desk" }` (≤200). Beats the saved dictionary. |
| `cfg` | `number` | 1.0–5.0 guidance strength (default 2.0, design 3.0). |
| `top_p` | `number` | alania-v1 only (0.01–1.0, default 0.9); alania-v2 ignores it. |

Sending an Alania-2 field with `model: "alania-v1"` is rejected with
`unsupported_field`, not silently ignored. Likewise `instructions` +
`voice_description` (or `style`) is rejected with `conflicting_fields`.

## Output formats

| `response_format` | `contentType` | Notes |
| --- | --- | --- |
| `wav` | `audio/wav` | 16-bit mono; 48 kHz (v2) or 24 kHz (v1). |
| `pcm` | `audio/L16` | Headerless; the rate is in `Content-Type` (`audio/L16; rate=48000`). |
| `mulaw` | `audio/PCMU` | Headerless G.711, one byte per sample, 8 kHz by default. |
| `alaw` | `audio/PCMA` | Same, A-law. |
| `mp3` | `audio/mpeg` | |
| `opus` | `audio/ogg` | |
| `flac` | `audio/flac` | |
| `aac` | `audio/aac` | |

When the server sends a `Content-Type`, it wins over the table.

## Streaming

```ts
// Yields PCM as it is generated. Strips the streamed WAV header and carries a
// sample split across network chunks.
for await (const pcm of pd.speech.stream({ model: "alania-v2", input: longText })) {
  player.write(pcm); // 48 kHz mono PCM16 (24 kHz for alania-v1)
}
```

`createRaw()` skips the wrapper: pass `stream: true` and read `response.body`
yourself. Only `wav`, `pcm`, `mulaw` and `alaw` stream. Compressed formats
return 400. For many sentences over one connection, use the WebSocket session,
see [Streaming](streaming.md).

## Splitting long text

Alania accepts at most 5,000 characters. Split on sentence boundaries and join
the resulting files with `ffmpeg` if you need a single recording.

```ts
const chunks = splitBySentence(longText, 5000);
for (const [i, chunk] of chunks.entries()) {
  const speech = await pd.speech.create({ input: chunk, response_format: "mp3" });
  await Deno.writeFile(`part-${i}.mp3`, new Uint8Array(await speech.arrayBuffer()));
}
```

## Saving voices

A clone or a design can be saved once and then used by id:

```ts
await pd.voices.save({ name: "Sesim", file: sampleBytes, consent: true });
await pd.voices.save({ name: "Danışman", voice_description, seed: 4242, input: designText });
await pd.speech.create({ model: "alania-v2", voice: savedId, input: "Merhaba" });
```

## Errors

Invalid local input throws before any request: `TypeError` for an empty `input`,
`RangeError` for text over 5,000 characters or a `reference_audio` over 10 MB.
Request failures throw `PatientDeskError`. See [Errors](errors.md).
