// Helpers shared by the live ("full-test") suites. Live tests only run when
// PATIENDESK_API_KEY is present; `scripts/preflight.mjs` decides that and writes
// test/.live-enabled so missing-key runs fail fast with one clear message.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..");
export const fixturesDir = join(repoRoot, "test", "fixtures");
export const liveEnabledFlag = join(repoRoot, "test", ".live-enabled");

export function apiKey() {
  return process.env.PATIENDESK_API_KEY ?? process.env.PATIENDESK_KEY ?? "";
}

export function hasApiKey() {
  return Boolean(apiKey().trim());
}

export function liveEnabled() {
  try {
    return readFileSync(liveEnabledFlag, "utf8").trim() === "1";
  } catch {
    return false;
  }
}

export function baseUrl() {
  return process.env.PATIENDESK_BASE_URL ?? undefined;
}

/** Turkish text that is stable and low-risk for on-demand TTS generation. */
export function sampleTurKce() {
  return "Randevunuz yarın saat on dört otuz için oluşturuldu. Lütfen on dakika önce gelin.";
}

export function fixture(name) {
  return join(fixturesDir, name);
}

/**
 * Decide whose fault a live failure is: ours or PatientDesk's.
 *
 * PatientDesk frequently surfaces its own internal errors as a bundled
 * `"Error in Duyu/.../Stt: ... Line N: ... <- TypeError: ..."` message, or as
 * `undecodable_audio` even for a valid file. Those patterns mean the request we
 * sent was fine and the service broke — not that our SDK is wrong.
 */
export function faultParty(err) {
  const message = String(err?.message ?? "");
  const lower = message.toLowerCase();
  if (err?.code === "undecodable_audio") return "api";
  if (/file .*line \d+/.test(message)) return "api";
  if (
    /is not json serializable|not subscriptable|unexpected keyword|has no attribute|missing \d+ required positional|unsupported operand|cannot unpack/.test(
      lower,
    )
  ) {
    return "api";
  }
  return "lib";
}

/**
 * Wrap a live assertion so `npm run full-test` names the faulty side instead of
 * failing anonymously: `PATIENDESK API FAULT` (service broke) vs `SDK FAULT`.
 * API faults still fail the run — they are never hidden — but the message makes
 * it obvious the fix is not in this repository.
 */
export function attributeFault(err, context) {
  if (faultParty(err) === "api") {
    const wrapped = new Error(`PATIENDESK API FAULT while ${context}: ${err?.message ?? err}`);
    wrapped.cause = err;
    return wrapped;
  }
  const wrapped = new Error(`SDK FAULT while ${context}: ${err?.message ?? err}`);
  wrapped.cause = err;
  return wrapped;
}

/**
 * Run a live assertion and decide what to do when it throws.
 *
 * - SDK faults always fail (our bug).
 * - PATIENDESK API faults fail loudly by default, but with
 *   `PATIENDESK_ALLOW_API_FAULTS=1` they are reported as a *skipped* test
 *   (still printed, never hidden) so a genuine service outage does not look
 *   like a broken repository.
 */
export async function guard(t, context, fn) {
  try {
    return await fn();
  } catch (err) {
    if (faultParty(err) === "api" && process.env.PATIENDESK_ALLOW_API_FAULTS === "1") {
      t.skip(`PATIENDESK API FAULT while ${context}: ${err?.message ?? err}`);
      return undefined;
    }
    throw attributeFault(err, context);
  }
}
