import { PatientDeskError } from "./errors.js";

/** Minimal byte-source type shared by STT audio and TTS reference audio. */
export type ByteSource = Uint8Array | ArrayBuffer | Blob;

/** Normalize a byte source into a `Uint8Array`. */
export async function toUint8Array(source: ByteSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new TypeError("Expected a Uint8Array, ArrayBuffer or Blob.");
}

/** Base64-encode bytes (no data URL prefix). Uses `Buffer` when available, `btoa` otherwise. */
export function toBase64(bytes: Uint8Array): string {
  const BufferCtor = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: string): string } } }).Buffer;
  if (BufferCtor) return BufferCtor.from(bytes).toString("base64");
  const btoaFn = (globalThis as { btoa?: (s: string) => string }).btoa;
  if (typeof btoaFn === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoaFn(binary);
  }
  throw new PatientDeskError("No base64 encoder available (need `Buffer` or `btoa`).", {
    status: 0,
    code: "no_base64",
  });
}

/** Decode a base64 string (a `data:` URL prefix is stripped). */
export function fromBase64(value: string): Uint8Array {
  const clean = stripDataUrl(value).replace(/\s+/g, "");
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (typeof atobFn === "function") {
    const binary = atobFn(clean);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  const BufferCtor = (globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } }).Buffer;
  if (BufferCtor) return new Uint8Array(BufferCtor.from(clean, "base64"));
  throw new PatientDeskError("No base64 decoder available (need `Buffer` or `atob`).", {
    status: 0,
    code: "no_base64",
  });
}

/** Remove a `data:...;base64,` prefix, leaving the payload. */
export function stripDataUrl(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma >= 0 ? value.slice(comma + 1) : value;
}

/**
 * `Blob` from bytes. The cast keeps this working across TS lib versions where
 * `Uint8Array`'s buffer is typed as `ArrayBufferLike` but `BlobPart` wants an
 * `ArrayBuffer`.
 */
export function bytesToBlob(bytes: Uint8Array, type?: string): Blob {
  return new Blob([bytes as unknown as BlobPart], type ? { type } : undefined);
}
