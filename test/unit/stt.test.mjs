import test from "node:test";
import assert from "node:assert/strict";
import { MAX_AUDIO_BYTES, PatientDesk } from "../../dist/index.js";
import { mockFetch, json, errorResponse } from "../../helpers/fetch-mock.mjs";

const URL_STT = "https://voice.patientdesk.ai/v1/audio/transcriptions";
const TRANSCRIPT = { text: "Randevunuz oluşturuldu." };

function sdk(handler) {
  const fetch = mockFetch(handler);
  return { pd: new PatientDesk({ apiKey: "k", fetch, maxRetries: 0 }), fetch };
}

/** Flatten a FormData body into an object; repeated keys become arrays. */
function formOf(init) {
  assert.ok(init.body instanceof FormData, "expected a multipart/form-data body");
  const entries = {};
  for (const [key, value] of init.body.entries()) {
    if (entries[key] === undefined) entries[key] = value;
    else if (Array.isArray(entries[key])) entries[key].push(value);
    else entries[key] = [entries[key], value];
  }
  return entries;
}

async function fileBytes(form) {
  const file = form.get("file");
  assert.ok(file instanceof Blob, "expected a file part");
  return new Uint8Array(await file.arrayBuffer());
}

test("transcribe() uploads multipart with the defaults", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  const result = await pd.audio.transcribe({
    audio: new Uint8Array([1, 2, 3]),
    audio_format: "m4a",
    language: "tr",
  });
  assert.equal(fetch.calls[0].url, URL_STT);
  assert.equal(fetch.calls[0].method, "POST");

  const headers = fetch.calls[0].init.headers;
  assert.equal(headers.authorization, "Bearer k");
  assert.equal(headers["content-type"], undefined, "multipart bodies must set their own content-type");

  const form = formOf(fetch.calls[0].init);
  assert.equal(form.model, "duyu-1");
  assert.equal(form.language, "tr");
  assert.equal(form.file.name, "audio.m4a");
  assert.equal(form.file.type, "audio/mp4");
  assert.deepEqual([...(await fileBytes(fetch.calls[0].init.body))], [1, 2, 3]);
  assert.equal(result.text, "Randevunuz oluşturuldu.");
});

test("transcribe() accepts ArrayBuffer and Blob inputs", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audio: new Uint8Array([1, 2, 3]).buffer });
  await pd.audio.transcribe({ audio: new Blob([new Uint8Array([4, 5, 6])]) });
  assert.deepEqual([...(await fileBytes(fetch.calls[0].init.body))], [1, 2, 3]);
  assert.deepEqual([...(await fileBytes(fetch.calls[1].init.body))], [4, 5, 6]);
  // No format hint: a generic upload name and type.
  assert.equal(formOf(fetch.calls[0].init).file.name, "audio.bin");
});

test("transcribe() decodes audioBase64 (data URL prefix stripped) into the file part", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "data:audio/m4a;base64,AQID" });
  const form = formOf(fetch.calls[0].init);
  assert.deepEqual([...new Uint8Array(await form.file.arrayBuffer())], [1, 2, 3]);
});

test("transcribe() forwards prompt and temperature", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "AQID", prompt: "ilaç: parol", temperature: 0.2 });
  const form = formOf(fetch.calls[0].init);
  assert.equal(form.prompt, "ilaç: parol");
  assert.equal(form.temperature, "0.2");
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
  const result = await pd.audio.transcribe({
    audioBase64: "AQID",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  });
  const form = formOf(fetch.calls[0].init);
  assert.equal(form.response_format, "verbose_json");
  assert.deepEqual(form["timestamp_granularities[]"], ["segment", "word"]);
  assert.equal(result.words[0].word, "merhaba");
  assert.equal(result.segments[0].text, "merhaba dünya");
  assert.equal(result.duration, 8.5);
});

test("transcribe() omits timestamp_granularities when not verbose", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await pd.audio.transcribe({ audioBase64: "AQID" });
  assert.equal(formOf(fetch.calls[0].init)["timestamp_granularities[]"], undefined);
});

test("transcribe() requires some audio (no network call)", async () => {
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await assert.rejects(() => pd.audio.transcribe({}), TypeError);
  await assert.rejects(() => pd.audio.transcribe({ audio: new Uint8Array() }), TypeError);
  await assert.rejects(() => pd.audio.transcribe({ audio: "not-bytes" }), TypeError);
  assert.equal(fetch.calls.length, 0);
});

test("transcribe() rejects audio over the 100 MB limit without a network call", async () => {
  assert.equal(MAX_AUDIO_BYTES, 100 * 1024 * 1024);
  const { pd, fetch } = sdk(() => json(TRANSCRIPT));
  await assert.rejects(() => pd.audio.transcribe({ audio: new Uint8Array(MAX_AUDIO_BYTES + 1) }), (err) => {
    assert.ok(err instanceof RangeError);
    assert.match(err.message, /100 MB/);
    return true;
  });
  assert.equal(fetch.calls.length, 0);
});

test("a 400 unsupported_input surfaces the code", async () => {
  const { pd } = sdk(() => errorResponse({ status: 400, message: "file_id unsupported", code: "unsupported_input" }));
  await assert.rejects(() => pd.audio.transcribe({ audioBase64: "AQID" }), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, "unsupported_input");
    return true;
  });
});
