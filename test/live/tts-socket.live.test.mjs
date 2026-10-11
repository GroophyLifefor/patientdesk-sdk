import test from "node:test";
import assert from "node:assert/strict";
import { PatientDesk } from "../../dist/index.js";
import { hasApiKey, apiKey, baseUrl, liveEnabled, guard } from "../../helpers/live.mjs";

const RUN = hasApiKey() && liveEnabled();
const skip = RUN ? false : "needs PATIENDESK_API_KEY and an operational service (run `npm run full-test`)";

const client = RUN
  ? new PatientDesk({ apiKey: apiKey(), ...(baseUrl() ? { baseUrl: baseUrl() } : {}), maxRetries: 0, timeout: 30_000 })
  : null;

test("live: the TTS WebSocket speaks over one connection", { skip }, async (t) => {
  // The handshake can be refused intermittently; retry like the STT stream test.
  let last = null;
  for (let attempt = 0; attempt < 3 && !last; attempt++) {
    const events = { ready: false, audio: 0, ended: false, errors: [] };
    const socket = client.speech.socket(
      {
        ready: () => (events.ready = true),
        audio: (chunk) => (events.audio += chunk.length),
        speechEnd: () => (events.ended = true),
        error: (message) => events.errors.push(message),
      },
      { model: "alania-v2" },
    );

    await new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (events.ready || events.errors.length || Date.now() - started > 8000) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });

    if (!events.ready) {
      socket.close();
      await Promise.race([socket.closed, new Promise((r) => setTimeout(r, 2000))]);
      last = { outcome: events.errors.length ? "server-error" : "unreachable", events };
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    await guard(t, "speaking over the WebSocket", async () => {
      await socket.speak({ input: "Merhaba, bu bir akış denemesidir." });
      await new Promise((resolve) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (events.ended || Date.now() - started > 20000) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
      assert.ok(events.audio > 0, "expected binary audio frames");
    });
    socket.stop();
    await Promise.race([socket.closed, new Promise((r) => setTimeout(r, 5000))]);
    return;
  }

  const err = new Error(`TTS WebSocket handshake not ready (${last?.outcome ?? "unknown"})`);
  if (last?.outcome === "server-error" || process.env.PATIENDESK_ALLOW_API_FAULTS === "1") {
    t.skip(`PATIENDESK API FAULT: ${err.message}`);
    return;
  }
  throw err;
});
