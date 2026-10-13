Dokümantasyon
# Türkçe sesle geliştirin
İki Türkçe ses modeli, tek API anahtarı. Alania metni sese, Duyu sesi metne çevirir. İkisi de OpenAI istemcileriyle çalışır: base_url değiştirmek yeterli.
Hızlı başlangıçParametre referansı
İlk istek
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-f1",
"input": "Talebinizi ilgili ekibe aktardım, sonucu size kısa mesajla ileteceğiz." }' \
--output talep.wav
Sonuç: talep.wav
-
## Ürünler
Her ürünün rehberleri ve referansı.
Metinden sese
Alania
Yerleşik sesler, üslup talimatı, tarifle ses tasarımı, izinli klonlama. 48 kHz, üretildikçe akar.
- Genel bakış ve sesler
- Konuşma üslubuÖnizleme
- Ses tasarımıÖnizleme
- Ses klonlamaBeta
- Profesyonel klonBeta
- Söyleniş sözlüğü
- Akış
- Parametre referansı
- Alania-1’den geçiş
Sesten metne
Duyu
Dosya transkripsiyonu ve canlı akış. OpenAI Whisper istemcileriyle uyumlu; sözcük zamanları, SRT ve VTT.
- Transkripsiyon
- Canlı akış
- Çıktı biçimleri
## Modeller
model alanına yazdığınız kimlikler.
alania-v2VarsayılanMetinden sese. Yerleşik sesler, üslup, tasarım, klonlama.48 kHzantalia-miniÜcretsizAçık kaynak Antalia-2 Mini. Tek ses, kotadan düşmez.48 kHzalania-v1Eski sürümİlk Alania. Tek ses, ek alan yok.24 kHzduyu-1STTSesten metne: dosya ve canlı akış.REST · WebSocket
## Örnekler
Kopyalayıp çalıştırabileceğiniz uçtan uca projeler.
Web uygulamasında sesAnahtarınız sunucuda kalsın: küçük bir uç nokta isteği Alania’ya iletir ve sesi akış hâlinde geri verir; tarayıcı ilk parçayla çalmaya başlar.Twilio ile telefon hattıBir aramayı açın, arayanı Duyu ile canlı yazıya dökün ve Alania’nın sesiyle yanıt verin. Ses iki yönde de 8 kHz μ-law kalır; yeniden örnekleme yok.Tarayıcıda canlı altyazıMikrofonu Duyu’ya akıtın ve sözcükleri söylendikçe gösterin: konuşurken partial taslaklar, durunca kesinleşmiş bir final satırı.Uzun bir metni seslendirmekBir makaleyi ya da kitap bölümünü tek bir ses dosyasına çevirin: metni 5.000 karakterlik parçalara bölün, ham PCM isteyin ve tek bir WAV yazın.Videoya altyazıSes kanalını ffmpeg ile çıkarın, Duyu’dan srt isteyin ve altyazıyı videoya ekleyin.
## Temel adresler
Tüm istekler HTTPS ya da WSS üzerinden gider; hatalar OpenAI biçimindeki JSON ile döner.
Alania · REST
POSThttps://voice.patientdesk.ai/v1/audio/speech
Alania · WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/speech/stream
Duyu · REST
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions
Duyu · WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/stream
## Referans
- Kimlik doğrulamaHer istek panelden aldığınız anahtarı taşır. Aynı anahtar Alania’da ve Duyu’da geçerlidir. Tarayıcıdan açılan bağlantılar için kısa ömürlü tokenlar vardır.
- Parametre referansıPOST /v1/audio/speech gövdesindeki her alan, varsayılanı ve aralığıyla. JSON ya da multipart/form-data gönderebilirsiniz.
- Hatalar ve sınırlarHatalar OpenAI biçimindedir: error.message, error.type, error.code. Geçici hatalar Retry-After başlığıyla gelir.
- FiyatlarAlania karakter başına, Duyu ses saati başına faturalanır. Lansmana özel olarak ilk ay ücretsizdir; fiyatlara KDV dahil değildir.
- Servis durumuCanlı durum, 90 günlük erişilebilirlik, olay geçmişi.
