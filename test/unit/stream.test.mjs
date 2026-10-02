import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, PatientDeskError } from "../../dist/index.js";
import { mockFetch, errorResponse } from "../../helpers/fetch-mock.mjs";

// Records a scripted websocket so we can prove down / streaming behaviour
// without touching the real service.
class FakeWebSocket {
  static instances = [];
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.sent = [];
    this.closed = null;
    this.binaryType = "blob";
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }
  // Test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  message(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  serverClose(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

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

test("transcribeStream sends a start frame on open and routes events", async () => {
  FakeWebSocket.instances = [];
  const pd = new PatientDesk({ apiKey: "pd_k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: FakeWebSocket });
  const seen = { ready: null, finals: [], errors: [] };

  const stream = pd.audio.transcribeStream(
    {
      ready: (info) => (seen.ready = info),
      final: (text) => seen.finals.push(text),
      error: (message) => seen.errors.push(message),
    },
    { sampleRate: 16000, eagerFinal: true },
  );

  const socket = FakeWebSocket.instances[0];
  assert.match(socket.url, /^wss:\/\/voice\.patientdesk\.ai\/v1\/audio\/stream\?token=pd_k$/);

  socket.open();
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: "start", sampleRate: 16000, eager_final: true });

  socket.message({ type: "ready", model: "duyu-1" });
  assert.equal(seen.ready.model, "duyu-1");

  socket.message({ type: "final", text: "merhaba" });
  assert.deepEqual(seen.finals, ["merhaba"]);

  socket.message({ type: "error", message: "boom" });
  assert.deepEqual(seen.errors, ["boom"]);

  socket.message("not json"); // ignored, no throw

  const audio = new Uint8Array([1, 2, 3]);
  stream.sendAudio(audio);
  assert.equal(socket.sent[1], audio);

  let closed = false;
  stream.closed.then(() => (closed = true));
  stream.stop();
  assert.deepEqual(JSON.parse(socket.sent[2]), { type: "stop" });
  assert.deepEqual(socket.closed, { code: 1000, reason: "client stop" });
  await stream.closed;
  assert.equal(closed, true);
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
