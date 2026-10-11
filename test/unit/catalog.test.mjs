import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk, fetchAlaniaHealth } from "../../dist/index.js";
import { mockFetch, json } from "../../helpers/fetch-mock.mjs";

const BASE = "https://voice.patientdesk.ai/v1";

function sdk(handler) {
  const fetch = mockFetch(handler);
  return { pd: new PatientDesk({ apiKey: "k", fetch, maxRetries: 0 }), fetch };
}

test("styles.list() GETs /v1/styles", async () => {
  const { pd, fetch } = sdk(() => json({ object: "list", data: [{ id: "support-warm" }] }));
  const styles = await pd.styles.list();
  assert.equal(fetch.calls[0].url, `${BASE}/styles`);
  assert.equal(fetch.calls[0].method, "GET");
  assert.equal(styles.data[0].id, "support-warm");
});

test("models.list() GETs /v1/alania/models", async () => {
  const { pd, fetch } = sdk(() => json({ object: "list", data: [{ id: "alania-v2", default: true }] }));
  const models = await pd.models.list();
  assert.equal(fetch.calls[0].url, `${BASE}/alania/models`);
  assert.equal(models.data[0].default, true);
});

test("usage() GETs /v1/alania/usage", async () => {
  const { pd, fetch } = sdk(() => json({ object: "usage", used: 1204, quota: 100000 }));
  const usage = await pd.usage();
  assert.equal(fetch.calls[0].url, `${BASE}/alania/usage`);
  assert.equal(usage.quota, 100000);
});

test("pronunciations list/add/delete", async () => {
  const { pd, fetch } = sdk((_url, init) => {
    if (init.method === "GET") return json({ object: "list", data: [{ id: "p1", term: "PatientDesk", say_as: "Peyşınt Desk" }] });
    if (init.method === "POST") return json({ id: "p1", term: "PatientDesk", say_as: "Peyşınt Desk" });
    return json({ id: "p1", deleted: true });
  });

  const list = await pd.pronunciations.list();
  assert.equal(fetch.calls[0].url, `${BASE}/pronunciations`);
  assert.equal(list.data[0].say_as, "Peyşınt Desk");

  const added = await pd.pronunciations.add({ term: "PatientDesk", say_as: "Peyşınt Desk" });
  assert.equal(fetch.calls[1].method, "POST");
  assert.deepEqual(JSON.parse(fetch.calls[1].init.body), { term: "PatientDesk", say_as: "Peyşınt Desk" });
  assert.equal(added.id, "p1");

  const deleted = await pd.pronunciations.delete("p1");
  assert.equal(fetch.calls[2].url, `${BASE}/pronunciations/p1`);
  assert.equal(fetch.calls[2].method, "DELETE");
  assert.equal(deleted.deleted, true);
});

test("voices.list() and voices.delete() hit /v1/voices", async () => {
  const { pd, fetch } = sdk((_url, init) =>
    init.method === "GET"
      ? json({ object: "list", data: [{ id: "alania2-f1", kind: "builtin" }] })
      : json({ id: "v1", deleted: true }),
  );
  const voices = await pd.voices.list();
  assert.equal(fetch.calls[0].url, `${BASE}/voices`);
  assert.equal(voices.data[0].id, "alania2-f1");

  await pd.voices.delete("v1");
  assert.equal(fetch.calls[1].url, `${BASE}/voices/v1`);
  assert.equal(fetch.calls[1].method, "DELETE");
});

test("voices.save() posts a design as JSON", async () => {
  const { pd, fetch } = sdk(() => json({ id: "v2", source: "design", name: "Danışman" }));
  const saved = await pd.voices.save({
    name: "Danışman",
    voice_description: "A warm, middle-aged woman with a low voice",
    seed: 4242,
    input: "Merhaba, randevunuzu yarın saat on dörde aldım.",
    cfg: 3,
  });
  assert.equal(fetch.calls[0].method, "POST");
  assert.equal(fetch.calls[0].init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), {
    name: "Danışman",
    voice_description: "A warm, middle-aged woman with a low voice",
    seed: 4242,
    input: "Merhaba, randevunuzu yarın saat on dörde aldım.",
    cfg: 3,
  });
  assert.equal(saved.source, "design");
});

test("voices.save() posts a clone as multipart with consent", async () => {
  const { pd, fetch } = sdk(() => json({ id: "v3", source: "clone", name: "Sesim" }));
  await pd.voices.save({
    name: "Sesim",
    file: new Uint8Array([1, 2, 3]),
    transcript: "Kayıtta söylenen cümle.",
    consent: true,
  });
  const init = fetch.calls[0].init;
  assert.equal(init.headers["content-type"], undefined, "multipart sets its own content-type");
  assert.ok(init.body instanceof FormData);
  const form = Object.fromEntries(init.body.entries());
  assert.equal(form.name, "Sesim");
  assert.equal(form.transcript, "Kayıtta söylenen cümle.");
  assert.equal(form.consent, "true");
  assert.deepEqual([...new Uint8Array(await form.file.arrayBuffer())], [1, 2, 3]);
});

test("fetchAlaniaHealth hits the API origin and needs no key", async () => {
  const fetch = mockFetch((url) => {
    assert.equal(url, "https://voice.patientdesk.ai/health/alania");
    return json({ status: "ok", models: { "alania-v2": { status: "ok", default: true } } });
  });
  const health = await fetchAlaniaHealth({ fetch });
  assert.equal(health.status, "ok");
  assert.equal(health.models["alania-v2"].default, true);
  assert.equal(fetch.calls[0].init.headers.authorization, undefined);
});

test("fetchAlaniaHealth honours a custom origin", async () => {
  const fetch = mockFetch(() => json({ status: "ok" }));
  await fetchAlaniaHealth({ fetch, origin: "http://127.0.0.1:9/" });
  assert.equal(fetch.calls[0].url, "http://127.0.0.1:9/health/alania");
});
