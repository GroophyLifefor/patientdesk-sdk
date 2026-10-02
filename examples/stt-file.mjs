// Speech to text from a file with Duyu. No npm dependencies.
//
//   node examples/stt-file.mjs kayit.m4a
//   node examples/stt-file.mjs kayit.wav --verbose --lang tr
//   node examples/stt-file.mjs kayit.mp3 --format srt
//
// Requires PATIENDESK_API_KEY.

import { readFile } from "node:fs/promises";
import { PatientDesk } from "patientdesk-sdk";
import { requireApiKey } from "./audio.mjs";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: node examples/stt-file.mjs <file> [--format json|text|verbose_json|srt|vtt] [--lang tr|auto] [--prompt hint]");
  process.exit(1);
}

const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const responseFormat = argv.includes("--verbose") ? "verbose_json" : flag("format", "json");
const language = flag("lang", "tr");
const prompt = flag("prompt", undefined);

const apiKey = requireApiKey("stt-file");
if (!apiKey) process.exit(1);

const pd = new PatientDesk({ apiKey });

const audio = await readFile(file);
const started = Date.now();

if (responseFormat === "verbose_json") {
  const result = await pd.audio.transcribe({
    audio: new Uint8Array(audio),
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
    language,
    prompt,
  });
  console.log(`[stt] ${file} in ${Date.now() - started} ms`);
  console.log(result.text);
  for (const segment of result.segments ?? []) {
    console.log(`  ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s  ${segment.text.trim()}`);
  }
} else if (responseFormat === "text" || responseFormat === "srt" || responseFormat === "vtt") {
  const result = await pd.audio.transcribe({
    audio: new Uint8Array(audio),
    response_format: responseFormat,
    language,
    prompt,
  });
  console.log(result);
} else {
  const result = await pd.audio.transcribe({
    audio: new Uint8Array(audio),
    language,
    prompt,
  });
  console.log(`[stt] ${file} in ${Date.now() - started} ms`);
  console.log(result.text);
  if (result.duration) console.log(`[stt] duration ${result.duration}s, language ${result.language ?? language}`);
}
