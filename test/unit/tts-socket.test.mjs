import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, PatientDeskError } from "../../dist/index.js";
import { mockFetch, errorResponse } from "../../helpers/fetch-mock.mjs";
import { FakeWebSocket } from "../../helpers/ws-mock.mjs";

function sdk() {
  return new PatientDesk({
    apiKey: "pd_k",
    fetch: mockFetch(() => errorResponse({ status: 500 })),
    WebSocket: FakeWebSocket,
  });
}

test("speech.socket throws a clear error when no WebSocket is available", () => {
  const pd = new PatientDesk({ apiKey: "k", fetch: mockFetch(() => errorResponse({ status: 500 })), WebSocket: undefined });
  Object.defineProperty(pd, "wsImpl", { value: undefined });
  assert.throws(() => pd.speech.socket(), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.code, "no_websocket");
    return true;
  });
});

test("speech.socket queues speak until ready, routes audio and closes after stop", async () => {
  FakeWebSocket.instances = [];
  const pd = sdk();
  const seen = { ready: null, starts: [], audio: [], ends: [], stopped: false };

  const socket = pd.speech.socket(
    {
      ready: (info) => (seen.ready = info),
      speechStart: (info) => seen.starts.push(info),
      audio: (chunk) => seen.audio.push(chunk),
      speechEnd: (info) => seen.ends.push(info),
      stopped: () => (seen.stopped = true),
    },
    { model: "alania-v2", encoding: "mulaw", sampleRate: 8000 },
  );
  const ws = FakeWebSocket.instances[0];
  assert.match(
    ws.url,
    /^wss:\/\/voice\.patientdesk\.ai\/v1\/audio\/speech\/stream\?key=pd_k&model=alania-v2&encoding=mulaw&sample_rate=8000$/,
  );

  const speaking = socket.speak({ input: "Merhaba" });
  await speaking; // the body is built and queued: there is no `ready` frame yet
  assert.equal(ws.sent.length, 0, "nothing is sent before ready");
  ws.open();
  assert.equal(ws.sent.length, 0, "still nothing until the ready frame");
  ws.message({ type: "ready", model: "alania-v2", voice: "alania2-f1", sample_rate: 48000, encoding: "pcm_s16le" });
  assert.equal(ws.sent.length, 1, "the queued speak flushes on ready");

  const speak = JSON.parse(ws.sent[0]);
  assert.equal(speak.type, "speak");
  assert.equal(speak.input, "Merhaba");
  assert.equal(speak.model, "alania-v2");
  assert.equal(speak.voice, "alania2-f1");

  // After ready, speak sends immediately.
  await socket.speak({ input: "İkinci" });
  assert.equal(JSON.parse(ws.sent[1]).input, "İkinci");

  ws.message({ type: "speech_start", characters: 7, sample_rate: 48000, disclosure: "ai-generated" });
  ws.binary([1, 2, 3, 4]);
  ws.message({ type: "speech_end", audio_s: 1.1, infer_ms: 90 });

  let closed = false;
  socket.closed.then(() => (closed = true));
  socket.stop();
  assert.deepEqual(JSON.parse(ws.sent[2]), { type: "stop" });
  assert.equal(closed, false, "the server closes after `stopped`");
  ws.message({ type: "stopped" });
  ws.serverClose(1000, "");
  await socket.closed;

  assert.equal(seen.ready.model, "alania-v2");
  assert.equal(seen.starts[0].characters, 7);
  assert.equal(seen.audio[0].length, 4);
  assert.equal(seen.ends[0].audioSeconds, 1.1);
  assert.equal(seen.stopped, true);
});

test("speech.socket can authenticate with a session token", () => {
  FakeWebSocket.instances = [];
  const pd = sdk();
  pd.speech.socket({}, { token: "session.jwt" });
  assert.match(FakeWebSocket.instances[0].url, /\?token=session\.jwt$/);
});
