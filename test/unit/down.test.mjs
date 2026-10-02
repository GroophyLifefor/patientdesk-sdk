import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, PatientDeskError } from "../../dist/index.js";
import { mockFetch, errorResponse } from "../../helpers/fetch-mock.mjs";

// Behaviour when PatientDesk is unhealthy. These never hit the network: they
// pin down exactly how the SDK reacts to the documented degradation statuses.

function pd(handler, opts = {}) {
  return new PatientDesk({ apiKey: "k", fetch: mockFetch(handler), maxRetries: 0, ...opts });
}

test("503 model_unavailable is surfaced (not swallowed) and labelled retryable", async () => {
  const client = pd(() => errorResponse({ status: 503, message: "busy", code: "model_unavailable" }));
  await assert.rejects(() => client.speech.create({ input: "x" }), (err) => {
    assert.equal(err.status, 503);
    assert.equal(err.code, "model_unavailable");
    return true;
  });
});

test("a 503 is retried up to maxRetries before failing", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 503, message: "busy", code: "model_unavailable" }));
  const client = new PatientDesk({ apiKey: "k", fetch, maxRetries: 2 });
  await assert.rejects(() => client.audio.transcribe({ audioBase64: "AQID" }), PatientDeskError);
  assert.equal(fetch.calls.length, 3); // initial + 2 retries
});

test("429 free_quota_exhausted carries scope=user and reset info", async () => {
  const details = { reason: "free_quota_exhausted", scope: "user", resetAt: "2026-09-26T21:00:00.000Z", retryAfterSeconds: 3600 };
  const client = pd(() => errorResponse({ status: 429, message: "quota", code: "rate_limit_error", details, retryAfter: 3600 }));
  await assert.rejects(() => client.speech.create({ input: "x" }), (err) => {
    assert.equal(err.isRateLimit, true);
    assert.equal(err.scope, "user");
    assert.equal(err.reason, "free_quota_exhausted");
    assert.equal(err.retryAfterSeconds, 3600);
    assert.equal(err.resetAt, "2026-09-26T21:00:00.000Z");
    return true;
  });
});

test("429 pool limit is distinguishable from a user limit", async () => {
  const details = { reason: "free_quota_exhausted", scope: "pool" };
  const client = pd(() => errorResponse({ status: 429, message: "pool", code: "rate_limit_error", details }));
  await assert.rejects(() => client.audio.transcribe({ audioBase64: "AQID" }), (err) => {
    assert.equal(err.scope, "pool");
    return true;
  });
});

test("410 model_retired is a hard stop, not retried", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 410, message: "Alania retired, use xai/grok-voice-tts", code: "model_retired" }));
  const client = new PatientDesk({ apiKey: "k", fetch, maxRetries: 3 });
  await assert.rejects(() => client.speech.create({ input: "x" }), (err) => {
    assert.equal(err.status, 410);
    assert.equal(err.code, "model_retired");
    assert.match(err.message, /retired/);
    return true;
  });
  assert.equal(fetch.calls.length, 1);
});

test("413 (too large) is surfaced for STT without retries", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 413, message: "audio too large" }));
  const client = new PatientDesk({ apiKey: "k", fetch, maxRetries: 2 });
  await assert.rejects(() => client.audio.transcribe({ audioBase64: "AQID" }), (err) => {
    assert.equal(err.status, 413);
    return true;
  });
  assert.equal(fetch.calls.length, 1);
});

test("a non-JSON error body still yields a usable PatientDeskError", async () => {
  const client = pd(() => new Response("<html>502 Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
  await assert.rejects(() => client.speech.create({ input: "x" }), (err) => {
    assert.equal(err.status, 502);
    assert.equal(err.code, undefined);
    assert.match(err.message, /502/);
    return true;
  });
});

test("a down service never produces a silent success", async () => {
  // 200 with an empty body would be the only silent path; here we assert a real
  // error status always throws.
  for (const status of [500, 502, 503, 504]) {
    const client = pd(() => new Response("", { status }));
    await assert.rejects(() => client.speech.create({ input: "x" }), PatientDeskError, `status ${status}`);
  }
});
