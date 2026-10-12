# Ses klonlamaBeta
3–30 saniyelik bir kayıttan bir ses oluşturun: bir kez kaydedip kimliğiyle kullanın ya da kaydı her istekle gönderin. Alania-2 metni o sesle okur. Ses yalnızca kayıttan alınır; kaydın metni gerekmez. Konuşanın rızası consent: true ile beyan edilir.
## Kaydedilmiş sesler
Aynı sesi sık kullanıyorsanız bir kez kaydedin. Kayıt ve rıza beyanı hesabınızda saklanır; sonraki isteklerde yalnızca sesin kimliğini gönderirsiniz. İstek küçülür ve daha çabuk başlar.
### Ses oluşturmak
POSThttps://voice.patientdesk.ai/v1/voices
filefilezorunlu
Ses kaydı: 3 ile 30 saniye arası (en iyisi 20–30), en fazla 10 MB. WAV, MP3, M4A, FLAC, OGG gibi yaygın biçimler kabul edilir.
namestringzorunlu
Sesin adı, en fazla 80 karakter. Listelerde görünür; benzersiz olması gerekmez.
transcriptstring
Kayıtta söylenenlerin metni, en fazla 1.000 karakter. İsteğe bağlıdır ve sesle birlikte saklanır; klon yalnızca kayıttan yapılır, metin sonucu değiştirmez. Verirseniz kayda uyup uymadığı denetlenir (transcript_mismatch).
consentbooleanzorunlu
true olmalı: kayıttaki kişinin sesinin bu şekilde kullanılmasına izin verdiğini beyan eder.
warnings kaydın klon için ne kadar uygun olduğunu söyler: background (konuşmanın altında gürültü, uğultu ya da müzik), echo (oda yankısı), clipping (patlayan ses), transcript_mismatch (metin kayda uymuyor). Ses yine de kaydedilir, ama uyarı varsa daha temiz bir kayıtla yeniden oluşturmak sonucu belirgin biçimde iyileştirir. quality bu kararların dayandığı ölçümlerdir. Neredeyse hiç konuşma içermeyen bir kayıt invalid_reference ile reddedilir.
curl https://voice.patientdesk.ai/v1/voices \
-H "Authorization: Bearer pd_live_..." \
-F name="Sesim" \
-F file=@ornek.wav \
-F transcript="Kayıtta söylenen cümlenin tam metni." \
-F consent=true
Yanıt
HTTP/1.1 201 Created
content-type: application/json
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"object": "voice",
"name": "Sesim",
"transcript": "Kayıtta söylenen cümlenin tam metni.",
"duration_s": 21.4,
"created_at": 1759651200,
"kind": "custom",
"tuned": false,
"source": "clone",
"warnings": [],
"quality": { "speech_s": 16.8, "snr_db": 41.2, "echo_t20_s": 0.07, "clipped": 0.0, "chars_per_s": 13.9 }
}
### Kayıtlı sesle konuşmak
voice alanına sesin kimliğini yazın. reference_audio ve consent gerekmez: sunucu kayıtlı klibi ve rıza beyanını kullanır. instructions bu seslerle de çalışır.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"input": "Bu ses, konuşanın izniyle kaydedilen kısa bir örnekten üretildi." }' \
--output klon.wav
### Listelemek ve silmek
GEThttps://voice.patientdesk.ai/v1/voices
DELETEhttps://voice.patientdesk.ai/v1/voices/{id}
GET /v1/voices yerleşik seslerle birlikte hesabınızın seslerini döner; kaydettikleriniz kind: "custom" taşır. Silinen bir sesin kimliğiyle gelen istekler unknown_voice alır.
# built-in voices and your saved ones
curl https://voice.patientdesk.ai/v1/voices -H "Authorization: Bearer pd_live_..."
# delete a saved voice
curl -X DELETE https://voice.patientdesk.ai/v1/voices/6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14 -H "Authorization: Bearer pd_live_..."
Yanıtlar
{
"object": "list",
"data": [
{
"id": "alania2-f1", "name": "Alania F1", "gender": "female", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": true,
"f0_band_hz": [199.5538, 238.605]
},
…,
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14", "object": "voice", "name": "Sesim",
"transcript": "Kayıtta söylenen cümlenin tam metni.", "duration_s": 21.4,
"created_at": 1759651200, "kind": "custom", "tuned": false, "source": "clone"
}
]
}
## Kaydı istekle göndermek
Sesi kaydetmeden, her istekte kaydın kendisini de gönderebilirsiniz. Tek seferlik işler için uygundur.
curl dosyayı multipart/form-data ile gönderir. JSON gövdesinde reference_audio base64 olarak ya da data:audio/wav;base64,… biçiminde bir data URI olarak verilir.
reference_audiofile | base64zorunlu
3 ile 30 saniye arası (en iyisi 20–30), en fazla 10 MB. WAV, MP3, M4A, FLAC, OGG gibi yaygın biçimler kabul edilir.
reference_textstring
Kayıtta söylenenlerin metni, en fazla 1.000 karakter. İsteğe bağlıdır ve kullanılmaz: klon yalnızca kayıttan yapılır. Eski istemciler bozulmasın diye kabul edilir.
consentbooleanzorunlu
true olmalı: kayıttaki kişinin sesinin bu şekilde kullanılmasına izin verdiğini beyan eder.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-F model=alania-v2 \
-F input="Bu ses, konuşanın izniyle kaydedilen kısa bir örnekten üretildi." \
-F reference_audio=@ornek.wav \
-F reference_text="Kayıtta söylenen cümlenin tam metni." \
-F consent=true \
--output klon.wav
## İyi bir kayıt
Klonun ne kadar benzeyeceğini en çok kayıt belirler. Birkaç dakikalık özen, sonucu belirgin biçimde iyileştirir.
- Tek kişi konuşsun. Müzik, televizyon ya da arkada konuşan biri olmasın.
- Sessiz bir odada, telefonu ya da mikrofonu ağzınıza yaklaşık 20 cm yakın tutun ve her zamanki gibi konuşun; bağırmayın, fısıldamayın. Halılı, perdeli bir oda yankıyı azaltır.
- 20–30 saniyelik net, kesintisiz konuşma en iyisidir. Daha kısa bir kayıt sesi daha az taklit eder; daha uzunu daha iyi değildir ve 30 saniyenin üstü kullanılmaz. Uzun aralar ve sessizlik işe yaramaz.
- Ses seviyesi patlamasın: kayıtta cızırtı ya da bozulma varsa mikrofondan biraz uzaklaşın.
- Kaydın metnini yazmanız gerekmez: klon yalnızca sesten yapılır. Uzun bir kayıt yüklerseniz Studio en temiz 20 saniyeyi seçer ve kaydetmeden önce gürültü, yankı ve patlama olup olmadığını söyler.
- Studio kaydı kaydetmeden önce temizler: düşük frekanslı uğultuyu süzer, baştaki ve sondaki sessizliği kırpar, konuşmanın ses seviyesini eşitler. API’ye kendi kaydınızı gönderiyorsanız aynısını yapmak sonucu iyileştirir.
## Klonlanan sesle üslup
instructions klonlanan sesle de çalışır. voice_description ile birlikte gönderilemez (conflicting_fields). Kayıt istekle gönderildiğinde voice yok sayılır.
## Hatalar
code | Anlamı |
consent_required | consent: true gönderilmedi. |
reference_too_shortreference_too_long | Kayıt 3 saniyeden kısa ya da 30 saniyeden uzun. |
reference_too_large | Kayıt 10 MB’tan büyük. |
invalid_reference | Geçerli base64 değil ya da ses olarak çözülemedi. |
invalid_request | reference_audio olmadan reference_text gönderildi ya da metin 1.000 karakteri aşıyor. |
voice_limit_reached | Hesapta zaten 50 kayıtlı ses var. Yeni ses için birini silin. |
unknown_voice | Bu kimlikle kayıtlı bir ses yok: silinmiş ya da başka bir hesaba ait. |
## Profesyonel klon (beta)
1–5 dakikalık kaydınız varsa Studio’da kendi profesyonel klonunuzu eğitebilirsiniz: yalnızca hesabınız için eğitilir, genellikle 20–30 dakikada hazır olur ve beta süresince ücretsizdir. Bkz. Profesyonel klon.
## Özel ses (kurumsal)Ücretli
Anlık klonlama yarım dakikalık bir kayıttan çalışır. Daha yakın ve her cümlede aynı kalan bir ses gerekiyorsa, ekibimiz 5–30 dakikalık temiz kayıtlarınızdan yalnızca sizin için bir ses eğitir. Bu ücretli bir hizmettir ve fiyatı ses başınadır.
- Konuşana anlık klonlamadan daha yakın ve daha tutarlıdır.
- Konuşan kişinin izni ayrıca doğrulanır.
- Hazır olduğunda hesabınızda bir ses olarak görünür ve kimliğiyle kullanılır.
Bize ulaşınya da yazın:
