import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REFERENCE_BYTES,
  PatientDesk,
  PatientDeskError,
  fetchStatus,
  fromBase64,
  toBase64,
} from "../../dist/index.js";
import { mockFetch, json, audio, errorResponse } from "../../helpers/fetch-mock.mjs";
import { FakeWebSocket } from "../../helpers/ws-mock.mjs";

const BASE = "https://voice.patientdesk.ai/v1";

function sdk(handler, options = {}) {
  const fetch = mockFetch(handler);
  return { pd: new PatientDesk({ apiKey: "k", fetch, maxRetries: 0, ...options }), fetch };
}

function formOf(init) {
  const entries = {};
  for (const [key, value] of init.body.entries()) entries[key] = value;
  return entries;
}

// ------------------------------------------------------------------ bytes ----

test("toBase64 falls back to btoa when Buffer is unavailable", () => {
  const original = globalThis.Buffer;
  globalThis.Buffer = undefined;
  try {
    assert.equal(toBase64(new Uint8Array([1, 2, 3])), "AQID");
    // Larger than the 32 KB btoa chunk: exercises the loop more than once.
    const big = new Uint8Array(40_000).map((_v, i) => i % 251);
    const roundTripped = fromBase64(toBase64(big));
    assert.equal(roundTripped.length, big.length);
    assert.equal(roundTripped[39_999], big[39_999]);
  } finally {
    globalThis.Buffer = original;
  }
});

test("fromBase64 ignores whitespace inside the payload", () => {
  assert.deepEqual([...fromBase64("AQ\nID")], [1, 2, 3]);
});

test("toBase64 throws a clear error with neither encoder", () => {
  const originalBuffer = globalThis.Buffer;
  const originalBtoa = globalThis.btoa;
  globalThis.Buffer = undefined;
  globalThis.btoa = undefined;
  try {
    assert.throws(() => toBase64(new Uint8Array([1])), (err) => {
      assert.ok(err instanceof PatientDeskError);
      assert.equal(err.code, "no_base64");
      return true;
    });
  } finally {
    globalThis.Buffer = originalBuffer;
    globalThis.btoa = originalBtoa;
  }
});

test("fromBase64 falls back to Buffer when atob is unavailable", () => {
  const original = globalThis.atob;
  globalThis.atob = undefined;
  try {
    assert.deepEqual([...fromBase64("AQID")], [1, 2, 3]);
  } finally {
    globalThis.atob = original;
  }
});

test("fromBase64 throws a clear error with neither decoder", () => {
  const originalBuffer = globalThis.Buffer;
  const originalAtob = globalThis.atob;
  globalThis.Buffer = undefined;
  globalThis.atob = undefined;
  try {
    assert.throws(() => fromBase64("AQID"), (err) => {
      assert.ok(err instanceof PatientDeskError);
      assert.equal(err.code, "no_base64");
      return true;
    });
  } finally {
    globalThis.Buffer = originalBuffer;
    globalThis.atob = originalAtob;
  }
});

// ----------------------------------------------------------------- client ----

test("throws a clear error when there is no fetch at all", () => {
  const original = globalThis.fetch;
  globalThis.fetch = undefined;
  try {
    assert.throws(() => new PatientDesk({ apiKey: "k" }), (err) => {
      assert.ok(err instanceof PatientDeskError);
      assert.equal(err.code, "no_fetch");
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("derives the https origin from the base URL", () => {
  const pd = new PatientDesk({ apiKey: "k", baseUrl: "https://voice.patientdesk.ai/v1/", fetch: mockFetch(() => audio()) });
  assert.equal(pd.origin, "https://voice.patientdesk.ai");
});

test("a caller abort during the retry backoff stops the request", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 503, message: "busy" }));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 1, timeout: 0 });
  const controller = new AbortController();
  const promise = pd.request("/audio/speech", {
    method: "POST",
    headers: pd.headers(),
    body: "{}",
    signal: controller.signal,
  });
  await new Promise((r) => setTimeout(r, 5)); // let the 503 land and the sleep start
  controller.abort(new Error("caller aborted"));
  await assert.rejects(() => promise, /caller aborted/);
});

test("a caller abort during the network-error backoff stops the request", async () => {
  const fetch = mockFetch((_url, _init, n) => {
    if (n === 1) throw new Error("ECONNRESET");
    return audio();
  });
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 2, timeout: 0 });
  const controller = new AbortController();
  const promise = pd.request("/audio/speech", {
    method: "POST",
    headers: pd.headers(),
    body: "{}",
    signal: controller.signal,
  });
  await new Promise((r) => setTimeout(r, 5));
  controller.abort(new Error("caller aborted"));
  await assert.rejects(() => promise, /caller aborted/);
});

test("a 429 with a non-JSON body is still retried", async () => {
  const fetch = mockFetch(() => new Response("slow down", { status: 429, headers: { "content-type": "text/plain" } }));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 1 });
  await assert.rejects(() => pd.speech.create({ input: "x" }), (err) => {
    assert.equal(err.status, 429);
    assert.equal(err.code, undefined);
    return true;
  });
  assert.equal(fetch.calls.length, 2); // initial + 1 retry
});

