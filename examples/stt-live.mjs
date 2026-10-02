// Live transcription from the microphone over the WebSocket stream.
// No npm dependencies. Node 22+ has a global WebSocket, older versions need one.
//
//   node examples/stt-live.mjs 8
//   node examples/stt-live.mjs --device "Microphone (USB Audio)"
//
// Streams 16 kHz mono PCM from ffmpeg to Duyu and prints final transcripts.
// The endpoint is undocumented, so treat this as experimental.
// Requires PATIENDESK_API_KEY and Node 22+ (or a WebSocket implementation).

import { PatientDesk } from "patientdesk-sdk";
import { requireApiKey, requireFfmpeg, streamMicPcm } from "./audio.mjs";

const argv = process.argv.slice(2);
const secondsArg = argv.find((a) => /^\d+(\.\d+)?$/.test(a));
const seconds = secondsArg ? Number(secondsArg) : 0; // 0 means run until Ctrl+C
const deviceIndex = argv.indexOf("--device");
const device = deviceIndex >= 0 ? argv[deviceIndex + 1] : undefined;

if (!requireFfmpeg("stt-live")) process.exit(1);

const apiKey = requireApiKey("stt-live");
if (!apiKey) process.exit(1);

const pd = new PatientDesk({ apiKey });

const finals = [];
const stream = pd.audio.transcribeStream(
  {
    ready: (info) => console.log(`[stt-live] ready (${info.model ?? "duyu"})`),
    final: (text) => {
      finals.push(text);
      console.log(`[stt-live] final: ${text}`);
    },
    error: (message) => console.error(`[stt-live] error: ${message}`),
    close: (code, reason) => console.log(`[stt-live] closed ${code} ${reason}`),
  },
  { sampleRate: 16000, eagerFinal: true },
);

const mic = streamMicPcm((chunk) => stream.sendAudio(chunk), device);
console.log(seconds > 0 ? `[stt-live] listening for ${seconds}s...` : "[stt-live] listening. Press Ctrl+C to stop.");

function stop() {
  mic.stop();
  stream.stop();
}

process.on("SIGINT", () => {
  stop();
});

if (seconds > 0) setTimeout(stop, seconds * 1000);

await stream.closed;
console.log(`[stt-live] ${finals.length} final transcript(s)`);
if (finals.length) console.log(finals.join(" "));
