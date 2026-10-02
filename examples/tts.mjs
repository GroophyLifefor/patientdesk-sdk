// Text to speech with Alania, then play the audio. No npm dependencies.
//
//   node examples/tts.mjs "Randevunuz oluşturuldu."
//   node examples/tts.mjs "Metin" --format mp3 --out randevu.mp3
//   node examples/tts.mjs "Metin" --no-play
//   node examples/tts.mjs "Metin" --stream        # low latency, pipes ffplay
//
// Requires PATIENDESK_API_KEY. Playback needs ffplay (from ffmpeg) or a OS player.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PatientDesk } from "patientdesk-sdk";
import { hasFfplay, playFile, playPcmStream, requireApiKey } from "./audio.mjs";

function parseArgs(argv) {
  const args = { text: argv[0], format: "wav", out: undefined, play: true, stream: false };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--format") args.format = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--no-play") args.play = false;
    else if (arg === "--stream") {
      args.stream = true;
      args.format = "pcm";
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.text) {
  console.error('Usage: node examples/tts.mjs "text to speak" [--format wav|mp3|pcm] [--out file] [--no-play] [--stream]');
  process.exit(1);
}

const apiKey = requireApiKey("tts");
if (!apiKey) process.exit(1);

const pd = new PatientDesk({ apiKey });

if (args.stream) {
  // Low latency: forward the audio chunks straight to the player as they arrive.
  if (!hasFfplay()) {
    console.error("[tts] --stream needs ffplay (from ffmpeg) on PATH.");
    console.error("      Install it: winget install Gyan.FFmpeg, brew install ffmpeg, or apt install ffmpeg.");
    process.exit(1);
  }
  const response = await pd.speech.createRaw({
    input: args.text,
    response_format: "pcm",
  });
  console.log(`[tts] streaming ${response.status} ${response.headers.get("content-type") ?? ""}`);
  await playPcmStream(response.body, { sampleRate: 24000, channels: 1 });
} else {
  const speech = await pd.speech.create({
    input: args.text,
    response_format: args.format,
  });
  const bytes = new Uint8Array(await speech.arrayBuffer());
  const out = args.out ?? `randevu.${args.format === "opus" ? "ogg" : args.format}`;

  await mkdir(dirname(out), { recursive: true }).catch(() => {});
  await writeFile(out, bytes);
  console.log(`[tts] wrote ${out} (${bytes.length} bytes, ${speech.contentType}, ${speech.disclosure})`);

  if (args.play) {
    console.log("[tts] playing...");
    await playFile(out, speech.contentType);
  }
}