// -------------------------------------------------------------- tts fields ----

test("create() forwards voice_description and top_p", async () => {
  const { pd, fetch } = sdk(() => audio());
  await pd.speech.create({
    model: "alania-v2",
    voice_description: "A calm middle-aged woman with a warm voice",
    seed: 4242,
    input: "x",
    top_p: 0.5,
  });
  const body = JSON.parse(fetch.calls[0].init.body);
  assert.equal(body.voice_description, "A calm middle-aged woman with a warm voice");
  assert.equal(body.seed, 4242);
  assert.equal(body.top_p, 0.5);
});

test("create() passes reference_audio strings through (base64 and data URI)", async () => {
  const { pd, fetch } = sdk(() => audio());
  await pd.speech.create({ model: "alania-v2", input: "x", reference_audio: "AQID", consent: true });
  await pd.speech.create({
    model: "alania-v2",
    input: "x",
    reference_audio: "data:audio/wav;base64,AQID",
    consent: true,
  });
  assert.equal(JSON.parse(fetch.calls[0].init.body).reference_audio, "AQID");
  assert.equal(JSON.parse(fetch.calls[1].init.body).reference_audio, "data:audio/wav;base64,AQID");
});

test("create() encodes ArrayBuffer and Blob reference_audio", async () => {
  const { pd, fetch } = sdk(() => audio());
  await pd.speech.create({ model: "alania-v2", input: "x", reference_audio: new Uint8Array([1, 2, 3]).buffer, consent: true });
  await pd.speech.create({ model: "alania-v2", input: "x", reference_audio: new Blob([new Uint8Array([1, 2, 3])]), consent: true });
  assert.equal(JSON.parse(fetch.calls[0].init.body).reference_audio, "AQID");
  assert.equal(JSON.parse(fetch.calls[1].init.body).reference_audio, "AQID");
});

test("create() rejects an empty or oversized reference_audio locally", async () => {
  const { pd, fetch } = sdk(() => audio());
  await assert.rejects(
    () => pd.speech.create({ model: "alania-v2", input: "x", reference_audio: new Uint8Array(0), consent: true }),
    TypeError,
  );
  await assert.rejects(
    () =>
      pd.speech.create({
        model: "alania-v2",
        input: "x",
        reference_audio: new Uint8Array(MAX_REFERENCE_BYTES + 1),
        consent: true,
      }),
    (err) => {
      assert.ok(err instanceof RangeError);
      assert.match(err.message, /10 MB/);
      return true;
    },
  );
  assert.equal(fetch.calls.length, 0);
});

test("the default voice follows namespaced and unknown models", async () => {
  const { pd, fetch } = sdk(() => audio());
  await pd.speech.create({ model: "patientdesk/alania-v2", input: "x" });
  await pd.speech.create({ model: "some-custom-model", input: "x" });
  assert.equal(JSON.parse(fetch.calls[0].init.body).voice, "alania2-f1");
  assert.equal(JSON.parse(fetch.calls[1].init.body).voice, "alania");
});

// ------------------------------------------------------------ tts stream ----

function streamResponse(chunks) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "audio/wav" } },
  );
}

function wavHeader() {
  const header = new Uint8Array(44);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  header.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
  return header;
}

async function collect(generator) {
  const chunks = [];
  for await (const chunk of generator) chunks.push([...chunk]);
  return chunks;
}

test("stream() rejects an empty body with empty_stream", async () => {
  const { pd } = sdk(() => new Response(null, { status: 200, headers: { "content-type": "audio/wav" } }));
  await assert.rejects(collect(pd.speech.stream({ input: "x" })), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.code, "empty_stream");
    return true;
  });
});

test("stream() reassembles a WAV header split across chunks", async () => {
  const header = wavHeader();
  const { pd } = sdk(() =>
    streamResponse([header.slice(0, 20), new Uint8Array([...header.slice(20), 10, 11, 12, 13]), new Uint8Array([14, 15, 16, 17])]),
  );
  const chunks = await collect(pd.speech.stream({ input: "x" }));
  assert.deepEqual(chunks, [
    [10, 11, 12, 13],
    [14, 15, 16, 17],
  ]);
});

test("stream() passes a non-RIFF body through untouched", async () => {
  const notWav = new Uint8Array(48).fill(7);
  const { pd } = sdk(() => streamResponse([notWav]));
  const chunks = await collect(pd.speech.stream({ input: "x" }));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].length, 48);
});

test("stream() flushes a dangling trailing byte at the end", async () => {
  const header = wavHeader();
  const { pd } = sdk(() => streamResponse([new Uint8Array([...header, 10, 11, 12])]));
  const chunks = await collect(pd.speech.stream({ input: "x" }));
  assert.deepEqual(chunks, [[10, 11], [12]]);
});

// ------------------------------------------------------------ tts socket ----

