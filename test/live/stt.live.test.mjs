import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PatientDesk } from "../../dist/index.js";
import { hasApiKey, apiKey, baseUrl, liveEnabled, fixture, attributeFault, guard } from "../../helpers/live.mjs";

const RUN = hasApiKey() && liveEnabled();
const skip = RUN ? false : "needs PATIENDESK_API_KEY and an operational service (run `npm run full-test`)";

const client = RUN
  ? new PatientDesk({ apiKey: apiKey(), ...(baseUrl() ? { baseUrl: baseUrl() } : {}), maxRetries: 1, timeout: 120_000 })
  : null;

function load(name) {
  try {
    return readFileSync(fixture(name));
  } catch {
    return null;
  }
}

const wav = load("tr-sample.wav");
const m4a = load("tr-sample.m4a");
const mp3 = load("tr-sample.mp3");
const truncated = load("tr-sample-truncated.wav");

test("live: a valid Turkish WAV is accepted (json)", { skip: skip || (wav ? false : "missing tr-sample.wav") }, async (t) => {
  const result = await guard(t, "transcribing a valid WAV", () =>
    client.audio.transcribe({ audio: wav, audio_format: "wav", language: "tr" }),
  );
  if (!result) return; // API fault, allowed to skip
  assert.equal(typeof result.text, "string");
  assert.ok(result.text.trim().length > 0, "Duyu returned an empty transcript for real speech");
  assert.match(
    result.text.toLocaleLowerCase("tr"),
    /randevu|oluşturuldu|dakika|gelin|saat/,
    `expected a Turkish keyword in: ${result.text}`,
  );
});

test("live: m4a transcribes", { skip: skip || (m4a ? false : "missing tr-sample.m4a") }, async (t) => {
  const result = await guard(t, "transcribing m4a", () => client.audio.transcribe({ audio: m4a, audio_format: "m4a", language: "tr" }));
  if (!result) return;
  assert.ok(result.text.trim().length > 0);
});

test("live: format is auto-detected when audio_format is omitted (mp3)", { skip: skip || (mp3 ? false : "missing tr-sample.mp3") }, async (t) => {
  const result = await guard(t, "auto-detecting mp3", () => client.audio.transcribe({ audio: mp3 }));
  if (!result) return;
  assert.ok(result.text.trim().length > 0);
});

test("live: verbose_json returns word timings", { skip: skip || (wav ? false : "missing tr-sample.wav") }, async (t) => {
  const result = await guard(t, "requesting verbose_json", () =>
    client.audio.transcribe({
      audio: wav,
      audio_format: "wav",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    }),
  );
  if (!result) return;
  assert.ok(result.words?.length, "expected words");
  assert.ok(result.words[0].end >= result.words[0].start);
});

test("live: genuinely undecodable audio is rejected with 400", { skip: skip || (truncated ? false : "missing tr-sample-truncated.wav") }, async (t) => {
  await guard(t, "rejecting a header-only WAV", () =>
    assert.rejects(() => client.audio.transcribe({ audio: truncated, audio_format: "wav" }), (err) => {
      assert.equal(err.status, 400, "a header-only WAV must be a client error");
      return true;
    }),
  );
});
