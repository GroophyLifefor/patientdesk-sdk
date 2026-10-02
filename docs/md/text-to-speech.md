# Text to speech

Alania is PatientDesk's text-to-speech model. One endpoint, `POST /audio/speech`,
takes JSON and returns the audio itself as the response body.

## Basic call

```ts
const speech = await pd.speech.create({
  input: "Yarın saat 14:05 için randevunuz var.",
  response_format: "mp3",
});

speech.contentType; // "audio/mpeg"
speech.disclosure;  // "ai-generated" (from the X-Disclosure header)
```

`create()` returns a `SpeechResponse`, a thin view over the one response body.

| Member | Type | Notes |
| --- | --- | --- |
| `response` | `Response` | The raw response. Its body can be read once. |
| `contentType` | `string` | From the `Content-Type` header, or the format table. |
| `disclosure` | `string \| null` | `X-Disclosure`, normally `ai-generated`. |
| `arrayBuffer()` | `Promise<ArrayBuffer>` | Whole audio. |
| `blob()` | `Promise<Blob>` | Whole audio with the right `type`. |
| `stream()` | `ReadableStream<Uint8Array> \| null` | The raw body stream. |

Read the body **once**. Pick one of `arrayBuffer`, `blob` or `stream`.

## Parameters

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `input` | `string` | required | Up to 5,000 characters. Longer text throws `RangeError`. |
| `model` | `string` | `"alania-v1"` | Aggregators may use a namespaced id. |
| `voice` | `string` | `"alania"` | The single built-in voice. |
| `response_format` | `TtsFormat` | `"wav"` | `wav`, `mp3`, `opus`, `flac`, `aac`, `pcm`. |
| `temperature` | `number` | server side `0.30` | `0..1`, higher is less consistent. |
| `seed` | `number` | unset | Same text and seed are not byte-identical. |
| `extra` | `Record<string, unknown>` | unset | Merged into the body for forward compatibility. |

`wav` output is 24 kHz, mono, 16-bit.

## Output formats

| `response_format` | `contentType` |
| --- | --- |
| `wav` | `audio/wav` |
| `mp3` | `audio/mpeg` |
| `opus` | `audio/ogg` |
| `flac` | `audio/flac` |
| `aac` | `audio/aac` |
| `pcm` | `audio/L16` |

When the server sends a `Content-Type`, it wins over the table.

## Low-latency streaming

`createRaw()` skips the wrapper and returns the raw `Response`, so you can pipe
`response.body` to a player without buffering the whole file.

```ts
const response = await pd.speech.createRaw({
  input: "Randevunuz oluşturuldu.",
  response_format: "pcm",
});

const reader = response.body!.getReader();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  player.write(value);
}
```

Note: the native API ignores the deprecated `stream` field and returns the audio
in one piece. Stream the returned body yourself, as above.

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

## Errors

Invalid local input throws before any request: `TypeError` for an empty `input`,
`RangeError` for text over 5,000 characters. Request failures throw
`PatientDeskError`. See [Errors](errors.md).
