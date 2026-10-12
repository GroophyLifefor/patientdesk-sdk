# Çıktı biçimleri
Aynı çağrı, farklı response_format: dikte için düz metin, arşiv için sözcük zamanları, video için altyazı.
response_format | İçerik | Content-Type |
json | Yalnızca text. | application/json |
text | Düz metin, sonunda satır sonu. | text/plain |
verbose_json | text, language, duration, segments[], istenirse words[]. | application/json |
srt | SubRip altyazı. | text/plain |
vtt | WebVTT altyazı. | text/vtt |
## verbose_json
segments[]object[]
id, start, end, text. Cümle düzeyinde zamanlar.
words[]object[]
word, start, end, probability. timestamp_granularities[]=word ile.
durationnumber
Ses süresi, saniye. Faturalanan süre budur.
verbose_json
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@toplanti.mp3 \
-F response_format=verbose_json \
-F "timestamp_granularities[]=word"
{
"task": "transcribe", "language": "tr", "duration": 512.4,
"text": "Merhaba, ben Ayşe Yılmaz. Sipariş numaram CNB123...",
"segments": [{ "id": 0, "start": 0.0, "end": 4.2, "text": "Merhaba, ben Ayşe Yılmaz." }, ...],
"words": [{ "word": "Merhaba,", "start": 0.0, "end": 0.6, "probability": 0.98 }, ...]
}
## Altyazı
Altyazı satırları segment sınırlarını izler; en fazla 42 karakter ve 2 satır olacak biçimde bölünür.
srt
1
00:00:00,420 --> 00:00:03,100
Yarın saat on dörtteki randevumu on altıya alabilir miyiz?
2
00:00:03,600 --> 00:00:05,020
Tabii, hemen bakıyorum.
