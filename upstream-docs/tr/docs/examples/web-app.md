# Web uygulamasında ses
Anahtarınız sunucuda kalsın: küçük bir uç nokta isteği Alania’ya iletir ve sesi akış hâlinde geri verir; tarayıcı ilk parçayla çalmaya başlar.
- Sunucunuzda /api/speak adında bir uç nokta açın. İsteği stream: true ile Alania’ya iletir ve yanıtı olduğu gibi geri akıtır.
- Tarayıcıda speak(text) gelen WAV başlığını okur, ardından her PCM parçasını Web Audio ile sıraya koyar.
- Bir butona bağlayın. İlk ses, istek gönderildikten yaklaşık 190 ms sonra gelir (ağınıza göre değişir).
## 1 · Sunucu uç noktası
Anahtar PATIENTDESK_API_KEY ortam değişkeninde durur ve tarayıcıya hiç gitmez. Uç nokta yanıtı tamponlamadan geçirir; bu yüzden ses, cümlenin geri kalanı üretilirken tarayıcıya ulaşır.
Sunucu
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
## 2 · Tarayıcıda çalmak
Yanıt 44 baytlık bir WAV başlığıyla başlar; örnekleme hızı başlığın 24. baytındadır (Alania-2’de 48.000). Sonrası ham PCM16’dır. Ağ parçaları bir örneği ortadan bölebilir, bu yüzden tek kalan bayt bir sonraki parçaya taşınır.
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
## 3 · Bir butona bağlamak
Tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra çalar; speak çağrısını bir tıklamadan başlatın.
React
import { speak } from "./speak";
export function ListenButton() {
return (
<button onClick={() => speak("Randevunuz yarın saat 14:05 için oluşturuldu.")}>
Dinle
</button>
);
}
## Üretimde
- Aynı cümleleri tekrar tekrar seslendiriyorsanız (karşılama, menü), seed ile üretip dosyayı önbelleğe alın: aynı seed, metin ve ayarlar aynı sesi verir.
- Marka ve kişi adları için söyleniş sözlüğünü kullanın; uç noktanıza dokunmanız gerekmez.
- Bir sesli asistan çok sayıda cümleyi arka arkaya söylüyorsa sunucudan tek bir WebSocket bağlantısı kullanmak daha verimlidir.
- Dinleyicilere sesin yapay zekâyla üretildiğini belirtin; her yanıt x-disclosure: ai-generated başlığını taşır.
