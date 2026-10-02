import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, PatientDeskError } from "../../dist/index.js";
import { mockFetch, json, audio, errorResponse, failingFetch } from "../../helpers/fetch-mock.mjs";
import { startServer } from "../../helpers/fetch-mock.mjs";

test("reads the API key from the environment when omitted", () => {
  const prev = process.env.PATIENDESK_API_KEY;
  process.env.PATIENDESK_API_KEY = "pd_env_key";
  try {
    const pd = new PatientDesk({ fetch: mockFetch(() => audio()) });
    assert.equal(pd.apiKey, "pd_env_key");
  } finally {
    if (prev === undefined) delete process.env.PATIENDESK_API_KEY;
    else process.env.PATIENDESK_API_KEY = prev;
  }
});

test("throws a clear error when no key is available", () => {
  const prevA = process.env.PATIENDESK_API_KEY;
  const prevB = process.env.PATIENDESK_KEY;
  delete process.env.PATIENDESK_API_KEY;
  delete process.env.PATIENDESK_KEY;
  try {
    assert.throws(() => new PatientDesk({}), (err) => {
      assert.ok(err instanceof PatientDeskError);
      assert.equal(err.code, "missing_api_key");
      return true;
    });
  } finally {
    if (prevA !== undefined) process.env.PATIENDESK_API_KEY = prevA;
    if (prevB !== undefined) process.env.PATIENDESK_KEY = prevB;
  }
});

test("normalizes the base URL and derives the websocket origin", () => {
  const pd = new PatientDesk({ apiKey: "k", baseUrl: "https://voice.patientdesk.ai/v1/", fetch: mockFetch(() => audio()) });
  assert.equal(pd.baseUrl, "https://voice.patientdesk.ai/v1");
  assert.equal(pd.wsOrigin, "wss://voice.patientdesk.ai");
});

test("sends authorization + content-type and merges defaultHeaders", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "pd_x", fetch, defaultHeaders: { "x-app": "test" } });
  await pd.speech.create({ input: "hi" });
  const headers = fetch.calls[0].init.headers;
  assert.equal(headers.authorization, "Bearer pd_x");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["x-app"], "test");
});

test("retries a 503 then succeeds", async () => {
  const fetch = mockFetch((_u, _i, n) => (n === 1 ? new Response("busy", { status: 503 }) : audio()));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 2 });
  const res = await pd.speech.create({ input: "hi" });
  assert.equal(new Uint8Array(await res.arrayBuffer()).length, 4);
  assert.equal(fetch.calls.length, 2);
});

test("honours Retry-After and gives up after maxRetries", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 429, message: "rate limited", code: "rate_limit_error", retryAfter: 0 }));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 1 });
  await assert.rejects(() => pd.speech.create({ input: "hi" }), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.status, 429);
    assert.equal(err.isRateLimit, true);
    return true;
  });
  assert.equal(fetch.calls.length, 2); // initial + 1 retry
});

test("does not retry a 400", async () => {
  const fetch = mockFetch(() => errorResponse({ status: 400, message: "bad" }));
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 3 });
  await assert.rejects(() => pd.speech.create({ input: "hi" }), PatientDeskError);
  assert.equal(fetch.calls.length, 1);
});

test("wraps a transport failure as a network_error", async () => {
  const pd = new PatientDesk({ apiKey: "k", fetch: failingFetch(), maxRetries: 0 });
  await assert.rejects(() => pd.speech.create({ input: "hi" }), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.status, 0);
    assert.equal(err.code, "network_error");
    return true;
  });
});

test("enforces the request timeout", async () => {
  const fetch = mockFetch((_u, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    }),
  );
  const pd = new PatientDesk({ apiKey: "k", fetch, timeout: 40, maxRetries: 0 });
  await assert.rejects(() => pd.speech.create({ input: "hi" }), (err) => {
    assert.ok(err instanceof PatientDeskError);
    assert.equal(err.code, "network_error");
    return true;
  });
});

test("respects a caller abort signal", async () => {
  const fetch = mockFetch((_u, init) =>
    new Promise((_resolve, reject) => {
      if (init.signal.aborted) return reject(init.signal.reason);
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    }),
  );
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 0, timeout: 0 });
  const controller = new AbortController();
  const promise = pd.request("/audio/speech", { method: "POST", headers: pd.headers(), body: "{}", signal: controller.signal });
  await new Promise((r) => setTimeout(r, 5)); // let fetch start
  controller.abort(new Error("caller aborted"));
  await assert.rejects(() => promise, /caller aborted/);
});

test("an already-aborted signal fails fast without calling fetch", async () => {
  const fetch = mockFetch(() => audio());
  const pd = new PatientDesk({ apiKey: "k", fetch, maxRetries: 0, timeout: 0 });
  const controller = new AbortController();
  controller.abort(new Error("pre-aborted"));
  await assert.rejects(
    () => pd.request("/audio/speech", { method: "POST", headers: pd.headers(), body: "{}", signal: controller.signal }),
    /pre-aborted/,
  );
  assert.equal(fetch.calls.length, 0);
});

test("talks to a real HTTP server end to end", async () => {
  const server = await startServer((req) => {
    if (req.url.startsWith("/audio/speech")) return { status: 200, body: { ok: true }, headers: { "content-type": "audio/wav" } };
    return { status: 404, body: { error: { message: "nope" } } };
  });
  try {
    const pd = new PatientDesk({ apiKey: "k", baseUrl: server.url, maxRetries: 0 });
    const res = await pd.speech.createRaw({ input: "hi" });
    assert.equal(res.status, 200);
  } finally {
    await server.close();
  }
});
