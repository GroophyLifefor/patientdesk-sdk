# Node.js recipes

Real-life examples for the two things people build first: speak text, and turn
speech into text. Every recipe is a runnable file under [`examples/`](../examples)
and needs no npm dependency. The only external tool is `ffmpeg` (with `ffplay`)
for recording and playback.

```sh
# macOS / Linux
export PATIENDESK_API_KEY="pd_live_..."

# Windows PowerShell
$env:PATIENDESK_API_KEY="pd_live_..."
```

Install ffmpeg if you do not have it:

```sh
# Windows
winget install Gyan.FFmpeg

# macOS
brew install ffmpeg

# Debian or Ubuntu
sudo apt install ffmpeg
```

| Recipe | File | What it does |
| --- | --- | --- |
| Speak and play | `examples/tts.mjs` | Alania to a file, then plays it. `--stream` plays while it downloads. |
| Transcribe a file | `examples/stt-file.mjs` | Duyu over REST, with `verbose_json`, `srt` and `vtt`. |
| Record then transcribe | `examples/stt-mic.mjs` | Records the microphone with ffmpeg, then transcribes it. |
| Live microphone | `examples/stt-live.mjs` | Streams the microphone to Duyu over WebSocket. |

## Speak text and hear it

The shortest path: one call, save the bytes, play the file.

```ts
import { writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PatientDesk } from "patientdesk-sdk";

const run = promisify(execFile);
const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

async function speak(text: string) {
  const speech = await pd.speech.create({ input: text, response_format: "wav" });
  await writeFile("randevu.wav", new Uint8Array(await speech.arrayBuffer()));
  // ffplay ships with ffmpeg and plays on every desktop OS.
  await run("ffplay", ["-autoexit", "-nodisp", "-loglevel", "quiet", "randevu.wav"]);
}

await speak("Randevunuz yarın saat 14:05 için oluşturuldu.");
```

### Low latency playback

For a voice assistant you want audio to start before the whole file arrives.
Ask for raw PCM and pipe it to `ffplay` as it streams.

```ts
import { spawn } from "node:child_process";
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

async function speakStreaming(text: string) {
  const response = await pd.speech.createRaw({ input: text, response_format: "pcm" });

  const player = spawn("ffplay", [
    "-autoexit", "-nodisp", "-loglevel", "quiet",
    "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-",
  ]);
  response.body.pipe(player.stdin);
  await new Promise((resolve) => player.on("close", resolve));
}

await speakStreaming("Bir saniye, kaydınızı kontrol ediyorum.");
```

`pcm` is uncompressed 16-bit mono, so the sample rate and channel count are
fixed. `wav` is 24 kHz mono.

Run it:

```sh
node examples/tts.mjs "Randevunuz oluşturuldu."
node examples/tts.mjs "Merhaba" --stream
```

## Transcribe a file

Send the bytes and read the transcript. Duyu takes base64 JSON, the SDK encodes
it for you.

```ts
import { readFile } from "node:fs/promises";
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

const audio = await readFile("kayit.m4a");
const { text, language, duration } = await pd.audio.transcribe({
  audio: new Uint8Array(audio),
  audio_format: "m4a",
  language: "tr",
});

console.log(`${language} ${duration}s`);
console.log(text);
```

For subtitles, ask for `srt` or `vtt` and write the string straight to a file.

```ts
const srt = await pd.audio.transcribe({
  audio: new Uint8Array(await readFile("interview.mp3")),
  response_format: "srt",
});
await writeFile("interview.srt", srt);
```

Run it:

```sh
node examples/stt-file.mjs kayit.m4a
node examples/stt-file.mjs kayit.wav --verbose
node examples/stt-file.mjs interview.mp3 --format srt > interview.srt
```

## Record from the microphone, then transcribe

There is no bundled microphone API, but ffmpeg captures the default input on
every platform. Record a WAV, then send it.

```ts
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { PatientDesk } from "patientdesk-sdk";

function record(seconds: number, out: string) {
  // Windows needs a DirectShow device name. Use "ffmpeg -f dshow -list_devices true -i dummy"
  // to find it, or see examples/audio.mjs which discovers it for you.
  const input =
    process.platform === "darwin"
      ? ["-f", "avfoundation", "-i", ":0"]
      : process.platform === "win32"
        ? ["-f", "dshow", "-i", `audio=${process.env.MIC_DEVICE}`]
        : ["-f", "alsa", "-i", "default"];

  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      ...input,
      "-t", String(seconds),
      "-ar", "16000", "-ac", "1",
      out,
    ]);
    ff.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`ffmpeg ${code}`))));
  });
}

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

await record(5, "mic.wav");
const { text } = await pd.audio.transcribe({
  audio: new Uint8Array(await readFile("mic.wav")),
  audio_format: "wav",
  language: "tr",
});
console.log(text);
```

`examples/audio.mjs` wraps this, including device discovery on Windows.

Run it:

```sh
node examples/stt-mic.mjs 5
node examples/stt-mic.mjs 5 --keep --out kayit.wav
```

## Live microphone over WebSocket

For a live assistant, streaming is lower latency than record-then-send. It is
undocumented and experimental, so read [Streaming](streaming.md) first.

```ts
import { spawn } from "node:child_process";
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({ apiKey: process.env.PATIENDESK_API_KEY });

const stream = pd.audio.transcribeStream({
  final: (text) => console.log("final:", text),
  error: (message) => console.error(message),
});

// 16 kHz mono signed 16-bit PCM, exactly what the endpoint expects.
const ff = spawn("ffmpeg", [
  "-hide_banner", "-loglevel", "error",
  "-f", "avfoundation", "-i", ":0",
  "-ar", "16000", "-ac", "1", "-f", "s16le", "-",
]);
ff.stdout.on("data", (chunk) => stream.sendAudio(new Uint8Array(chunk)));

process.on("SIGINT", () => {
  ff.kill("SIGKILL");
  stream.stop();
});
await stream.closed;
```

Run it:

```sh
node examples/stt-live.mjs 10
```

Node 22 and later ship a global `WebSocket`. On older versions pass one to the
client: `new PatientDesk({ apiKey, WebSocket })`.

## Telling "us" from PatientDesk

If a valid file comes back as `undecodable_audio`, it is a service-side decode
error and not your input. Check the service first, then retry.

```ts
import { fetchStatus, isOperational } from "patientdesk-sdk";

if (!isOperational(await fetchStatus())) {
  console.warn("PatientDesk is degraded, try again later");
}
```

See [Testing](testing.md) for how the live suite attributes these faults, and
[Troubleshooting](troubleshooting.md) for the common messages.
