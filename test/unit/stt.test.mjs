import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk } from "../../dist/index.js";
import { mockFetch, json, errorResponse } from "../../helpers/fetch-mock.mjs";

const URL_STT = "https://voice.patientdesk.ai/v1/audio/transcriptions";
const TRANSCRIPT = { text: "Randevunuz oluşturuldu." };

function sdk(handler) {
  const fetch = mockFetch(handler);
  return { pd: new PatientDesk({ apiKey: "k", fetch, maxRetries: 0 }), fetch };
}

test("transcribe() base64-encodes bytes and defaults to the JSON result", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  const result = await pd.audio.transcribe({ audio: new Uint8Array([1, 2, 3]), audio_format: "m4a", language: "tr" });
  assert.equal(fetch.calls[0].url, URL_STT);
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), {
    model: "duyu-1",
    audio_base64: "AQID",
    audio_format: "m4a",
    language: "tr",
  });
  assert.equal(result.text, "Randevunuz oluşturuldu.");
});

test("transcribe() accepts ArrayBuffer and Blob inputs", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audio: new Uint8Array([1, 2, 3]).buffer });
  await pd.audio.transcribe({ audio: new Blob([new Uint8Array([1, 2, 3])]) });
  assert.equal(JSON.parse(fetch.calls[0].init.body).audio_base64, "AQID");
  assert.equal(JSON.parse(fetch.calls[1].init.body).audio_base64, "AQID");
});

test("transcribe() strips a data URL prefix from audioBase64", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "data:audio/m4a;base64,AQID" });
  assert.equal(JSON.parse(fetch.calls[0].init.body).audio_base64, "AQID");
});

test("transcribe() forwards prompt and temperature", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "AQID", prompt: "ilaç: parol", temperature: 0.2 });
  const body = JSON.parse(fetch.calls[0].init.body);
  assert.equal(body.prompt, "ilaç: parol");
  assert.equal(body.temperature, 0.2);
});

test("transcribe() returns plain text/srt/vtt strings", async () => {
  const { pd } = sdk(() => new Response("1\n00:00:00,000 --> 00:00:01,000\nhi\n", { headers: { "content-type": "text/plain" } }));
  const srt = await pd.audio.transcribe({ audioBase64: "AQID", response_format: "srt" });
  assert.equal(typeof srt, "string");
  assert.match(srt, /00:00:00,000/);
});

test("transcribe() verbose_json forwards granularity and parses timings", async () => {
  const payload = {
    task: "transcribe",
    language: "tr",
    duration: 8.5,
    text: "merhaba dünya",
    segments: [{ id: 0, start: 0, end: 1, text: "merhaba dünya" }],
    words: [{ word: "merhaba", start: 0, end: 1, probability: 0.9 }],
  };
  const { pd, fetch } = sdk(() => json(payload));
  const result = await pd.audio.transcribe({ audioBase64: "AQID", response_format: "verbose_json", timestamp_granularities: ["word"] });
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body).timestamp_granularities, ["word"]);
  assert.equal(result.words[0].word, "merhaba");
  assert.equal(result.segments[0].text, "merhaba dünya");
  assert.equal(result.duration, 8.5);
});

test("transcribe() omits timestamp_granularities when not verbose", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "AQID" });
  assert.equal(JSON.parse(fetch.calls[0].init.body).timestamp_granularities, undefined);
});

test("transcribe() requires some audio (no network call)", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await assert.rejects(() => pd.audio.transcribe({}), TypeError);
  await assert.rejects(() => pd.audio.transcribe({ audio: new Uint8Array() }), TypeError);
  await assert.rejects(() => pd.audio.transcribe({ audio: "not-bytes" }), TypeError);
  assert.equal(fetch.calls.length, 0);
});

test("a 400 unsupported_input (file_id) surfaces the code", async () => {
  const { pd } = sdk(() => errorResponse({ status: 400, message: "file_id unsupported", code: "unsupported_input" }));
  await assert.rejects(() => pd.audio.transcribe({ audioBase64: "AQID" }), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, "unsupported_input");
    return true;
  });
});
