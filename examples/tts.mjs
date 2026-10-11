// Text to speech with Alania, then play the audio. No npm dependencies.
//
//   node examples/tts.mjs "Randevunuz oluşturuldu."
//   node examples/tts.mjs "Metin" --format mp3 --out randevu.mp3
//   node examples/tts.mjs "Metin" --no-play
//   node examples/tts.mjs "Metin" --stream        # low latency, pipes ffplay
//   node examples/tts.mjs "Metin" --model alania-v2 --voice alania2-m1 --style support-warm
//   node examples/tts.mjs "Metin" --instructions "speaking slowly and calmly"
//   node examples/tts.mjs "Metin" --telephone --out karsilama.ulaw   # 8 kHz G.711 μ-law
//
// Requires PATIENDESK_API_KEY. Playback needs ffplay (from ffmpeg) or a OS player.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PatientDesk } from "patientdesk-sdk";
import { hasFfplay, playFile, playPcmStream, requireApiKey } from "./audio.mjs";

function parseArgs(argv) {
  const args = {
    text: argv[0],
    format: undefined,
    out: undefined,
    play: true,
    stream: false,
    model: undefined,
    voice: undefined,
    style: undefined,
    instructions: undefined,
    telephone: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--format") args.format = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--no-play") args.play = false;
    else if (arg === "--stream") args.stream = true;
    else if (arg === "--model") args.model = argv[++i];
    else if (arg === "--voice") args.voice = argv[++i];
    else if (arg === "--style") args.style = argv[++i];
    else if (arg === "--instructions") args.instructions = argv[++i];
    else if (arg === "--telephone") args.telephone = true;
  }
  if (args.telephone) args.format = "mulaw";
  if (args.stream) args.format = args.telephone ? "mulaw" : "pcm";
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.text) {
  console.error('Usage: node examples/tts.mjs "text to speak" [--model id] [--voice id] [--style id]');
  console.error('       [--instructions "how to speak"] [--format wav|mp3|pcm|mulaw|alaw] [--telephone]');
  console.error("       [--out file] [--no-play] [--stream]");
  process.exit(1);
}

const apiKey = requireApiKey("tts");
if (!apiKey) process.exit(1);

const pd = new PatientDesk({ apiKey });

const speechParams = {
  input: args.text,
  ...(args.model ? { model: args.model } : {}),
  ...(args.voice ? { voice: args.voice } : {}),
  ...(args.style ? { style: args.style } : {}),
  ...(args.instructions ? { instructions: args.instructions } : {}),
};

if (args.stream) {
  // Low latency: play each chunk while the rest is still being generated.
  if (!hasFfplay()) {
    console.error("[tts] --stream needs ffplay (from ffmpeg) on PATH.");
    console.error("      Install it: winget install Gyan.FFmpeg, brew install ffmpeg, or apt install ffmpeg.");
    process.exit(1);
  }
  // Alania samples at 48 kHz (alania-v2, antalia-mini) or 24 kHz (alania-v1).
  const sampleRate = args.model === "alania-v1" || (!args.model && !args.telephone) ? 24000 : 48000;
  const chunks = pd.speech.stream({ ...speechParams, response_format: args.format });
  await playPcmStream(chunks, { sampleRate, channels: 1 });
} else {
  const speech = await pd.speech.create({ ...speechParams, response_format: args.format ?? "wav" });
  const bytes = new Uint8Array(await speech.arrayBuffer());
  const extension = args.format === "opus" ? "ogg" : args.format === "mulaw" ? "ulaw" : args.format === "alaw" ? "alaw" : args.format ?? "wav";
  const out = args.out ?? `randevu.${extension}`;

  await mkdir(dirname(out), { recursive: true }).catch(() => {});
  await writeFile(out, bytes);
  console.log(
    `[tts] wrote ${out} (${bytes.length} bytes, ${speech.contentType}, ${speech.disclosure}` +
      `${speech.model ? `, ${speech.model}` : ""}${speech.characters !== null ? `, ${speech.characters} chars` : ""})`,
  );

  if (args.play && !args.telephone) {
    console.log("[tts] playing...");
    await playFile(out, speech.contentType);
  }
}
