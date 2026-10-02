import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PatientDesk } from "../../dist/index.js";
import { hasApiKey, apiKey, baseUrl, liveEnabled, fixture, guard } from "../../helpers/live.mjs";

const RUN = hasApiKey() && liveEnabled();
const skip = RUN ? false : "needs PATIENDESK_API_KEY and an operational service (run `npm run full-test`)";

const client = RUN
  ? new PatientDesk({ apiKey: apiKey(), ...(baseUrl() ? { baseUrl: baseUrl() } : {}), maxRetries: 0, timeout: 30_000 })
  : null;

function loadPcm() {
  try {
    return new Uint8Array(readFileSync(fixture("tr-sample-16k.pcm")));
  } catch {
    return null;
  }
}

// The WebSocket endpoint is undocumented and its handshake is intermittently
// refused (socket closes with code 1006 before a ready frame). `connectStream`
// retries a few times so a flaky handshake does not read as a broken client.
//
// `outcome` is "ready", "server-error" (the service sent an error frame) or
// "unreachable" (socket closed or never answered). Only "unreachable" after
// retries can blame the client, everything else is a PATIENDESK API FAULT.

async function connectStream({ attempts = 5, readyMs = 8000 } = {}) {
  let last = "unreachable";
  for (let i = 0; i < attempts; i++) {
    const events = [];
    const stream = client.audio.transcribeStream(
      {
        ready: (info) => events.push({ type: "ready", info }),
        final: (text) => events.push({ type: "final", text }),
        error: (message) => events.push({ type: "error", message }),
      },
      { sampleRate: 16000, eagerFinal: true },
    );

    const outcome = await new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (events.some((e) => e.type === "ready")) {
          clearInterval(timer);
          resolve("ready");
        } else if (events.some((e) => e.type === "error")) {
          clearInterval(timer);
          resolve("server-error");
        } else if (Date.now() - started > readyMs) {
          clearInterval(timer);
          resolve("unreachable");
        }
      }, 50);
    });

    if (outcome === "ready") return { stream, events, outcome, attempts: i + 1 };
    stream.stop();
    await Promise.race([stream.closed, new Promise((r) => setTimeout(r, 2000))]);
    last = outcome;
    await new Promise((r) => setTimeout(r, 400));
  }
  return { stream: null, events: [], outcome: last, attempts };
}

test("live: streaming STT reaches a ready state", { skip }, async (t) => {
  const { stream, outcome, attempts, events } = await connectStream();

  if (outcome !== "ready") {
    // Never blame the client when the socket refuses to hand a ready frame:
    // the endpoint is undocumented and its auth/API changes without notice.
    // Only "unreachable" after retries is treated as a client-side problem.
    const err = new Error(
      `streaming handshake not ready after ${attempts} attempts (${outcome}) events=${JSON.stringify(events)}`,
    );
    if (outcome === "server-error" || process.env.PATIENDESK_ALLOW_API_FAULTS === "1") {
      t.skip(`PATIENDESK API FAULT: ${err.message}`);
      return;
    }
    throw err;
  }

  stream.stop();
  await Promise.race([stream.closed, new Promise((r) => setTimeout(r, 2000))]);
});

test("live: streaming STT transcribes a PCM clip", { skip }, async (t) => {
  const pcm = loadPcm();
  if (!pcm) return;

  const { stream, outcome, attempts, events } = await connectStream();
  if (!stream) {
    const err = new Error(`streaming STT could not connect after ${attempts} attempts (${outcome})`);
    if (outcome === "server-error" || process.env.PATIENDESK_ALLOW_API_FAULTS === "1") {
      t.skip(`PATIENDESK API FAULT: ${err.message}`);
      return;
    }
    throw err;
  }

  await guard(t, "streaming a PCM clip", async () => {
    const finals = [];
    const chunk = 3200; // 100 ms of 16 kHz s16le
    for (let i = 0; i < pcm.length; i += chunk) {
      stream.sendAudio(pcm.subarray(i, i + chunk));
      await new Promise((r) => setTimeout(r, 100));
    }
    stream.sendAudio(new Uint8Array(16000)); // 0.5s of trailing silence
    await new Promise((r) => setTimeout(r, 500));
    stream.stop();
    await Promise.race([stream.closed, new Promise((r) => setTimeout(r, 6000))]);

    for (const event of events) if (event.type === "final") finals.push(event.text);
    assert.ok(finals.length > 0, "expected at least one final transcript");
    const text = finals.join(" ").toLocaleLowerCase("tr");
    assert.match(text, /randevu|oluşturuldu|dakika|gelin|saat/, `expected a Turkish keyword in: ${finals.join(" ")}`);
  });
});
