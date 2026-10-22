# Twilio ile telefon hattı
Bir aramayı açın, arayanı Duyu ile canlı yazıya dökün ve Alania’nın sesiyle yanıt verin. Ses iki yönde de 8 kHz μ-law kalır; yeniden örnekleme yok.
## Nasıl çalışır
- Twilio aramayı açar ve arayanın sesini bir Media Stream WebSocket’iyle sunucunuza gönderir: 20 ms’lik, base64 kodlu 8 kHz μ-law parçalar.
- Sunucunuz μ-law’ı PCM16’ya çevirir ve Duyu’nun canlı akışına sampleRate: 8000 ile gönderir.
- Duyu bir cümle bittiğinde final gönderir. Ne yanıt verileceğine siz karar verirsiniz: kurallar, bir LLM ya da ikisi.
- Yanıt, ?encoding=mulaw ile açılmış Alania WebSocket’ine speak olarak gider. Gelen her ikili mesaj zaten 8 kHz μ-law’dır ve doğrudan Twilio’ya geri gönderilir.
## TwiML
Twilio numaranızın gelen arama ayarında bu TwiML’i döndürün. url, aşağıdaki köprünün herkese açık WSS adresidir.
XML
<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Connect>
<Stream url="wss://your-server.example.com/twilio" />
</Connect>
</Response>
## Köprü
Her arama iki bağlantı açar ve görüşme boyunca açık tutar: biri Duyu’ya (dinlemek), biri Alania’ya (konuşmak). answer() sizin ajanınızdır.
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
- Söz kesme. Arayan, Alania konuşurken söze girerse Duyu segment_start gönderir. Köprü Twilio’ya clear gönderip tampondaki sesi durdurur ve bir sonraki yanıta kadar kalan sesi atar.
- Sıra. Alania speak mesajlarını sırayla, birer birer işler. Bağlantı ready göndermeden gelen mesajlar kuyrukta bekler.
- Parça boyu. Twilio 20 ms gönderir; köprü 60 ms biriktirip öyle iletir (Duyu 40–100 ms’lik parçalar bekler).
## Gecikme
Adım | Süre | Ayar |
Cümle sonu | ~500 ms sessizlik | min_silence_ms bu süreyi değiştirir (200–2000 ms; bkz. Sıra alma). eager_final: true yaklaşık 120 ms öne alır (köprüde açık). |
Sizin ajanınız | size bağlı | LLM yanıtını cümle cümle akıtıp her cümleyi ayrı speak olarak gönderin. |
İlk ses | ~190 ms | μ-law dönüşümü sunucuda yapılır, süre eklemez. |
