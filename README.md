# patientdesk-sdk

**Unofficial** SDK for [PatientDesk](https://speech.patientdesk.ai) Turkish voice models:

- **Alania** — text-to-speech (`POST /v1/audio/speech`)
- **Duyu** — speech-to-text (`POST /v1/audio/transcriptions`, plus undocumented WebSocket streaming)
- **Statuspage** — keyless health check (`GET https://status.patientdesk.ai/api/v2/status.json`)

> Not affiliated with, endorsed by, or supported by PatientDesk. It is an
> independent client for their public, OpenAI-compatible API.

Zero runtime dependencies. Works on Node 20+, Deno, Bun and edge runtimes
(uses the global `fetch` / `WebSocket`; both can be injected).

## Install

```sh
npm install patientdesk-sdk
```

## Quick start

```ts
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

// Text to speech (Alania)
const speech = await pd.speech.create({ input: "Randevunuz oluşturuldu.", response_format: "wav" });
const wav = new Uint8Array(await speech.arrayBuffer());

// Speech to text (Duyu) — base64 JSON, no multipart
const { text } = await pd.audio.transcribe({ audio: wav, audio_format: "wav", language: "tr" });
console.log(text);

// Health (no API key)
import { fetchStatus, isOperational } from "patientdesk-sdk";
console.log(isOperational(await fetchStatus()) ? "up" : "degraded");
```

## Text to speech (Alania)

```ts
const speech = await pd.speech.create({
  input: "Yarın saat 14:05 için randevunuz var.", // ≤ 5,000 chars
  voice: "alania",             // the only voice
  response_format: "mp3",      // wav | mp3 | opus | flac | aac | pcm
  temperature: 0.3,
});

speech.contentType;  // "audio/mpeg"
speech.disclosure;   // "ai-generated" (from the X-Disclosure header)
await speech.arrayBuffer();     // whole file
await speech.blob();            // Blob with the right type
speech.stream();                // ReadableStream<Uint8Array> for low latency
```

`createRaw()` returns the raw `Response` if you want to pipe `response.body`
straight into a player without buffering.

## Speech to text (Duyu)

The audio is base64-encoded in a JSON body. `multipart` / `file_id` are **not**
supported by the endpoint.

```ts
// response_format: json (default) -> typed transcript
const { text, words } = await pd.audio.transcribe({
  audio: await loadFile("kayit.m4a"),   // Uint8Array | ArrayBuffer | Blob
  audio_format: "m4a",                  // optional, auto-detected otherwise
  language: "tr",                       // or "auto"
  prompt: "ilaç: parol",                // optional spelling hint
});

// response_format: verbose_json -> segments + word timings
const detailed = await pd.audio.transcribe({
  audio: bytes, response_format: "verbose_json", timestamp_granularities: ["word"],
});

// response_format: text | srt | vtt -> raw string
const srt = await pd.audio.transcribe({ audio: bytes, response_format: "srt" });
```

### Streaming (experimental, undocumented)

`transcribeStream()` speaks the WebSocket protocol that PatientDesk's own voice
endpoint uses at `wss://voice.patientdesk.ai/v1/audio/stream`. It is **not** part
of their public docs, so treat it as experimental.

```ts
const stream = pd.audio.transcribeStream(
  { ready: () => {}, final: (text) => console.log(text), error: (m) => console.error(m) },
  { sampleRate: 16000, eagerFinal: true },
);

stream.sendAudio(pcmChunk); // raw 16-bit PCM, mono
stream.stop();              // sends {type:"stop"} then closes
await stream.closed;
```

## Errors

Every non-2xx response (and transport failure) throws a `PatientDeskError` with
`status`, `code`, `reason`, `scope`, `retryAfterSeconds` and `resetAt`:

```ts
import { PatientDeskError } from "patientdesk-sdk";
try {
  await pd.speech.create({ input: "x" });
} catch (err) {
  if (err instanceof PatientDeskError && err.isRateLimit) {
    console.log(`quota (${err.scope}) resets at ${err.resetsAt}`);
  }
}
```

`429`/`5xx`/network failures are retried with backoff (honouring `Retry-After`);
other `4xx` are returned immediately.

## Testing

Two suites, by design:

| Command | Needs key | Hits the network | Purpose |
| --- | --- | --- | --- |
| `npm test` | no | no | unit + contract tests with a mock `fetch`/`WebSocket` |
| `npm run full-test` | **yes** | **yes** | the above, then live tests against PatientDesk |

`full-test` runs `scripts/preflight.mjs` first: it requires `PATIENDESK_API_KEY`
and checks the Statuspage. If the service is not fully operational, the live
suite does not run (with a single, clear message) — you can never get a silent
green.

### Deciding "is it us or is it PatientDesk?"

Live tests classify failures:

- `SDK FAULT while …` — the request was well-formed, so a failure is on us.
- `PATIENDESK API FAULT while …` — PatientDesk surfaced its own internal error
  (e.g. `undecodable_audio` for a valid file, or an internal stack trace). This
  still **fails** the run by default, but the message names the culprit.

Set `PATIENDESK_ALLOW_API_FAULTS=1` to downgrade *API* faults to skipped (still
printed) so a genuine outage does not look like a broken repository:

```sh
PATIENDESK_ALLOW_API_FAULTS=1 npm run full-test
```

Test fixtures (`test/fixtures/`, see `npm run fixtures`) are real speech
generated with Alania and converted with ffmpeg into wav/m4a/mp3/ogg/webm/flac
and 16 kHz PCM, plus a deliberately truncated WAV.

## Environment

| Variable | Used by | Notes |
| --- | --- | --- |
| `PATIENDESK_API_KEY` | all clients | also read from `PATIENDESK_KEY` |
| `PATIENDESK_BASE_URL` | full-test | override the API base |

## Release flow

Releases are automated from tags:

1. Bump `version` in `package.json` and push to `main`.
2. Push a matching tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. The `release` workflow verifies the tag matches `package.json`, publishes to
   npm with provenance, and creates a GitHub Release.

A repository secret `NPM_TOKEN` (an npm automation token with publish rights) is
required under **Settings → Secrets and variables → Actions**.

## License

[MIT](./LICENSE)

---

## Türkçe

PatientDesk'in **resmî olmayan** Türkçe ses SDK'sı: **Alania** (metinden sese) ve
**Duyu** (sesten metne, REST + dokümante edilmemiş WebSocket akışı). Sıfır çalışma
zamanı bağımlılığı; Node 20+, Deno, Bun.

```ts
const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

const ses = await pd.speech.create({ input: "Randevunuz oluşturuldu.", response_format: "wav" });
const metin = await pd.audio.transcribe({ audio: await ses.arrayBuffer(), audio_format: "wav" });
```

### Testler

- `npm test` — ağ yok, anahtar yok; sahte `fetch`/`WebSocket` ile birim + sözleşme
  testleri.
- `npm run full-test` — **API anahtarı gerekir**, canlı PatientDesk'e gider.
  Önce `scripts/preflight.mjs` çalışır: anahtar + Statuspage kontrolü. Servis
  ayakta değilse canlı takım çalışmaz ve asla sessizce "yeşil" vermez.

Hata **bizde mi, PatientDesk'te mi** ayrımı:

- `SDK FAULT while …` — istek doğruydu, hata bizde.
- `PATIENDESK API FAULT while …` — PatientDesk kendi iç hatasını döndürdü
  (geçerli dosyaya `undecodable_audio` gibi). Varsayılan olarak yine **başarısız**
  sayılır; ama mesaj suçluyu söyler.

`PATIENDESK_ALLOW_API_FAULTS=1` ile PatientDesk kaynaklı hatalar "skipped"
(sessizce gizlenmez, yazdırılır) olur; böylece gerçek bir kesinti kod deposu
bozukmuş gibi görünmez.
