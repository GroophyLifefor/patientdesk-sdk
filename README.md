# patientdesk-sdk

**Unofficial** SDK for [PatientDesk](https://speech.patientdesk.ai) Turkish voice models:

- **Alania** — text-to-speech (`POST /v1/audio/speech`, HTTP streaming + WebSocket)
- **Duyu** — speech-to-text (multipart `POST /v1/audio/transcriptions` + WebSocket streaming)
- **Voices / pronunciations / styles / models / usage** — the account and catalog endpoints
- **Statuspage + `/health/alania`** — health checks (no API key)

> Not affiliated with, endorsed by, or supported by PatientDesk. It is an
> independent client for their public, OpenAI-compatible API.

Full guides and the API reference live at
[groophylifefor.github.io/patientdesk-sdk](https://groophylifefor.github.io/patientdesk-sdk/).

Zero runtime dependencies. Works on Node 20+, Deno, Bun and edge runtimes
(uses the global `fetch`, `FormData`, `Blob` and `WebSocket`; all can be injected).

## Install

```sh
npm install patientdesk-sdk
```

## Quick start

```ts
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

// Text to speech (Alania). The SDK keeps Alania-1 as its default for backward
// compatibility; pass model/voice to opt into Alania-2 (48 kHz).
const speech = await pd.speech.create({
  model: "alania-v2",
  voice: "alania2-f1",
  input: "Randevunuz oluşturuldu.",
  response_format: "wav", // wav | mp3 | opus | flac | aac | pcm | mulaw | alaw
});
const wav = new Uint8Array(await speech.arrayBuffer());
console.log(speech.model, speech.characters, speech.audioSeconds);

// Speech to text (Duyu) — multipart upload
const { text } = await pd.audio.transcribe({ audio: wav, audio_format: "wav", language: "tr" });
console.log(text);

// Health (no API key)
import { fetchStatus, fetchAlaniaHealth, isOperational } from "patientdesk-sdk";
console.log(isOperational(await fetchStatus()) ? "statuspage: up" : "statuspage: degraded");
console.log((await fetchAlaniaHealth()).status);
```

## Text to speech (Alania)

```ts
const speech = await pd.speech.create({
  input: "Yarın saat 14:05 için randevunuz var.", // ≤ 5,000 chars
  model: "alania-v2",           // alania-v2 | alania-v1 | antalia-mini | ...
  voice: "alania2-f1",          // alania2-f1/m1/m2/f2, alania, antalia-mini, saved voice id
  response_format: "mp3",       // wav | mp3 | opus | flac | aac | pcm | mulaw | alaw
  sample_rate: 24000,           // 8000…48000, capped at the model's rate
  instructions: "speaking slowly and calmly", // alania-v2 only
  seed: 42,                     // same seed + text + settings = same audio
});

speech.contentType;   // "audio/mpeg"
speech.disclosure;    // "ai-generated" (x-disclosure)
speech.requestId;     // x-request-id
speech.model;         // x-model
speech.characters;    // x-characters (billed; 0 for the free antalia-mini)
speech.audioSeconds;  // x-audio-seconds
speech.queueWaitMs;   // x-queue-wait-ms
await speech.arrayBuffer();   // whole file
await speech.blob();          // Blob with the right type
speech.stream();              // ReadableStream<Uint8Array> for low latency
```

`createRaw()` returns the raw `Response` if you want to pipe `response.body`
straight into a player.

### Alania-2 features

| Feature | Fields |
| --- | --- |
| Style instructions | `instructions` (≤200 chars) or a ready `style` id (`support-warm`, `support-calm`, `sales-energetic`, `reception-smile`) |
| Voice design | `voice_description` (≤200 chars) + `seed` |
| Voice cloning (beta) | `reference_audio` + `consent: true` (3–30 s, ≤10 MB), or a saved voice id |
| Pronunciation dictionary | `pronunciations` per request, or `pd.pronunciations` for the account |
| Guidance | `cfg` (1.0–5.0, alania-v2) · `temperature` (0.6–2.0, default 1.0) |
| Telephony | `response_format: "mulaw"` (or `"alaw"`) — headerless G.711 at 8 kHz |

Alania-2 fields sent with `model: "alania-v1"` are rejected with
`unsupported_field` instead of being silently ignored.

### HTTP streaming

```ts
// Yields PCM as it is generated; strips the streamed WAV header (44 bytes,
// 0xFFFFFFFF length fields) and carries a sample split across chunks.
for await (const pcm of pd.speech.stream({ model: "alania-v2", input: longText, response_format: "pcm" })) {
  player.write(pcm); // 48 kHz mono PCM16
}
```

Only `wav`, `pcm`, `mulaw` and `alaw` stream; compressed formats return 400.

### WebSocket (many sentences, one connection)

```ts
const socket = pd.speech.socket(
  {
    speechStart: (info) => console.log(info.sampleRate),
    audio: (chunk) => player.write(chunk),
    speechEnd: (info) => console.log(info.audioSeconds),
  },
  { model: "alania-v2", encoding: "mulaw", sampleRate: 8000 },
);
await socket.speak({ input: "Randevunuz oluşturuldu." });
socket.stop();       // `speech_end`/`stopped` arrive before the close
await socket.closed;
```

## Speech to text (Duyu)

The audio is uploaded as `multipart/form-data` (`file`, `model`, `language`,
`prompt`, `response_format`, `timestamp_granularities[]`, `temperature`).
Up to 100 MB / 2 hours per request; longer files are split server-side.
`audioBase64` still works — it is decoded locally and uploaded as the file part.

```ts
// response_format: json (default) -> typed transcript
const { text, words } = await pd.audio.transcribe({
  audio: await loadFile("kayit.m4a"),   // Uint8Array | ArrayBuffer | Blob
  audio_format: "m4a",                  // names the upload; server detects the format
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

### Live streaming (documented)

```ts
const stream = pd.audio.transcribeStream(
  {
    ready: (info) => console.log("quota", info.quota),
    partial: (draft) => console.log("…", draft),   // partials: true
    final: (text, raw) => console.log(text, raw.start, raw.end, raw.audio_s),
    stopped: (info) => console.log("billed", info.audioSeconds),
  },
  { sampleRate: 16000, eagerFinal: true, partials: true, partialMs: 200 },
);

stream.sendAudio(pcmChunk); // raw 16-bit PCM, mono
stream.stop();              // finalizes the open sentence, then the server closes
await stream.closed;
```

Auth uses `?key=`; pass `{ token }` for a short-lived session token instead.

For microphone capture see `examples/stt-mic.mjs` (record, then transcribe) and
`examples/stt-live.mjs` (live drafts and finals over the stream).

## Account and catalog

```ts
await pd.voices.list();                    // built-ins + saved clones/designs
await pd.voices.save({ name, file, consent: true });        // save a clone
await pd.voices.save({ name, voice_description, seed, input }); // save a design
await pd.voices.delete(id);

await pd.pronunciations.list();
await pd.pronunciations.add({ term: "PatientDesk", say_as: "Peyşınt Desk" });
await pd.pronunciations.delete(id);

await pd.styles.list();     // ready style ids
await pd.models.list();     // alania-v2 default, antalia-mini free, …
await pd.usage();           // quota usage
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
other `4xx` are returned immediately. `429 quota_exceeded` is **not** retried —
waiting will not clear it.

## Upstream docs tracking

PatientDesk's docs change independently of this SDK. `scripts/docwatch.mjs`
snapshots the public docs (TR + EN) so drift is easy to review:

- `npm run upstream:diff` — fetch the docs and compare against the baseline
  (`upstream-docs/**`, kept on the `upstream-docs` branch); exits non-zero on drift.
- `npm run upstream:sync` — update the baseline and write `drift-report.md`.

A daily workflow (`.github/workflows/docwatch.yml`) runs the same check and, when
something changed, opens (or comments on) a `docs-drift` issue with a per-page
diff and assigns the maintainer. The snapshot commit goes to `upstream-docs`
only — `main` stays clean.

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
2. Push a matching tag: `git tag v0.2.0 && git push origin v0.2.0`.
3. The `release` workflow verifies the tag matches `package.json`, publishes to
   npm with provenance, and creates a GitHub Release.

A repository secret `NPM_TOKEN` (an npm automation token with publish rights) is
required under **Settings → Secrets and variables → Actions**.

## License

[MIT](./LICENSE)

---

## Türkçe

PatientDesk'in **resmî olmayan** Türkçe ses SDK'sı: **Alania** (metinden sese)
ve **Duyu** (sesten metne, multipart REST + dokümante WebSocket akışı). Sıfır
çalışma zamanı bağımlılığı; Node 20+, Deno, Bun.

Dokümanlar: [groophylifefor.github.io/patientdesk-sdk](https://groophylifefor.github.io/patientdesk-sdk/)

```ts
const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

// Varsayılan hâlâ alania-v1'dir (geriye dönük uyumluluk); Alania-2 için model belirtin.
const ses = await pd.speech.create({
  model: "alania-v2",
  voice: "alania2-f1",
  input: "Randevunuz oluşturuldu.",
  response_format: "wav",
});
const metin = await pd.audio.transcribe({ audio: await ses.arrayBuffer(), audio_format: "wav" });
```

> Önemli: PatientDesk API'sinin kendi varsayılanı artık `alania-v2` + `alania2-f1`
> (48 kHz). SDK, mevcut kullanıcıları bozmamak için hâlâ `alania-v1` + `alania`
> (24 kHz) gönderir. Yeni özellikler (üslup, tasarım, klonlama, mulaw/alaw,
> akış) için `model`/`voice` alanlarını açıkça gönderin.

### Neler var

- **Alania-2** alanları: `style`, `instructions`, `voice_description`,
  `reference_audio` + `consent`, `pronunciations`, `cfg`, `sample_rate`
- **Telefon**: `response_format: "mulaw"` / `"alaw"` (8 kHz G.711) ve
  `pd.speech.socket()` WebSocket oturumu
- **HTTP akışı**: `pd.speech.stream()` (WAV başlığı atılır, bölünen örnek taşınır)
- **Duyu**: multipart yükleme (100 MB / 2 saat), `partial`/`vad`/`segment_*`
  olayları, `stop()` artık açık cümleyi finalize edilmesini bekler
- **Hesap uçları**: `pd.voices`, `pd.pronunciations`, `pd.styles`, `pd.models`,
  `pd.usage()`, `fetchAlaniaHealth()`

### Doküman takibi

`npm run upstream:diff` PatientDesk dokümanlarını baseline ile karşılaştırır
(değişiklikte çıkış kodu 1); `npm run upstream:sync` baseline'ı günceller. Günlük
workflow değişiklikte sayfa bazlı diff ile `docs-drift` issue açar ve maintainer'ı
etiketler. Snapshot'lar yalnız `upstream-docs` dalında tutulur.

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