test("speech.socket() routes errors, ignores junk and accepts typed-array audio", () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const seen = { errors: [], audio: [] };
  pd.speech.socket({ error: (message) => seen.errors.push(message), audio: (chunk) => seen.audio.push([...chunk]) });
  const ws = FakeWebSocket.instances[0];
  ws.open();
  ws.message("not json"); // ignored
  ws.message({ type: "error", message: "boom" });
  ws.binaryView([1, 2, 3]);
  assert.deepEqual(seen.errors, ["boom"]);
  assert.deepEqual(seen.audio, [[1, 2, 3]]);
});

test("speech.socket close() resolves immediately without a stop frame", async () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const socket = pd.speech.socket();
  const ws = FakeWebSocket.instances[0];
  ws.open();
  let closed = false;
  socket.closed.then(() => (closed = true));
  socket.close();
  await socket.closed;
  assert.equal(closed, true);
  assert.deepEqual(ws.closed, { code: 1000, reason: "client close" });
  assert.equal(ws.sent.length, 0); // no stop frame
});

test("speech.socket stop() force-closes when the server never answers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const socket = pd.speech.socket();
  const ws = FakeWebSocket.instances[0];
  ws.open();
  socket.stop();
  assert.deepEqual(JSON.parse(ws.sent[0]), { type: "stop" });
  t.mock.timers.tick(5000);
  assert.deepEqual(ws.closed, { code: 1000, reason: "client stop" });
});

// ------------------------------------------------------------------- stt ----

test("transcribe() merges extra form fields (strings stay, others are JSON)", async () => {
  const { pd, fetch } = sdk(() => json({ text: "x" }));
  await pd.audio.transcribe({
    audioBase64: "AQID",
    extra: { lang_hint: "tr", threshold: 0.5, flags: { a: 1 } },
  });
  const form = formOf(fetch.calls[0].init);
  assert.equal(form.lang_hint, "tr");
  assert.equal(form.threshold, "0.5");
  assert.equal(form.flags, '{"a":1}');
});

test("transcribe() names the upload for every supported format", async () => {
  const { pd, fetch } = sdk(() => json({ text: "x" }));
  const expected = {
    wav: ["audio.wav", "audio/wav"],
    mp3: ["audio.mp3", "audio/mpeg"],
    m4a: ["audio.m4a", "audio/mp4"],
    webm: ["audio.webm", "audio/webm"],
    ogg: ["audio.ogg", "audio/ogg"],
    flac: ["audio.flac", "audio/flac"],
  };
  for (const format of Object.keys(expected)) {
    await pd.audio.transcribe({ audioBase64: "AQID", audio_format: format });
  }
  Object.entries(expected).forEach(([format, [name, type]], index) => {
    const form = formOf(fetch.calls[index].init);
    assert.equal(form.file.name, name, format);
    assert.equal(form.file.type, type, format);
  });
});

test("transcribeStream reports a socket-level error", () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const seen = [];
  pd.audio.transcribeStream({ error: (message) => seen.push(message) });
  const ws = FakeWebSocket.instances[0];
  ws.open();
  ws.onerror?.({});
  assert.deepEqual(seen, ["WebSocket error"]);
});

test("transcribeStream stop() force-closes when the server never answers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const stream = pd.audio.transcribeStream();
  const ws = FakeWebSocket.instances[0];
  ws.open();
  stream.stop();
  assert.deepEqual(JSON.parse(ws.sent[1]), { type: "stop" });
  t.mock.timers.tick(5000);
  assert.deepEqual(ws.closed, { code: 1000, reason: "client stop" });
});

test("transcribeStream stop() swallows a failing send and close", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const stream = pd.audio.transcribeStream();
  const ws = FakeWebSocket.instances[0];
  ws.open();
  ws.send = () => {
    throw new Error("send failed");
  };
  stream.stop(); // the stop frame throws, swallowed
  ws.close = () => {
    throw new Error("close failed");
  };
  t.mock.timers.tick(5000); // the fallback close throws, swallowed
  assert.equal(ws.closed, null);
});

test("speech.socket stop() and close() swallow failing socket calls", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const socket = pd.speech.socket();
  const ws = FakeWebSocket.instances[0];
  ws.open();
  ws.send = () => {
    throw new Error("send failed");
  };
  socket.stop(); // the stop frame throws, swallowed
  ws.close = () => {
    throw new Error("close failed");
  };
  t.mock.timers.tick(5000); // the fallback close throws, swallowed
  socket.close(); // an immediate close throws, swallowed
  assert.equal(ws.closed, null);
});

// ---------------------------------------------------------------- status ----

test("fetchStatus honours an already-aborted signal", async () => {
  const fetch = mockFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        if (init.signal.aborted) return reject(init.signal.reason);
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  );
  const controller = new AbortController();
  controller.abort(new Error("status aborted"));
  await assert.rejects(() => fetchStatus({ fetch, signal: controller.signal }), /status aborted/);
});

test("fetchStatus aborts an in-flight request through the caller signal", async () => {
  const fetch = mockFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  );
  const controller = new AbortController();
  const promise = fetchStatus({ fetch, signal: controller.signal });
  await new Promise((r) => setTimeout(r, 5));
  controller.abort(new Error("status aborted"));
  await assert.rejects(() => promise, /status aborted/);
});
