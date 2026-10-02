import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk } from "../../dist/index.js";
import { hasApiKey, apiKey, baseUrl, liveEnabled, sampleTurKce, guard } from "../../helpers/live.mjs";
import { parseWav } from "../../helpers/wav.mjs";

const RUN = hasApiKey() && liveEnabled();
const skip = RUN ? false : "needs PATIENDESK_API_KEY and an operational service (run `npm run full-test`)";

const client = RUN
  ? new PatientDesk({ apiKey: apiKey(), ...(baseUrl() ? { baseUrl: baseUrl() } : {}), maxRetries: 1, timeout: 120_000 })
  : null;

test("live: Alania returns a valid WAV for Turkish text", { skip }, async (t) => {
  const tts = await guard(t, "synthesizing WAV", () => client.speech.create({ input: sampleTurKce(), response_format: "wav" }));
  if (!tts) return;
  assert.match(tts.contentType, /audio\/wav/);
  const bytes = new Uint8Array(await tts.arrayBuffer());
  assert.ok(bytes.length > 44, "expected more than a WAV header");

  const { fmt, data } = parseWav(bytes);
  assert.equal(fmt.audioFormat, 1, "PCM");
  assert.equal(fmt.channels, 1, "mono");
  assert.equal(fmt.sampleRate, 24000, "24 kHz");
  assert.equal(fmt.bitsPerSample, 16, "16-bit");
  assert.ok(data.length > 0, "non-empty audio data");
});

test("live: mp3 output carries an audio/mpeg content type", { skip }, async (t) => {
  const tts = await guard(t, "synthesizing mp3", () => client.speech.create({ input: "Merhaba", response_format: "mp3" }));
  if (!tts) return;
  assert.match(tts.contentType, /audio\/mpeg/);
  const bytes = new Uint8Array(await tts.arrayBuffer());
  assert.ok(bytes.length > 0);
  const isMp3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  assert.ok(isMp3, "expected an MP3 signature");
});

test("live: the X-Disclosure header marks the audio as ai-generated", { skip }, async (t) => {
  const tts = await guard(t, "reading X-Disclosure", () => client.speech.create({ input: "Merhaba" }));
  if (!tts) return;
  assert.equal(tts.disclosure, "ai-generated");
});

test("live: an unknown voice is rejected with 400, not a silent success", { skip }, async (t) => {
  await guard(t, "rejecting an unknown voice", () =>
    assert.rejects(() => client.speech.create({ input: "Merhaba", voice: "no-such-voice" }), (err) => {
      assert.equal(err.status, 400);
      return true;
    }),
  );
});
