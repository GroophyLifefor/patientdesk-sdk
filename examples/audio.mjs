// Shared helpers for the Node.js examples.
//
// Everything here uses ffmpeg / ffplay, which are the only external tools the
// examples rely on. There is no npm dependency. If a tool is missing the
// example prints how to install it instead of failing with a stack trace.

import { spawn, spawnSync } from "node:child_process";

function has(command, probeArgs = ["-version"]) {
  const result = spawnSync(command, probeArgs, { stdio: "ignore" });
  return !result.error && result.status === 0;
}

export function hasFfmpeg() {
  return has("ffmpeg");
}

export function hasFfplay() {
  return has("ffplay");
}

export function requireFfmpeg(name) {
  if (hasFfmpeg()) return true;
  console.error(`[${name}] ffmpeg was not found on PATH.`);
  console.error("           Install it: winget install Gyan.FFmpeg, brew install ffmpeg, or apt install ffmpeg.");
  return false;
}

/** Read the API key, or print one clear message and return null. */
export function requireApiKey(name) {
  const key = (process.env.PATIENDESK_API_KEY ?? process.env.PATIENDESK_KEY ?? "").trim();
  if (key) return key;
  console.error(`[${name}] PATIENDESK_API_KEY is not set.`);
  console.error('           export PATIENDESK_API_KEY="pd_live_..."   (PowerShell: $env:PATIENDESK_API_KEY="pd_live_...")');
  return null;
}

/**
 * Input arguments for capturing the default microphone with ffmpeg, per OS.
 * On Windows DirectShow needs the device name, so it is discovered when
 * possible. Pass `--device` to override.
 */
export function captureInputArgs(device) {
  const platform = process.platform;
  if (platform === "darwin") {
    return ["-f", "avfoundation", "-i", device ?? ":0"];
  }
  if (platform === "win32") {
    const name = device ?? findWindowsAudioDevice();
    if (!name) {
      throw new Error(
        "Could not find a DirectShow audio device. Run `ffmpeg -f dshow -list_devices true -i dummy` and pass --device \"<name>\".",
      );
    }
    return ["-f", "dshow", "-i", `audio=${name}`];
  }
  return ["-f", "alsa", "-i", device ?? "default"];
}

/** Parse `ffmpeg -f dshow -list_devices true -i dummy` for the first audio input. */
function findWindowsAudioDevice() {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = output.match(/\[dshow[^\]]*\]\s+"([^"]+)"\s+\(audio\)/);
  return match ? match[1] : undefined;
}

/** Capture `seconds` of audio to `outPath` as 16 kHz mono WAV. */
export function recordToWav(outPath, seconds, device) {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      ...captureInputArgs(device),
      "-t", String(seconds),
      "-ar", "16000",
      "-ac", "1",
      outPath,
    ];
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}

/**
 * Stream the microphone as raw 16 kHz mono signed 16-bit PCM chunks.
 * Calls `onChunk(Uint8Array)` for every buffer ffmpeg writes to stdout.
 */
export function streamMicPcm(onChunk, device) {
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    ...captureInputArgs(device),
    "-ar", "16000",
    "-ac", "1",
    "-f", "s16le",
    "-",
  ];
  const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "inherit"] });
  ff.stdout.on("data", (chunk) => onChunk(new Uint8Array(chunk)));
  return {
    stop() {
      try {
        ff.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    },
    get process() {
      return ff;
    },
  };
}

/** Play an audio file with the best tool available for this platform. */
export function playFile(path, contentType) {
  const platform = process.platform;
  const isWav = path.toLowerCase().endsWith(".wav") || contentType === "audio/wav";

  if (hasFfplay()) {
    const ff = spawn("ffplay", ["-autoexit", "-nodisp", "-loglevel", "quiet", path], { stdio: "inherit" });
    return new Promise((resolve, reject) => {
      ff.on("error", reject);
      ff.on("close", resolve);
    });
  }
  if (platform === "win32" && isWav) {
    const ps = spawn(
      "powershell",
      ["-NoProfile", "-Command", `(New-Object Media.SoundPlayer '${path}').PlaySync()`],
      { stdio: "inherit" },
    );
    return new Promise((resolve, reject) => {
      ps.on("error", reject);
      ps.on("close", resolve);
    });
  }
  const player = platform === "darwin" ? "afplay" : "aplay";
  const cmd = spawn(player, [path], { stdio: "inherit" });
  return new Promise((resolve, reject) => {
    cmd.on("error", () =>
      reject(new Error(`No player found. Install ffmpeg (ffplay) to play ${path}, or open the file yourself.`)),
    );
    cmd.on("close", resolve);
  });
}

/** Play raw PCM (used by the streaming TTS example). */
export function playPcmStream(stream, { sampleRate = 24000, channels = 1 } = {}) {
  if (!hasFfplay()) throw new Error("ffplay is required for streaming playback. Install ffmpeg.");
  const ff = spawn(
    "ffplay",
    [
      "-autoexit",
      "-nodisp",
      "-loglevel", "quiet",
      "-f", "s16le",
      "-ar", String(sampleRate),
      "-ac", String(channels),
      "-i", "-",
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  stream.pipe(ff.stdin);
  return new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", resolve);
  });
}
