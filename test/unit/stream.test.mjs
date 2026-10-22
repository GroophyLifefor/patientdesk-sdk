import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, PatientDeskError } from "../../dist/index.js";
import { mockFetch, errorResponse } from "../../helpers/fetch-mock.mjs";
import { FakeWebSocket } from "../../helpers/ws-mock.mjs";

test("transcribeStream throws a clear error when no WebSocket is available", () => {
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: undefined });
  // Force "no websocket" regardless of the runtime's global.
  Object.defineProperty(pd, "wsImpl", { value: undefined });
  assert.throws(() => pd.audio.transcribeStream(), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.code, "no_websocket");
    return true;
  });
});

test("transcribeStream sends a start frame on open and routes every event", async () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "pd_k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const seen = { ready: null, vad: [], partials: [], segments: [], finals: [], stopped: null, errors: [] };

  const stream = pd.audio.transcribeStream(
    {
      ready: (info) => (seen.ready = info),
      vad: (info) => seen.vad.push(info.active),
      partial: (text) => seen.partials.push(text),
      segmentStart: (info) => seen.segments.push(info.start),
      segmentEnd: (info) => seen.segments.push(info.end),
      final: (text) => seen.finals.push(text),
      stopped: (info) => (seen.stopped = info),
      error: (message) => seen.errors.push(message),
    },
    { sampleRate: 16000, eagerFinal: true, partials: true, partialMs: 200, minSilenceMs: 450 },
  );

  const socket = FakeWebSocket.instances[0];
  assert.match(socket.url, /^wss:\/\/voice\.patientdesk\.ai\/v1\/audio\/stream\?key=pd_k$/);

  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]), {
    type: "start",
    sampleRate: 16000,
    eager_final: true,
    partials: true,
    partial_ms: 200,
    min_silence_ms: 450,
  });

  socket.message({ type: "ready", model: "duyu-1", quota: { remaining_s: 7130 } });
  assert.equal(seen.ready.model, "duyu-1");
  assert.deepEqual(seen.ready.quota, { remaining_s: 7130 });

  socket.message({ type: "vad", prob: 0.91, active: true });
  socket.message({ type: "segment_start", start: 0.42 });
  socket.message({ type: "partial", text: "Yarın saat" });
  socket.message({ type: "segment_end", end: 3.1 });
  socket.message({ type: "final", text: "merhaba", start: 0.42, end: 3.1, audio_s: 2.68, infer_ms: 118, rtf: 0.04 });
  socket.message({ type: "stopped", audio_s: 2.68 });
  socket.message({ type: "error", message: "boom" });
  socket.message("not json"); // ignored, no throw

  assert.deepEqual(seen.vad, [true]);
  assert.deepEqual(seen.partials, ["Yarın saat"]);
  assert.deepEqual(seen.segments, [0.42, 3.1]);
  assert.deepEqual(seen.finals, ["merhaba"]);
  assert.equal(seen.stopped.audioSeconds, 2.68);
  assert.deepEqual(seen.errors, ["boom"]);

  const audio = new Uint8Array([1, 2, 3]);
  stream.sendAudio(audio);
  assert.equal(socket.sent[1], audio);
});

test("transcribeStream can authenticate with a session token", () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "pd_k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  pd.audio.transcribeStream({}, { token: "session.jwt" });
  assert.match(FakeWebSocket.instances[0].url, /\?token=session\.jwt/);
});

test("sendAudio is a no-op before the socket opens", () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const stream = pd.audio.transcribeStream();
  const socket = FakeWebSocket.instances[0];
  assert.equal(socket.sent.length, 0); // nothing sent before open
  stream.sendAudio(new Uint8Array([1]));
  assert.equal(socket.sent.length, 0); // still nothing: readyState is CONNECTING
  socket.open();
  assert.equal(socket.sent.length, 1); // the start frame
  stream.sendAudio(new Uint8Array([2]));
  assert.equal(socket.sent.length, 2); // now the audio goes out
});

test("stop() sends the stop frame and waits for the server to close", async () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const stream = pd.audio.transcribeStream();
  const socket = FakeWebSocket.instances[0];
  socket.open();

  let closed = false;
  stream.closed.then(() => (closed = true));
  stream.stop();
  assert.deepEqual(JSON.parse(socket.sent[1]), { type: "stop" });
  // The socket stays open until the server finalizes the open sentence.
  assert.equal(closed, false);
  assert.equal(socket.readyState, 1);

  socket.message({ type: "final", text: "son" });
  socket.message({ type: "stopped", audio_s: 1.2 });
  socket.serverClose(1000, "done");
  await stream.closed;
  assert.equal(closed, true);
});

test("a server-side close resolves closed and reports the code", async () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  let closeEvent = null;
  const stream = pd.audio.transcribeStream({ close: (code, reason) => (closeEvent = { code, reason }) });
  const socket = FakeWebSocket.instances[0];
  socket.open();
  socket.serverClose(1011, "internal");
  await stream.closed;
  assert.deepEqual(closeEvent, { code: 1011, reason: "internal" });
});
