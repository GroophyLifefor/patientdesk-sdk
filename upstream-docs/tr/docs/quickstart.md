# Hızlı başlangıç
Birkaç dakikada ilk sesi üretin ve ilk kaydı yazıya dökün.
- Panelden bir API anahtarı oluşturun. Anahtar yalnızca bir kez gösterilir; güvenli bir yerde saklayın.
- Alania’ya bir cümle gönderin; yanıt bir WAV dosyasıdır.
- Bir kaydı Duyu’ya gönderin; metni geri alın.
## 1 · Seslendirin
POSThttps://voice.patientdesk.ai/v1/audio/speech Deneyin
model alanını yazmazsanız istek Alania-2’ye gider ve alania2-f1 sesiyle konuşur. Yanıt 48 kHz mono bir WAV dosyasıdır. Python örneği OpenAI SDK’sını kullanır; base_url değiştirmek yeterlidir.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania2-f1" }' \
--output merhaba.wav # audio/wav, 48 kHz mono
### Alania-1 ile
Eski model alania-v1 olarak çalışmaya devam ediyor: 24 kHz, tek ses (alania), üslup, tasarım ve klonlama alanları yok.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v1", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania" }' \
--output merhaba-v1.wav # audio/wav, 24 kHz mono
### Antalia-2 Mini ile (ücretsiz)
model: "antalia-mini" açık kaynak modelimiz Antalia-2 Mini’yi (7,6 milyon parametre) kullanır: 48 kHz, tek erkek sesi (antalia-mini), alan olarak yalnızca seed ve pronunciations. Ücretsizdir: kotanızdan düşmez ve kotanız dolsa bile çalışır (x-characters: 0). Kötüye kullanımı önlemek için kendi sınırları vardır: hesap ya da anahtar başına dakikada 60, günde 5.000 istek; aşılırsa 429 free_limit_exceeded. Aynı modeli pip install antalia-mini ile kendi sunucunuzda ya da tarayıcıda da çalıştırabilirsiniz.
## 2 · Yazıya dökün
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions Deneyin
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@kayit.m4a \
-F response_format=json
Yanıt
{ "text": "Randevunuz yarın saat 14:05 için oluşturuldu." }
## Sonra
Ya da baştan sona çalışan bir projeyle başlayın: web uygulaması, telefon hattı, canlı altyazı.
AlaniaSes seçmenin dört yoluYerleşik ses, üslup talimatı, tarifle tasarım, klonlama.AlaniaAkışSes üretilirken çalmaya başlayın: HTTP ya da WebSocket.DuyuCanlı akışMikrofondan WebSocket ile: partial taslaklar, sessizlikten sonra final.
