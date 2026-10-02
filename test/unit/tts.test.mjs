import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk } from "../../dist/index.js";
import { mockFetch, audio, errorResponse } from "../../helpers/fetch-mock.mjs";

const URL_SPEECH = "https://voice.patientdesk.ai/v1/audio/speech";

test("create() sends model/input/voice and the default format", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const speech = await pd.speech.create({ input: "Merhaba" });
  assert.equal(fetch.calls[0].url, URL_SPEECH);
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), {
    model: "alania-v1",
    input: "Merhaba",
    voice: "alania",
    response_format: "wav",
  });
  assert.equal(speech.contentType, "audio/wav");
});

test("create() forwards temperature, seed, stream and extra fields", async () => {
  const fetch = mockFetch(() => audio([], "audio/mpeg"));
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await pd.speech.create({ input: "x", response_format: "mp3", temperature: 0.5, seed: 7, stream: true, extra: { lang: "tr" } });
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), {
    model: "alania-v1",
    input: "x",
    voice: "alania",
    response_format: "mp3",
    temperature: 0.5,
    seed: 7,
    stream: true,
    lang: "tr",
  });
});

test("create() exposes arrayBuffer, blob, stream and disclosure", async () => {
  const fetch = mockFetch(() => audio([1, 2, 3, 4], "audio/wav", { "x-disclosure": "ai-generated" }));
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const speech = await pd.speech.create({ input: "x" });
  assert.equal(speech.disclosure, "ai-generated");
  assert.equal(new Uint8Array(await speech.arrayBuffer()).length, 4);

  const blob = await (await pd.speech.create({ input: "x" })).blob();
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 4);

  const stream = (await pd.speech.create({ input: "x" })).stream();
  assert.ok(stream instanceof ReadableStream);
});

test("create() falls back to a known content-type when the header is missing", async () => {
  const fetch = mockFetch(() => new Response(new Uint8Array([1]), { status: 200, headers: {} }));
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const speech = await pd.speech.create({ input: "x", response_format: "pcm" });
  assert.equal(speech.contentType, "audio/L16");
});

test("createRaw() lets the caller read response.body directly", async () => {
  const fetch = mockFetch(() => audio([9, 9, 9]));
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const res = await pd.speech.createRaw({ input: "x" });
  const reader = res.body.getReader();
  const { value } = await reader.read();
  assert.equal(value.length, 3);
});

test("create() rejects empty input without a network call", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await assert.rejects(() => pd.speech.create({ input: "   " }), TypeError);
  assert.equal(fetch.calls.length, 0);
});

test("create() rejects input over 5,000 chars without a network call", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await assert.rejects(() => pd.speech.create({ input: "a".repeat(5001) }), (err) => {
    assert.ok(err instanceof RangeError);
    assert.match(err.message, /5000|5,000/);
    return true;
  });
  assert.equal(fetch.calls.length, 0);
});

test("create() allows exactly 5,000 chars", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await pd.speech.create({ input: "a".repeat(5000) });
  assert.equal(fetch.calls.length, 1);
});

test("a 400 invalid_request surfaces code + message", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 400, message: "input too long", code: "invalid_request" }));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 0 });
  await assert.rejects(() => pd.speech.create({ input: "x" }), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.code, "invalid_request");
    assert.equal(err.message, "input too long");
    return true;
  });
});
