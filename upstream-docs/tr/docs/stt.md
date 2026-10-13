# Transkripsiyon
Bir ses dosyası gönderin, metni alın. OpenAI audio/transcriptions ile aynı sözleşme; mevcut Whisper istemciniz olduğu gibi çalışır.
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions Deneyin
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@kayit.m4a \
-F response_format=json
## Form alanları
multipart/form-data gönderin. wav, mp3, m4a, webm, ogg ve flac kabul edilir. 30 saniyeden uzun dosyalar otomatik olarak bölünür ve birleştirilir.
filefilezorunlu
Ses dosyası. En fazla 100 MB ve 2 saat.
modelstring
duyu-1. Uyumluluk için whisper-1 de kabul edilir.
Varsayılanduyu-1
language"tr" | "auto"
Konuşmanın dili.
Varsayılantr
promptstring
Yazım ve terim ipucu: ilaç adları, kişi adları, kimlik numaraları. Model bu yazımları tercih eder.
response_formatstring
json, text, verbose_json, srt, vtt. Bkz. Çıktı biçimleri.
Varsayılanjson
timestamp_granularities[]string[]
segment ve/veya word; yalnızca verbose_json ile.
temperaturenumber
0–1.
Varsayılan0
## Yanıt
{ "text": "Merhaba, ben Ayşe Yılmaz. Sipariş numaram CNB123." }
## Faturalandırma
Duyu ses saati başına faturalanır: dosyalar ₺6 · $0.125, canlı akış ₺11 · $0.225. Sayılan, sesin süresidir (verbose_json yanıtındaki duration; akışta stopped.audio_s), işlem süresi değil. Bkz. Fiyatlar.
