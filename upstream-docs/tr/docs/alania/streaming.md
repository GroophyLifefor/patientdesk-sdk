# Akış
Metnin geri kalanı üretilirken çalmaya başlayın: HTTP’de stream: true ile, çok sayıda cümle için tek bir WebSocket bağlantısıyla.
## HTTP akışı
stream: true ile yanıt gövdesi 44 baytlık bir WAV başlığıyla başlar, ardından ses üretildikçe ham PCM16 gelir: little-endian, mono, Alania-2’de 48 kHz, Alania-1’de 24 kHz. Akışın uzunluğu önceden bilinmediği için başlıktaki uzunluk alanları 0xFFFFFFFF’tir.
- Akışta wav, pcm, mulaw ve alaw geçerlidir. pcm başlıksız ham örneklerdir; örnekleme hızı Content-Type: audio/L16; rate=48000 başlığındadır. Telefon hatları için bkz. Telefon (8 kHz).
- Ağ parçaları bir örneği ortadan bölebilir: tek kalan baytı bir sonraki parçaya ekleyin.
- Uzun metin cümle sınırlarından bölünür; parçalar arasında 250 ms sessizlik vardır.
- x-audio-seconds akışta gönderilmez: ses bitmeden bilinmez.
curl -N https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "voice": "alania2-f1", "input": "Randevunuz oluşturuldu.", "stream": true }' \
| ffplay -autoexit -nodisp - # 48 kHz PCM16 as it is generated
## Tarayıcıda 48 kHz çalma
HTTP akışı örneğinin Browser sekmesi her parçayı Web Audio ile sıraya koyar. Önemli noktalar:
- Tamponu doğru hızla oluşturun: createBuffer(1, n, 48000). Hızı WAV başlığının 24. baytından, WebSocket’te speech_start.sample_rate alanından okuyun; Alania-1 24 kHz’dir.
- new AudioContext({ sampleRate: 48000 }) gereksiz yeniden örneklemeyi önler; cihaz başka bir hızda çalışıyorsa tarayıcı dönüştürür.
- Her parçayı bir öncekinin bitişine planlayın; ilk parçaya 50 ms pay bırakmak takılmayı önler.
- Bir AudioContext yalnızca kullanıcı etkileşiminden sonra ses çalar; isteği bir tıklamayla başlatın.
## Gecikme
Alania-2’de akışlı bir istekte ilk ses yaklaşık 190 ms’de gelir (ortanca, genel API üzerinden, ağ süresi dahil ölçüldü). Sizin ölçtüğünüz süre ağınıza ve sunucuya uzaklığınıza göre değişir. x-queue-wait-ms başlığı, isteğin bir üretim yuvası beklediği süreyi ayrıca verir.
## WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/speech/stream
Arka arkaya çok sayıda cümle seslendiren bir uygulama (örneğin bir sesli asistan) için tek bağlantı kullanın. Her speak mesajı bir ses akışı döndürür ve bağlantı açık kalır. Kimlik doğrulama için ?key= ya da ?token= kullanın; ?model=alania-v1 bağlantının varsayılan modelini Alania-1 yapar. Bir telefon hattı için ?encoding=mulaw (ya da alaw) sesi 8 kHz G.711 olarak gönderir; ?sample_rate=16000 gibi başka bir hız da seçebilirsiniz.
WebSocket
const ws = new WebSocket("wss://voice.patientdesk.ai/v1/audio/speech/stream?key=pd_live_...");
ws.binaryType = "arraybuffer";
let rate = 48000;
ws.onmessage = (e) => {
if (e.data instanceof ArrayBuffer) return play(new Int16Array(e.data), rate); // PCM16 mono
const m = JSON.parse(e.data);
if (m.type === "ready") ws.send(JSON.stringify({
type: "speak",
model: "alania-v2",
voice: "alania2-f1",
input: "Randevunuz yarın saat 14:05 için oluşturuldu.",
}));
if (m.type === "speech_start") rate = m.sample_rate; // 48000 (24000 for alania-v1)
if (m.type === "speech_end") ws.send(JSON.stringify({ type: "stop" }));
if (m.type === "error") console.error(m.code, m.message);
};
### Gönderdiğiniz mesajlar
speakJSON
input zorunlu. HTTP gövdesindeki alanların hepsi geçerlidir: model, voice, instructions, voice_description, reference_audio (base64), reference_text, consent, cfg, temperature, seed, sample_rate; ayrıca encoding (pcm_s16le, mulaw, alaw) bağlantının çıktı ayarını bu mesaj için değiştirir. Mesajlar sırayla, birer birer işlenir; yalnızca cancel beklemeden etki eder.
cancelJSON
Süren speak’i hemen durdurur: ses kesilir, speech_end "canceled": true ile gelir ve bağlantı açık kalır; kuyruktaki bir sonraki speak sırası gelince başlar. Her cancel, bitmemiş en eski speak’i durdurur; bekleyen her speak için bir cancel hepsini susturur. Bekleyen speak yoksa bir şey yapmaz. Bkz. Söz kesme.
stopJSON
stopped döner ve bağlantı kapanır. close de aynı işi görür.
### Aldığınız mesajlar
readyJSON
model, voice, sample_rate, encoding, models, usage. Bağlantı hazır; usage kalan kotanızdır.
speech_startJSON
characters, model, voice, sample_rate, encoding (pcm_s16le, mulaw ya da alaw), disclosure. Her speak için ses başlamadan önce gelir.
ikiliPCM16 · G.711
Ses, mono: PCM16 ya da encoding mulaw/alaw ise örnek başına bir bayt. Alania-2’de mesajlar genellikle 0,16 saniyedir (48 kHz’de 7.680 örnek); son parça daha kısa olabilir.
speech_endJSON
audio_s, infer_ms; bir cancel durdurduysa canceled: true. Bu speak bitti.
stoppedJSON
stop mesajına yanıt.
errorJSON
message, code, category, retry_after. Bilinmeyen mesaj türünden sonra bağlantı açık kalır; diğer hatalardan sonra kapanır.
Örnek mesaj akışı
{"type":"ready","model":"alania-v2","voice":"alania2-f1","sample_rate":48000,"encoding":"pcm_s16le","models":["alania-v1","alania-v2"],"usage":{"unit":"characters","used":1204,"quota":100000,"remaining":98796,"free":true,"free_until":null}}
{"type":"speech_start","characters":45,"model":"alania-v2","voice":"alania2-f1","sample_rate":48000,"encoding":"pcm_s16le","disclosure":"ai-generated"}
<binary PCM16 frames, 0.16 s each>
{"type":"speech_end","audio_s":3.2,"infer_ms":…}
{"type":"stopped"}
Hata mesajı
{"type":"error","message":"Cloning a voice needs `consent: true`: …","code":"consent_required","category":"invalid_request_error","retry_after":0}
### Söz kesme
- Arayan, ajan konuşurken söze girerse gönderdiğiniz ve speech_end’i henüz gelmemiş her speak için bir {"type":"cancel"} gönderin ve tamponda bekleyen sesi çalmayı bırakın. cancel’dan önce yola çıkmış ses yine de gelebilir; bir sonraki speech_start’a kadar gelen ikili mesajları atın.
- Bir speak, speech_start gönderildiği anda ücretlenir: cancel ya da kapanan bağlantı onu yarıda kesse de input alanının tüm karakterleri sayılır. speech_start’ı gelmeden iptal edilen (örneğin kuyrukta bekleyen) bir speak yalnızca bir speech_end (audio_s: 0, canceled: true) alır ve ücretlenmez.
- Bağlantıyı kapatmak da süren speak’i durdurur, ama bir sonraki yanıt için yeni bir bağlantı açmak gerekir. cancel bağlantıyı açık tutar.
## Sıkıştırılmış biçimler
Akışsız isteklerde response_format mp3, opus (Ogg), flac ya da aac olabilir; mobil uygulamalarda bant genişliğini azaltır. Bunlar akışta kullanılamaz: yarım kalmış bir kap dosyası çalınamaz, bu yüzden 400 döner.
## Telefon (8 kHz)
Telefon hattı 8 kHz G.711 taşır. response_format: "mulaw" (μ-law, Kuzey Amerika ve Japonya) ya da "alaw" (A-law, Türkiye ve Avrupa) sesi doğrudan bu biçimde, başlıksız, örnek başına bir bayt olarak verir; yeniden örneklemeniz gerekmez. Akışta ve WebSocket’te de çalışır.
- sample_rate başka bir hız seçer: 8000, 16000, 22050, 24000, 44100 ya da 48000 (modelin kendi hızına kadar). G.711’de varsayılan 8000, diğerlerinde modelin hızıdır. Örneğin "response_format": "pcm", "sample_rate": 16000 16 kHz PCM16 verir.
- Dönüştürme sunucuda, ses üretilirken yapılır; ilk sese süre eklemez. 8 kHz μ-law, 48 kHz PCM16’ya göre 12 kat daha az veridir.
- Content-Type biçimi ve hızı söyler: audio/PCMU; rate=8000, audio/PCMA; rate=8000, audio/L16; rate=16000.
