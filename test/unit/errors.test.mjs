import test from "node:test";
import assert from "node:assert/strict";
import { PatientDeskError, describeBody, parseRetryAfter } from "../../dist/index.js";

test("describeBody pulls message and code from the error envelope", () => {
  assert.deepEqual(describeBody({ error: { message: "boom", code: "x" } }, 400), { message: "boom", code: "x" });
  assert.equal(describeBody({ error: { message: "boom" } }, 400).message, "boom");
  assert.equal(describeBody({ error: { message: "boom" } }, 400).code, undefined);
  assert.deepEqual(describeBody(null, 418), { message: "PatientDesk HTTP 418" });
  assert.deepEqual(describeBody("text", 500), { message: "PatientDesk HTTP 500" });
});

test("parseRetryAfter reads seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("120"), 120);
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(parseRetryAfter(""), undefined);
  assert.equal(parseRetryAfter("garbage"), undefined);
  const future = new Date(Date.now() + 30_000).toUTCString();
  const seconds = parseRetryAfter(future);
  assert.ok(seconds >= 28 && seconds <= 31, `expected ~30, got ${seconds}`);
});

test("PatientDeskError maps 429 details to resetAt/resetSeconds/scope/reason", () => {
  const body = {
    error: {
      message: "quota",
      code: "rate_limit_error",
      details: { reason: "free_quota_exhausted", scope: "pool", resetAt: "2026-09-26T21:00:00.000Z", retryAfterSeconds: 3600 },
    },
  };
  const err = new PatientDeskError("quota", { status: 429, code: "rate_limit_error", body });
  assert.equal(err.status, 429);
  assert.equal(err.code, "rate_limit_error");
  assert.equal(err.reason, "free_quota_exhausted");
  assert.equal(err.scope, "pool");
  assert.equal(err.retryAfterSeconds, 3600);
  assert.equal(err.resetAt, "2026-09-26T21:00:00.000Z");
  assert.equal(err.isRateLimit, true);
  assert.ok(err instanceof Error);
  assert.equal(err.resetsAt.toISOString(), "2026-09-26T21:00:00.000Z");
});

test("resetsAt falls back to retryAfterSeconds when resetAt is missing", () => {
  const err = new PatientDeskError("quota", { status: 429, body: { error: { details: { retryAfterSeconds: 60 } } } });
  const before = Date.now();
  const at = err.resetsAt.getTime();
  assert.ok(at >= before + 59_000 && at <= before + 61_000);
});

test("resetsAt is null when nothing is known", () => {
  const err = new PatientDeskError("boom", { status: 500 });
  assert.equal(err.resetsAt, null);
  assert.equal(err.isRateLimit, false);
});

test("the Retry-After header wins as retryAfterSeconds", () => {
  const err = new PatientDeskError("quota", { status: 429, retryAfterSeconds: 5, body: { error: { details: { retryAfterSeconds: 99 } } } });
  assert.equal(err.retryAfterSeconds, 5);
});
