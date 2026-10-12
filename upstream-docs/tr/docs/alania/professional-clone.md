# Profesyonel klonBeta
1–5 dakikalık tek kişilik kayıttan yalnızca hesabınız için eğitilen bir ses. Anlık klona göre konuşana daha yakın ve cümleden cümleye daha tutarlıdır; genellikle 20–30 dakikada hazır olur. Beta süresince ücretsiz.
Profesyonel klonu Studio’daki Seslerim sayfasından başlatırsınız: ad ve izin, kayıtlar, canlı bir okuma, sonra eğitim. Hazır olduğunda ses, kayıtlı seslerinizin arasında “Profesyonel” etiketiyle görünür ve her kayıtlı ses gibi kimliğiyle kullanılır.
| Anlık klon | Profesyonel klon (beta) |
Kayıt | 3–30 saniye (en iyisi 20–30) | 1–5 dakika konuşma |
Hazır olma | Hemen | Genellikle 20–30 dakika |
Benzerlik | Kayda göre değişir | Konuşana daha yakın, daha tutarlı |
İzin | consent: true beyanı | Konuşmacının izni, ses karşılaştırmasına açık rıza ve canlı okuma |
Sınır | 50 kayıtlı ses | 2 profesyonel ses, aynı anda 1 eğitim |
## Kayıtlar
- Toplam 1–5 dakika konuşma. Studio sessizlikleri saymadan konuşma süresini gösterir; sunucu kayıtları temizledikten sonra yeniden ölçer ve karar onun ölçümüdür.
- Tek kişi. Bütün kayıtlarda aynı kişi konuşmalı; başka sesler, müzik ya da televizyon olmasın.
- Sessiz, yankısız bir oda; mikrofon ağza yaklaşık 20 cm. Studio her kayıt için gürültü, yankı, patlama ve kısıklık uyarısı verir; uyarı olan kaydı yenisiyle değiştirmek sonucu belirgin biçimde iyileştirir.
- Tarayıcıda kaydedebilir ya da dosya yükleyebilirsiniz (wav, mp3, m4a, webm, ogg, flac; her biri en fazla 100 MB); ikisini karıştırmak da olur. Okunacak metinler Studio’da hazırdır.
- 5 dakikadan uzun kayıtlarınız varsa ya da ekibimizin hazırladığı size özel bir ses istiyorsanız ücretli özel ses hizmetine bakın.
## Canlı doğrulama
Kimsenin sesi izni olmadan klonlanmasın diye, kayıtlar yüklendikten sonra ekranda rastgele bir Türkçe cümle çıkar ve kayıttaki kişi onu o an yüksek sesle okur (3–20 saniye). Cümle her seferinde yeniden seçilir, önceden kaydedilemez.
- Duyu okumayı hemen dinler. Söylenenler cümleyle eşleşmezse ne duyulduğu gösterilir ve yeni bir cümle verilir; en fazla 5 deneme hakkı vardır.
- Eğitimden önce, okumadaki sesin yüklenen kayıtlardakiyle aynı kişiye ait olduğu kontrol edilir. Değilse eğitim yapılmaz.
## Süre ve aşamalar
Eğitim doğrulamadan sonra kendiliğinden başlar ve genellikle 20–30 dakika sürer. Sayfadan ayrılabilirsiniz; Seslerim sayfasına döndüğünüzde durum oradadır.
status | Anlamı |
awaiting_upload | Eğitim oluşturuldu; kayıtlar bekleniyor. |
awaiting_verification | Kayıtlar alındı; canlı okuma bekleniyor. |
queued | Sırada. Eğitim sunucusu başlatılıyor; birkaç dakika sürebilir. |
preparing | Kayıtlar temizleniyor, cümlelere bölünüyor ve yazıya dökülüyor. |
training | Ses kayıtlarınızla eğitiliyor; en uzun aşama. |
evaluating | Ayrılan kayıtlar üzerinde anlık klonla karşılaştırılıyor. |
ready | Hazır: ses kayıtlı sesleriniz arasında (voice_id). |
rejected | Yayına alınmadı: anlık klondan daha iyi değildi ya da okuma kayıtlarla eşleşmedi. Neden error alanında. |
failed | Tamamlanamadı (ör. 5 doğrulama denemesi tükendi). Neden error alanında. |
canceled | İptal edildi. |
## Sınırlar
- Hesap başına en fazla 2 profesyonel ses. Yeni bir tane için birini silin.
- Aynı anda tek eğitim. Süren bir eğitimi iptal edebilir ya da bitmesini bekleyebilirsiniz.
- Beta süresince ücretsizdir. Profesyonel sesle konuşmak, her ses gibi karakter başına faturalanır.
## Gizlilik
- Kayıtlarınız, canlı okuma ve eğitilen ses AB’de (Hollanda, europe-west4) gizli depolamada tutulur; yalnızca hesabınız erişebilir.
- Ham kayıtlar eğitim bittikten 7 gün sonra silinir. Eğitimi iptal ettiğinizde ya da sildiğinizde hemen silinir.
- Eğitilen sesi istediğiniz an silebilirsiniz; Seslerim sayfasından ya da DELETE /v1/voices/{id} ile.
## API
Eğitimler hesabınıza aittir ve API anahtarınızla da görülebilir. Kayıtlar şimdilik yalnızca Studio’dan yüklenir (hesabınızın gizli deposuna); aşağıdaki yollar durumu izlemek ve eğitimleri yönetmek içindir.
Yol | Ne yapar |
POST /v1/voice-tunings | {"name", "consent": true, "biometric_consent": true} ile bir eğitim oluşturur; yükleme önekini döner. 409 tuning_limit_reached, 400 consent_required. |
POST /v1/voice-tunings/{id}/sources | {"paths": [...]}: yüklenen kayıtları ölçer (60–300 sn konuşma) ve okunacak cümleyi (challenge) verir. 400 source_too_short, source_too_long. |
POST /v1/voice-tunings/{id}/verify | Multipart file: canlı okuma (3–20 sn). Eşleşirse queued; eşleşmezse 400 verification_failed, duyulanla birlikte, ve yeni bir cümle. |
GET /v1/voice-tunings | Hesabın eğitimleri, {"object": "list", "data": [...]}. |
GET /v1/voice-tunings/{id} | Tek bir eğitim. |
DELETE /v1/voice-tunings/{id} | Süren eğitimi iptal eder ya da biteni kaldırır; kayıtlarını siler. Üretilen ses kalır. |
Hazır olduğunda voice_id ile konuşun: voice alanına bu kimliği yazmanız yeterli, istek değişmez. GET /v1/voices profesyonel sesleri "tuned": true ile listeler.
code | Anlamı |
account_required | Bir hesap gerekir; demo erişimiyle kullanılamaz (403). |
consent_required | consent: true ya da biometric_consent: true gönderilmedi. |
tuning_limit_reached | Hesapta 2 profesyonel ses var ya da bir eğitim zaten sürüyor (409). |
source_too_shortsource_too_long | Kayıtlarda 60 saniyeden az ya da 300 saniyeden fazla konuşma var. |
verification_failed | Okuma cümleyle eşleşmedi; yeni bir cümle verildi. |
curl
# your trainings
curl https://voice.patientdesk.ai/v1/voice-tunings -H "Authorization: Bearer pd_live_..."
# one training
curl https://voice.patientdesk.ai/v1/voice-tunings/{id} -H "Authorization: Bearer pd_live_..."
# cancel or remove it
curl -X DELETE https://voice.patientdesk.ai/v1/voice-tunings/{id} -H "Authorization: Bearer pd_live_..."
Eğitim nesnesi
{
"id": "7c1e0b52-3f4a-4d1e-9a51-2b8f6c0d9e11",
"object": "voice_tuning",
"name": "Sesim (profesyonel)",
"status": "ready",
"source_seconds": 212.4,
"speech_seconds": 188.1,
"challenge": null,
"verification": { "passed": true, "heard": "…" },
"metrics": {
"zero_shot": { "similarity": 0.64, "cer": 0.024 },
"tuned": { "similarity": 0.71, "cer": 0.019 }
},
"error": null,
"voice_id": "5b0f8a8e-1d2c-4f7a-8f3e-6a9b2c4d1e07",
"created_at": 1759651200,
"updated_at": 1759652940,
"finished_at": 1759652940
}
