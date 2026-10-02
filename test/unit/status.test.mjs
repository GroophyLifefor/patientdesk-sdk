import test from "node:test";
import assert from "node:assert/strict";
import { fetchStatus, isOperational, statusDescription } from "../../dist/index.js";
import { mockFetch, json } from "../../helpers/fetch-mock.mjs";

const PAGE = { page: { id: "patientdesk-speech", name: "Patientdesk Speech" }, status: { indicator: "none", description: "All Systems Operational" } };

test("fetchStatus hits the Statuspage summary and returns the body", async () => {
  const fetch = mockFetch(() => json(PAGE));
  const status = await fetchStatus({ fetch });
  assert.equal(fetch.calls[0].url, "https://status.patientdesk.ai/api/v2/status.json");
  assert.equal(status.status.indicator, "none");
  assert.equal(status.page.name, "Patientdesk Speech");
});

test("fetchStatus sends no Authorization header (keyless)", async () => {
  const fetch = mockFetch(() => json(PAGE));
  await fetchStatus({ fetch });
  const headers = fetch.calls[0].init.headers ?? {};
  assert.equal(headers.authorization, undefined);
});

test("fetchStatus retries a 5xx then succeeds", async () => {
  const fetch = mockFetch((_u, _i, n) => (n === 1 ? new Response("down", { status: 503 }) : json(PAGE)));
  const status = await fetchStatus({ fetch, retries: 1 });
  assert.equal(status.status.indicator, "none");
  assert.equal(fetch.calls.length, 2);
});

test("fetchStatus throws after exhausting retries", async () => {
  const fetch = mockFetch(() => new Response("down", { status: 503 }));
  await assert.rejects(() => fetchStatus({ fetch, retries: 1 }), /HTTP 503/);
  assert.equal(fetch.calls.length, 2);
});

test("fetchStatus honours a custom url and timeout", async () => {
  const fetch = mockFetch((_u, init) =>
    new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason))),
  );
  await assert.rejects(() => fetchStatus({ fetch, url: "http://x/status", timeout: 30, retries: 0 }), /timed out/);
});

test("isOperational is true only for a healthy indicator", () => {
  assert.equal(isOperational({ status: { indicator: "none" } }), true);
  assert.equal(isOperational({ status: { indicator: "minor" } }), false);
  assert.equal(isOperational({ status: { indicator: "major" } }), false);
  assert.equal(isOperational({ status: { indicator: "critical" } }), false);
  assert.equal(isOperational({ status: { indicator: "maintenance" } }), false);
  assert.equal(isOperational({ status: {} }), false);
  assert.equal(isOperational(null), false);
  assert.equal(isOperational(undefined), false);
});

test("statusDescription returns a readable summary", () => {
  assert.equal(statusDescription(PAGE), "All Systems Operational");
  assert.equal(statusDescription(null), "unknown");
});
