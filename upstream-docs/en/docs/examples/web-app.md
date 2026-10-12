# Speech in a web app
Keep your key on the server: a small route forwards the request to Alania and streams the audio back, and the browser starts playing on the first chunk.
- Add a /api/speak route on your server. It forwards the request to Alania with stream: true and passes the response straight back.
- In the browser, speak(text) reads the WAV header, then queues each PCM chunk with Web Audio.
- Wire it to a button. The first audio arrives about 190 ms after the request (depending on your network).
## 1 · The server route
The key lives in the PATIENTDESK_API_KEY environment variable and never reaches the browser. The route passes the response through without buffering it, so audio reaches the browser while the rest of the sentence is still being made.
Server
// app/api/speak/route.ts — the API key stays on the server
export async function POST(req: Request) {
const { text, voice = "alania2-f1" } = await req.json();
// Check your own session and limits here before spending characters.
const upstream = await fetch("https://voice.patientdesk.ai/v1/audio/speech", {
method: "POST",
headers: {
Authorization: `Bearer ${process.env.PATIENTDESK_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({ model: "alania-v2", voice, input: text, stream: true }),
});
if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
// Pass the stream straight through: the first audio reaches the browser
// while the rest of the sentence is still being made.
return new Response(upstream.body, {
headers: { "Content-Type": upstream.headers.get("content-type") ?? "audio/wav" },
});
}
## 2 · Playing in the browser
The response starts with a 44-byte WAV header; the sample rate is at byte 24 (48,000 on Alania-2). After that it is raw PCM16. Network chunks can split a sample, so a leftover byte is carried over to the next chunk.
speak.js
// speak.js — call it from a click: browsers only start audio after a user gesture.
export async function speak(text) {
const ctx = new AudioContext({ sampleRate: 48000 });
const res = await fetch("/api/speak", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ text }),
});
if (!res.ok) throw new Error(await res.text());
const reader = res.body.getReader();
let header = new Uint8Array(0), rate = 48000, carry = null, at = 0;
for (;;) {
const { value, done } = await reader.read();
if (done) break;
let bytes = value;
if (header.length < 44) { // a 44-byte WAV header comes first
const need = 44 - header.length;
header = concat(header, bytes.subarray(0, need));
bytes = bytes.subarray(need);
if (header.length === 44) rate = new DataView(header.buffer).getUint32(24, true);
}
if (carry) { bytes = concat(carry, bytes); carry = null; }
if (bytes.length % 2) { carry = bytes.slice(-1); bytes = bytes.subarray(0, -1); }
if (!bytes.length) continue;
const pcm = new Int16Array(bytes.slice().buffer); // PCM16, little-endian, mono
const buf = ctx.createBuffer(1, pcm.length, rate);
const out = buf.getChannelData(0);
for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
const src = ctx.createBufferSource();
src.buffer = buf;
src.connect(ctx.destination);
at = Math.max(at, ctx.currentTime + 0.05); // queue each chunk after the last
src.start(at);
at += buf.duration;
}
}
const concat = (a, b) => {
const c = new Uint8Array(a.length + b.length);
c.set(a);
c.set(b, a.length);
return c;
};
## 3 · Wiring a button
Browsers only play audio after a user gesture, so start speak from a click.
React
import { speak } from "./speak";
export function ListenButton() {
return (
<button onClick={() => speak("Randevunuz yarın saat 14:05 için oluşturuldu.")}>
Dinle
</button>
);
}
## In production
- If you speak the same sentences again and again (greetings, menus), render them with a seed and cache the file: the same seed, text and settings give the same audio.
- Use the pronunciation dictionary for brand and person names; your route does not change.
- If a voice agent says many sentences in a row, one WebSocket connection from your server is more efficient.
- Tell listeners the audio is AI-generated; every response carries x-disclosure: ai-generated.
