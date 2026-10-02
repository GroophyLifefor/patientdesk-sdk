import test from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../../dist/index.js";

test("exports the public API surface", () => {
  assert.equal(typeof sdk.PatientDesk, "function");
  assert.equal(typeof sdk.PatientDeskError, "function");
  assert.equal(typeof sdk.SpeechApi, "function");
  assert.equal(typeof sdk.AudioApi, "function");
  assert.equal(typeof sdk.fetchStatus, "function");
  assert.equal(typeof sdk.isOperational, "function");
  assert.equal(typeof sdk.statusDescription, "function");
  assert.equal(typeof sdk.parseRetryAfter, "function");
  assert.equal(typeof sdk.toBase64, "function");
  assert.equal(typeof sdk.describeBody, "function");
  assert.equal(sdk.MAX_INPUT_CHARS, 5000);
  assert.ok(sdk.RETRYABLE_STATUS.has(429));
  assert.ok(sdk.DEFAULT_BASE_URL.endsWith("/v1"));
  assert.ok(sdk.DEFAULT_STATUS_URL.includes("status.patientdesk.ai"));
});

test("built ESM and CJS share the same surface", async () => {
  const cjs = await import("../../dist/index.cjs");
  assert.equal(typeof cjs.PatientDesk, "function");
  assert.equal(typeof cjs.fetchStatus, "function");
  assert.equal(cjs.MAX_INPUT_CHARS, sdk.MAX_INPUT_CHARS);
});
