// Speech to text from the microphone with Duyu (REST). No npm dependencies.
//
//   node examples/stt-mic.mjs 5
//   node examples/stt-mic.mjs 5 --device "Microphone (USB Audio)"
//   node examples/stt-mic.mjs 5 --out kayit.wav --keep
//
// Records N seconds with ffmpeg as 16 kHz mono WAV, transcribes it, prints the
// text. Requires PATIENDESK_API_KEY and ffmpeg on PATH.

import { readFile, rm } from "node:fs/promises";
import { PatientDesk } from "patientdesk-sdk";
import { playFile, recordToWav, requireApiKey, requireFfmpeg } from "./audio.mjs";

const argv = process.argv.slice(2);
const seconds = Number(argv.find((a) => /^\d+(\.\d+)?$/.test(a)) ?? 5);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const device = flag("device", undefined);
const out = flag("out", "mic-sample.wav");
const keep = argv.includes("--keep");

if (!requireFfmpeg("stt-mic")) process.exit(1);

const apiKey = requireApiKey("stt-mic");
if (!apiKey) process.exit(1);

const pd = new PatientDesk({ apiKey });

console.log(`[stt-mic] recording ${seconds}s. Speak now...`);
await recordToWav(out, seconds, device);
console.log(`[stt-mic] captured ${out}`);

if (argv.includes("--play")) {
  await playFile(out, "audio/wav");
}

const audio = await readFile(out);
const started = Date.now();
const { text, duration, language } = await pd.audio.transcribe({
  audio: new Uint8Array(audio),
  audio_format: "wav",
  language: "tr",
});
console.log(`[stt-mic] ${Date.now() - started} ms, ${duration ?? "?"}s audio, ${language ?? "tr"}`);
console.log(text);

if (!keep) await rm(out, { force: true });
