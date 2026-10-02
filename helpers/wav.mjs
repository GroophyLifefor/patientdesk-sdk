// Minimal WAV encoder/decoder for fixtures and live tests (16-bit PCM mono).

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const FMT = 0x666d7420; // "fmt "
const DATA = 0x64617461; // "data"

/** Encode mono 16-bit PCM samples into a WAV (RIFF) buffer. */
export function encodeWav(samples, { sampleRate = 24000 } = {}) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i]))), true);
  }
  return new Uint8Array(buffer);
}

/** Parse a RIFF/WAVE buffer and return its fmt + data chunks. */
export function parseWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset) => view.getUint32(offset, false);
  const ascii = (offset, len) => String.fromCharCode(...bytes.subarray(offset, offset + len));
  if (tag(0) !== RIFF || ascii(8, 4) !== "WAVE") throw new Error("not a RIFF/WAVE file");
  let offset = 12;
  let fmt;
  let data;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === FMT) {
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        byteRate: view.getUint32(body + 8, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === DATA) {
      data = bytes.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("missing fmt/data chunk");
  return { fmt, data };
}

/** A short mono 16-bit PCM sample buffer (sine-ish), for tests. */
export function pcmSamples(count = 400, rate = 16000) {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = 0.3 * 32767 * Math.sin((2 * Math.PI * 440 * i) / rate);
  return out;
}
