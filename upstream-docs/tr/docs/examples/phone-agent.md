# A phone line with Twilio
Answer a call, transcribe the caller live with Duyu and reply in Alania's voice. Audio stays 8 kHz μ-law both ways; nothing to resample.
## How it fits together
- Twilio answers the call and sends the caller's audio to your server over a Media Stream WebSocket: 20 ms frames of base64 8 kHz μ-law.
- Your server turns μ-law into PCM16 and sends it to Duyu's live stream with sampleRate: 8000.
- Duyu sends a final when a sentence ends. You decide what to say back: rules, an LLM, or both.
- The reply goes to an Alania WebSocket opened with ?encoding=mulaw as a speak. Every binary message that comes back is already 8 kHz μ-law and goes straight back to Twilio.
## TwiML
Return this TwiML from your Twilio number's incoming-call webhook. url is the public WSS address of the bridge below.
XML
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Connect>
<Stream url="wss://your-server.example.com/twilio" />
</Connect>
</Response>
## The bridge
Each call opens two connections and keeps them for the whole call: one to Duyu (listening) and one to Alania (speaking). answer() is your agent.
bridge.js
// bridge.js — npm install ws
import { WebSocketServer, WebSocket } from "ws";
const KEY = process.env.PATIENTDESK_API_KEY;
const GREETING = "Merhaba, size nasıl yardımcı olabilirim?";
// Your agent: take what the caller said, return what to say back.
async function answer(text) {
return "Anladım. Hemen kontrol ediyorum.";
}
// G.711 μ-law byte -> PCM16 sample
function ulawToPcm(u) {
u = ~u & 0xff;
const sign = u & 0x80, exp = (u >> 4) & 7, mant = u & 0x0f;
const s = (((mant << 3) + 0x84) << exp) - 0x84;
return sign ? -s : s;
}
const server = new WebSocketServer({ port: 8080, path: "/twilio" });
server.on("connection", (twilio) => {
let streamSid = null, muted = false, pending = [];
// Duyu hears the caller: 8 kHz PCM16 in, text out.
const duyu = new WebSocket("wss://voice.patientdesk.ai/v1/audio/stream?key=" + KEY);
duyu.on("open", () => duyu.send(JSON.stringify({ type: "start", sampleRate: 8000, eager_final: true })));
duyu.on("message", async (data) => {
const m = JSON.parse(data);
if (m.type === "segment_start" && streamSid) {
twilio.send(JSON.stringify({ event: "clear", streamSid })); // the caller talks over us: stop playback
muted = true;
}
if (m.type === "final" && m.text) say(await answer(m.text));
});
// Alania speaks: text in, 8 kHz μ-law out, the format the phone line carries.
const alania = new WebSocket("wss://voice.patientdesk.ai/v1/audio/speech/stream?encoding=mulaw&key=" + KEY);
let ready = false, queue = [];
const say = (input) => {
const msg = JSON.stringify({ type: "speak", voice: "alania2-f1", input });
ready ? alania.send(msg) : queue.push(msg);
};
alania.on("message", (data, isBinary) => {
if (isBinary) {
if (streamSid && !muted)
twilio.send(JSON.stringify({ event: "media", streamSid, media: { payload: data.toString("base64") } }));
return;
}
const m = JSON.parse(data);
if (m.type === "ready") { ready = true; queue.forEach((q) => alania.send(q)); queue = []; }
if (m.type === "speech_start") muted = false;
if (m.type === "error") console.error("alania", m.code, m.message);
});
twilio.on("message", (raw) => {
const m = JSON.parse(raw);
if (m.event === "start") {
streamSid = m.start.streamSid;
say(GREETING);
} else if (m.event === "media" && duyu.readyState === WebSocket.OPEN) {
// Twilio sends 20 ms frames; forward about 60 ms at a time.
for (const b of Buffer.from(m.media.payload, "base64")) pending.push(ulawToPcm(b));
if (pending.length >= 480) {
duyu.send(Buffer.from(Int16Array.from(pending).buffer));
pending = [];
}
} else if (m.event === "stop") {
twilio.close();
}
});
twilio.on("close", () => {
if (duyu.readyState === WebSocket.OPEN) duyu.send(JSON.stringify({ type: "stop" }));
if (alania.readyState === WebSocket.OPEN) alania.send(JSON.stringify({ type: "stop" }));
});
});
- Barge-in. When the caller talks over Alania, Duyu sends segment_start. The bridge sends Twilio a clear to drop buffered audio and discards the rest of that reply.
- Order. Alania handles speak messages one at a time, in order. Messages sent before the connection is ready wait in a queue.
- Chunk size. Twilio sends 20 ms; the bridge forwards 60 ms at a time (Duyu expects 40–100 ms chunks).
## Latency
Step | Time | Knob |
End of sentence | ~500 ms of silence | eager_final: true moves it about 120 ms earlier (on in the bridge). |
Your agent | up to you | Stream the LLM reply and send each sentence as its own speak. |
First audio | ~190 ms | The μ-law conversion runs on the server and adds nothing. |
