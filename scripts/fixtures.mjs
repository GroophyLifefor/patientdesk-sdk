#!/usr/bin/env node
// Regenerate test fixtures (test/fixtures/). Requires ffmpeg on PATH.
//
//   node scripts/fixtures.mjs
//
// Produces a Turkish speech WAV via Alania (if PATIENDESK_API_KEY is set),
// then derives m4a/mp3/ogg/webm/flac variants and a truncated file with the
// same WAV header, so STT format-detection and error paths can be tested offline.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { encodeWav, pcmSamples } from "../helpers/wav.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "test", "fixtures");
mkdirSync(outDir, { recursive: true });

const key = process.env.PATIENDESK_API_KEY ?? process.env.PATIENDESK_KEY ?? "";
const sampleText = "Randevunuz yarın saat on dört otuz için oluşturuldu. Lütfen on dakika önce gelin.";

function ffmpeg(args) {
  const res = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${res.stderr || res.status}`);
}

const wavPath = join(outDir, "tr-sample.wav");

if (key && !process.argv.includes("--no-api")) {
  console.log("[fixtures] generating tr-sample.wav via Alania...");
  const res = await fetch("https://voice.patientdesk.ai/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "alania-v1", input: sampleText, voice: "alania", response_format: "wav" }),
  });
  if (!res.ok) throw new Error(`TTS failed: HTTP ${res.status}`);
  writeFileSync(wavPath, new Uint8Array(await res.arrayBuffer()));
} else if (!existsSync(wavPath)) {
  console.log("[fixtures] no API key - writing a synthetic tone WAV (no speech; live STT will not match).");
  writeFileSync(wavPath, encodeWav(pcmSamples(16000)));
}

console.log("[fixtures] deriving formats with ffmpeg...");
ffmpeg(["-i", wavPath, "-c:a", "aac", join(outDir, "tr-sample.m4a")]);
ffmpeg(["-i", wavPath, "-c:a", "libmp3lame", join(outDir, "tr-sample.mp3")]);
ffmpeg(["-i", wavPath, "-c:a", "libvorbis", join(outDir, "tr-sample.ogg")]);
ffmpeg(["-i", wavPath, "-c:a", "libopus", join(outDir, "tr-sample.webm")]);
ffmpeg(["-i", wavPath, "-c:a", "flac", join(outDir, "tr-sample.flac")]);
// Raw mono 16-bit PCM at 16 kHz: what the WebSocket streaming endpoint expects.
ffmpeg(["-i", wavPath, "-ar", "16000", "-ac", "1", "-f", "s16le", join(outDir, "tr-sample-16k.pcm")]);

// Corrupt fixture: a valid WAV header with the data chunk cut short, for the
// 400 "cannot decode" path.
const validWav = readFileSync(wavPath);
writeFileSync(join(outDir, "tr-sample-truncated.wav"), validWav.subarray(0, Math.max(44, Math.floor(validWav.length / 3))));

console.log(`[fixtures] done -> ${outDir}`);
