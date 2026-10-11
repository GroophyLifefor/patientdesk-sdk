import test from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../../dist/index.js";

test("exports the public API surface", () => {
  assert.equal(typeof sdk.PatientDesk, "function");
  assert.equal(typeof sdk.PatientDeskError, "function");
  assert.equal(typeof sdk.SpeechApi, "function");
  assert.equal(typeof sdk.AudioApi, "function");
  assert.equal(typeof sdk.VoicesApi, "function");
  assert.equal(typeof sdk.PronunciationsApi, "function");
  assert.equal(typeof sdk.StylesApi, "function");
  assert.equal(typeof sdk.ModelsApi, "function");
  assert.equal(typeof sdk.fetchStatus, "function");
  assert.equal(typeof sdk.fetchAlaniaHealth, "function");
  assert.equal(typeof sdk.isOperational, "function");
  assert.equal(typeof sdk.statusDescription, "function");
  assert.equal(typeof sdk.parseRetryAfter, "function");
  assert.equal(typeof sdk.toBase64, "function");
  assert.equal(typeof sdk.fromBase64, "function");
  assert.equal(typeof sdk.describeBody, "function");
  assert.equal(sdk.MAX_INPUT_CHARS, 5000);
  assert.equal(sdk.MAX_REFERENCE_BYTES, 10 * 1024 * 1024);
  assert.equal(sdk.MAX_AUDIO_BYTES, 100 * 1024 * 1024);
  assert.ok(sdk.RETRYABLE_STATUS.has(429));
  assert.ok(sdk.DEFAULT_BASE_URL.endsWith("/v1"));
  assert.equal(sdk.DEFAULT_ORIGIN, "https://voice.patientdesk.ai");
  assert.ok(sdk.DEFAULT_STATUS_URL.includes("status.patientdesk.ai"));
});

test("built ESM and CJS share the same surface", async () => {
  const cjs = await import("../../dist/index.cjs");
  assert.equal(typeof cjs.PatientDesk, "function");
  assert.equal(typeof cjs.fetchStatus, "function");
  assert.equal(typeof cjs.fetchAlaniaHealth, "function");
  assert.equal(cjs.MAX_INPUT_CHARS, sdk.MAX_INPUT_CHARS);
});

test("the CJS build works end to end with a mock fetch", async () => {
  const cjs = await import("../../dist/index.cjs");
  const { mockFetch, json, audio } = await import("../../helpers/fetch-mock.mjs");
  const fetch = mockFetch((url) => (String(url).includes("/audio/speech") ? audio() : json({ text: "merhaba" })));
  const pd = new cjs.PatientDesk({ apiKey: "k", fetch, maxRetries: 0 });

  const speech = await pd.speech.create({ input: "x" });
  assert.equal(new Uint8Array(await speech.arrayBuffer()).length, 4);

  const { text } = await pd.audio.transcribe({ audioBase64: "AQID" });
  assert.equal(text, "merhaba");
});
