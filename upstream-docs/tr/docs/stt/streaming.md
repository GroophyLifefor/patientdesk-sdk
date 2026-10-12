# Canlı akış
Mikrofondan ya da telefon hattından ham PCM gönderin; her cümle sessizlikten kısa süre sonra final olarak gelir.
WSSwss://voice.patientdesk.ai/v1/audio/stream Deneyin
WebSocket
const ws = new WebSocket("wss://voice.patientdesk.ai/v1/audio/stream?key=pd_live_...");
ws.onopen = () => ws.send(JSON.stringify({ type: "start", sampleRate: 48000 }));
// then: ws.send(int16PcmChunk.buffer) for every ~40 ms of microphone audio
ws.onmessage = (e) => {
const m = JSON.parse(e.data);
if (m.type === "final") console.log(m.start, m.end, m.text);
};
// when done: ws.send(JSON.stringify({ type: "stop" }))
## Protokol
- Bağlantıyı açın ve {"type":"start","sampleRate":16000} gönderin. İsteğe bağlı: partials: true, partial_ms, eager_final: true.
- Her 40–100 ms’de bir ham Int16 PCM parçası gönderin (ikili mesaj). Sunucu yeniden örnekler; 8 kHz telefon bandı desteklenir.
- Olayları JSON olarak okuyun. Bitirince {"type":"stop"} gönderin; açık cümle final olarak kapanır ve ardından stopped gelir.
## Olaylar
readyevent
model, quota.remaining_s. Bağlantı hazır.
vadevent
prob, active. Yaklaşık her 100 ms’de bir; active değişince hemen. Ses seviyesi göstergesi için kullanın.
segment_startevent
Konuşma başladı (start).
partialevent
Süren cümlenin taslağı; yalnızca partials: true ile, partial_ms aralıklarla.
segment_endevent
Konuşma bitti (end). Ardından final gelir.
finalevent
text, start, end, audio_s, infer_ms, rtf. Cümlenin kesin metni.
stoppedevent
Tüm cümleler çözüldü; audio_s faturalanan süredir.
errorevent
message, code.
Örnek olay akışı
{"type":"ready","model":"duyu-1","quota":{"remaining_s":7130}}
{"type":"vad","prob":0.91,"active":true}
{"type":"segment_start","start":0.42}
{"type":"partial","text":"Yarın saat"}
{"type":"partial","text":"Yarın saat on dörtteki"}
{"type":"segment_end","end":3.10}
{"type":"final","text":"Yarın saat on dörtteki randevumu on altıya alabilir miyiz?","start":0.42,"end":3.10,"audio_s":2.68,"infer_ms":118,"rtf":0.04}
{"type":"stopped","audio_s":2.68}
## Sıra alma
final, 500 ms sessizlikten sonra gelir. eager_final: true ile model, sessizlik eşiğini beklemeden cümleyi kesinleştirebilir; sesli asistanlarda yanıtı yaklaşık 120 ms öne alır. Harici bir VAD gerekmez: vad ve segment_* olayları modelin kendisinden gelir.
