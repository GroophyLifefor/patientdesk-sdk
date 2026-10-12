# Tarayıcıda canlı altyazı
Mikrofonu Duyu’ya akıtın ve sözcükleri söylendikçe gösterin: konuşurken partial taslaklar, durunca kesinleşmiş bir final satırı.
## 1 · Sunucudan token
Tarayıcıya anahtar vermeyin. Kendi sunucunuzda 10 dakikalık bir oturum tokenı üretin; tarayıcı WebSocket’i ?token= ile açar. Ayrıntılar Kimlik doğrulama sayfasında.
Next.js
// app/api/duyu-token/route.ts — a 10-minute token instead of your key
import { SignJWT } from "jose";
export async function GET() {
const userId = "user_123"; // from your own session
const secret = new TextEncoder().encode(process.env.SESSION_JWT_SECRET);
const token = await new SignJWT({ scope: "playground" })
.setProtectedHeader({ alg: "HS256" })
.setSubject(userId)
.setIssuedAt()
.setExpirationTime("10m")
.sign(secret);
return Response.json({ token });
}
## 2 · Mikrofonu akıtmak
Küçük bir AudioWorklet mikrofon örneklerini toplar; yaklaşık her 50 ms’de bir Int16 PCM olarak gönderilir. Tarayıcının kendi örnekleme hızını (çoğunlukla 48.000) start mesajında bildirin; Duyu yeniden örnekler.
captions.js
// captions.js — start from a click (microphone permission needs a gesture)
export async function startCaptions(onPartial, onFinal) {
const { token } = await (await fetch("/api/duyu-token")).json();
const ws = new WebSocket("wss://voice.patientdesk.ai/v1/audio/stream?token=" + token);
const mic = await navigator.mediaDevices.getUserMedia({
audio: { echoCancellation: true, noiseSuppression: true },
});
const ctx = new AudioContext();
// A tiny worklet that hands over each block of microphone samples.
const tapCode = `registerProcessor("tap", class extends AudioWorkletProcessor {
process([input]) { if (input[0]) this.port.postMessage(input[0].slice(0)); return true; }
});`;
await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([tapCode], { type: "text/javascript" })));
const tap = new AudioWorkletNode(ctx, "tap");
ctx.createMediaStreamSource(mic).connect(tap);
tap.connect(ctx.destination); // keeps the node running; it outputs silence
ws.onopen = () => ws.send(JSON.stringify({ type: "start", sampleRate: ctx.sampleRate, partials: true }));
let blocks = [], count = 0;
tap.port.onmessage = ({ data }) => {
if (ws.readyState !== WebSocket.OPEN) return;
blocks.push(data);
count += data.length;
if (count < ctx.sampleRate * 0.05) return; // send about every 50 ms
const pcm = new Int16Array(count);
let o = 0;
for (const b of blocks) for (const x of b) pcm[o++] = Math.max(-1, Math.min(1, x)) * 32767;
ws.send(pcm.buffer);
blocks = [];
count = 0;
};
ws.onmessage = (e) => {
const m = JSON.parse(e.data);
if (m.type === "partial") onPartial(m.text);
if (m.type === "final") onFinal(m.text);
if (m.type === "error") console.error(m.code, m.message);
};
return () => { // call to stop
ws.send(JSON.stringify({ type: "stop" }));
mic.getTracks().forEach((t) => t.stop());
ctx.close();
};
}
## 3 · Sözcükleri göstermek
partial her geldiğinde taslağı değiştirin, final geldiğinde satıra ekleyip taslağı temizleyin. partial metinler değişebilir; kalıcı olan yalnızca finaldır.
import { startCaptions } from "./captions.js";
const done = document.querySelector("#done");
const draft = document.querySelector("#draft");
let stop = null;
document.querySelector("#mic").onclick = async () => {
if (stop) { stop(); stop = null; return; }
stop = await startCaptions(
(text) => { draft.textContent = text; }, // still speaking
(text) => { done.append(text + " "); draft.textContent = ""; }, // after a pause
);
};
Gelen mesajlar
{"type":"ready","model":"duyu-1","quota":{"remaining_s":7130}}
{"type":"partial","text":"Bugünkü toplantıda"}
{"type":"partial","text":"Bugünkü toplantıda üç konuyu"}
{"type":"final","text":"Bugünkü toplantıda üç konuyu konuşacağız.","start":0.38,"end":2.91,"audio_s":2.53,"infer_ms":121,"rtf":0.05}
## İpuçları
- Tarayıcının echoCancellation ve noiseSuppression ayarlarını açık tutun; hoparlörden gelen ses altyazıya karışmaz.
- vad olaylarıyla bir ses seviyesi göstergesi çizebilirsiniz; ayrı bir VAD gerekmez. Bkz. Canlı akış.
- Bitirince stop gönderin: açık cümle bir final olarak kapanır, ardından stopped gelir. Faturalanan süre stopped.audio_s alanındadır.
