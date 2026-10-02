#!/usr/bin/env node
// Preflight for `npm run full-test`.
//
// 1. Requires PATIENDESK_API_KEY (there is no way to hit the live models without it).
// 2. Checks PatientDesk's Statuspage; the live suite is skipped unless it is up.
//
// On success it writes test/.live-enabled=1 so the live suites run. On failure it
// exits non-zero with ONE actionable message (never a silent pass).

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchStatus, isOperational, statusDescription } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const flagPath = join(here, "..", "test", ".live-enabled");

function fail(message, hint) {
  mkdirSync(dirname(flagPath), { recursive: true });
  writeFileSync(flagPath, "0\n");
  console.error(`\n[preflight] ${message}`);
  if (hint) console.error(`[preflight] ${hint}`);
  console.error("[preflight] full-test cannot run. (Unit tests: `npm test`.)\n");
  process.exit(1);
}

const key = process.env.PATIENDESK_API_KEY ?? process.env.PATIENDESK_KEY ?? "";
if (!key.trim()) {
  fail(
    "PATIENDESK_API_KEY is not set.",
    "Get a key at https://speech.patientdesk.ai and run: $env:PATIENDESK_API_KEY=\"pd_live_...\" (PowerShell)",
  );
}

let status;
try {
  status = await fetchStatus();
} catch (err) {
  fail(`status endpoint unreachable: ${err?.message ?? err}`, "Retry when status.patientdesk.ai is reachable.");
}

const description = statusDescription(status);
if (!isOperational(status)) {
  fail(
    `PatientDesk is not fully operational: "${description}" (indicator: ${status?.status?.indicator ?? "unknown"}).`,
    "Live tests are skipped while the service is degraded. Down-behavior tests live in `npm test`.",
  );
}

mkdirSync(dirname(flagPath), { recursive: true });
writeFileSync(flagPath, "1\n");
console.log(`[preflight] PatientDesk status: ${description}`);
console.log("[preflight] API key present, service up — running live tests.\n");
