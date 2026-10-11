import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, fetchAlaniaHealth } from "../../dist/index.js";
import { hasApiKey, apiKey, baseUrl, liveEnabled, guard } from "../../helpers/live.mjs";

const RUN = hasApiKey() && liveEnabled();
const skip = RUN ? false : "needs PATIENDESK_API_KEY and an operational service (run `npm run full-test`)";

const client = RUN
  ? new PatientDesk({ apiKey: apiKey(), ...(baseUrl() ? { baseUrl: baseUrl() } : {}), maxRetries: 1, timeout: 60_000 })
  : null;

test("live: /health/alania reports every model (no key)", { skip: RUN ? false : "needs an operational service" }, async (t) => {
  const health = await guard(t, "fetching /health/alania", () => fetchAlaniaHealth());
  if (!health) return;
  assert.equal(health.status, "ok");
  assert.ok(health.models?.["alania-v2"], "expected alania-v2 in the health payload");
});

test("live: models.list() includes alania-v2 as the default", { skip }, async (t) => {
  const models = await guard(t, "listing /v1/alania/models", () => client.models.list());
  if (!models) return;
  const ids = models.data.map((m) => m.id);
  assert.ok(ids.includes("alania-v2"), `expected alania-v2 in: ${ids.join(", ")}`);
  assert.equal(models.data.find((m) => m.id === "alania-v2").default, true);
  assert.equal(models.data.find((m) => m.id === "antalia-mini").free, true);
});

test("live: styles.list() returns the ready-made styles", { skip }, async (t) => {
  const styles = await guard(t, "listing /v1/styles", () => client.styles.list());
  if (!styles) return;
  const ids = styles.data.map((s) => s.id);
  for (const id of ["support-warm", "support-calm", "sales-energetic", "reception-smile"]) {
    assert.ok(ids.includes(id), `missing style ${id} in: ${ids.join(", ")}`);
  }
});

test("live: voices.list() includes the built-in alania2 voices", { skip }, async (t) => {
  const voices = await guard(t, "listing /v1/voices", () => client.voices.list());
  if (!voices) return;
  const ids = voices.data.map((v) => v.id);
  // The list uses `alania-v1` for the Alania-1 voice (`alania` is the request alias).
  for (const id of ["alania-v1", "alania2-f1", "alania2-m1"]) {
    assert.ok(ids.includes(id), `missing voice ${id} in: ${ids.join(", ")}`);
  }
  const f1 = voices.data.find((v) => v.id === "alania2-f1");
  assert.equal(f1.default, true);
});

test("live: usage() returns the account quota", { skip }, async (t) => {
  const usage = await guard(t, "fetching /v1/alania/usage", () => client.usage());
  if (!usage) return;
  assert.equal(typeof usage, "object");
});

test("live: a pronunciation round-trips (add → list → delete)", { skip }, async (t) => {
  const term = `PatientDeskTest${Date.now()}`;
  const added = await guard(t, "adding a pronunciation", () =>
    client.pronunciations.add({ term, say_as: "Peyşınt Desk Test" }),
  );
  if (!added) return;
  try {
    const listed = await guard(t, "listing pronunciations", () => client.pronunciations.list());
    if (listed) {
      assert.ok(listed.data.some((p) => p.term === term), "the added term must be listed");
    }
  } finally {
    await guard(t, "deleting the pronunciation", () => client.pronunciations.delete(added.id));
  }
});
