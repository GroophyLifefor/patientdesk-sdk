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

test("create() forwards the alania-v2 fields and picks the model's default voice", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await pd.speech.create({
    model: "alania-v2",
    input: "x",
    style: "support-warm",
    instructions: "speaking slowly",
    pronunciations: { PatientDesk: "Peyşınt Desk" },
    cfg: 2.5,
    sample_rate: 16000,
    consent: true,
  });
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), {
    model: "alania-v2",
    input: "x",
    voice: "alania2-f1",
    response_format: "wav",
    sample_rate: 16000,
    style: "support-warm",
    instructions: "speaking slowly",
    consent: true,
    pronunciations: { PatientDesk: "Peyşınt Desk" },
    cfg: 2.5,
  });

  await pd.speech.create({ model: "antalia-mini", input: "x" });
  assert.equal(JSON.parse(fetch.calls[1].init.body).voice, "antalia-mini");

  await pd.speech.create({ model: "alania-v1", input: "x" });
  assert.equal(JSON.parse(fetch.calls[2].init.body).voice, "alania");
});

test("create() base64-encodes reference_audio and forwards the clone fields", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch });
  await pd.speech.create({
    model: "alania-v2",
    input: "x",
    reference_audio: new Uint8Array([1, 2, 3]),
    reference_text: "Merhaba",
    consent: true,
  });
  const body = JSON.parse(fetch.calls[0].init.body);
  assert.equal(body.reference_audio, "AQID");
  assert.equal(body.reference_text, "Merhaba");
  assert.equal(body.consent, true);
});

test("create() exposes the response headers (model, characters, timings, rate)", async () => {
  const fetch = mockFetch(
    () =>
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: {
          "content-type": "audio/L16; rate=16000",
          "x-request-id": "req-1",
          "x-model": "alania-v2",
          "x-disclosure": "ai-generated",
          "x-characters": "45",
          "x-audio-seconds": "3.18",
          "x-queue-wait-ms": "12",
        },
      }),
  );
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const speech = await pd.speech.create({ input: "x", response_format: "pcm" });
  assert.equal(speech.contentType, "audio/L16");
  assert.equal(speech.requestId, "req-1");
  assert.equal(speech.model, "alania-v2");
  assert.equal(speech.characters, 45);
  assert.equal(speech.audioSeconds, 3.18);
  assert.equal(speech.queueWaitMs, 12);
  assert.equal(speech.sampleRate, 16000);
});

test("create() falls back to the G.711 content types", async () => {
  const fetch = mockFetch(() => new Response(new Uint8Array([1]), { status: 200, headers: {} }));
  const pd = new PatientDesk({ apiKey: "k", fetch });
  assert.equal((await pd.speech.create({ input: "x", response_format: "mulaw" })).contentType, "audio/PCMU");
  assert.equal((await pd.speech.create({ input: "x", response_format: "alaw" })).contentType, "audio/PCMA");
});

test("stream() sets stream:true, strips the WAV header and carries a split sample", async () => {
  const header = new Uint8Array(44);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  header.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
  const first = new Uint8Array([...header, 10, 11, 12]); // header + 1.5 samples
  const second = new Uint8Array([13, 14, 15]);
  const fetch = mockFetch(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(first);
            controller.enqueue(second);
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "audio/wav" } },
      ),
  );
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const chunks = [];
  for await (const chunk of pd.speech.stream({ input: "x" })) chunks.push([...chunk]);
  assert.equal(JSON.parse(fetch.calls[0].init.body).stream, true);
  assert.deepEqual(chunks, [
    [10, 11],
    [12, 13, 14, 15],
  ]);
});

test("stream() passes headerless mulaw through untouched", async () => {
  const fetch = mockFetch(
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "audio/PCMU" } },
      ),
  );
  const pd = new PatientDesk({ apiKey: "k", fetch });
  const chunks = [];
  for await (const chunk of pd.speech.stream({ input: "x", response_format: "mulaw" })) chunks.push([...chunk]);
  assert.deepEqual(chunks, [[1, 2, 3]]);
});
