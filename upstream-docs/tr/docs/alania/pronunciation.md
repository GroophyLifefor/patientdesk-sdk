# Söyleniş sözlüğü
Alania Türkçe yazımı okur. Marka adlarının ve yabancı kelimelerin nasıl okunacağını bir kez hesabınıza kaydedin ya da tek bir istekte pronunciations alanıyla verin.
Alania-2 metni Türkçe yazıldığı gibi okur. Bu yüzden İngilizce kelimeler ve marka adları seslendirilmeden önce Türkçe okunuşlarıyla yeniden yazılır: PatientDesk “Peyşınt Desk”, ChatGPT “Çet Ci Pi Ti” olur. Yaygın adlar için gözden geçirilmiş bir liste ve otomatik bir dönüştürücü sunucuda zaten çalışır. Kliniğinizin adı, doktor adları ya da ilaç markaları gibi size özel kelimeleri söyleniş sözlüğüne siz eklersiniz.
term | say_as |
PatientDesk | Peyşınt Desk |
Ozempic | Ozempik |
Mayo Clinic | Meyo Klinik |
## Eşleştirme
- Yalnızca bütün kelimeler eşleşir: Desk için bir kayıt Desktop kelimesini değiştirmez.
- Büyük-küçük harf fark etmez: PatientDesk, patientdesk ve PATIENTDESK aynı kayda uyar.
- Birden çok kelimelik yazılışlar olur: Mayo Clinic → Meyo Klinik.
- Kesme işaretinden sonraki Türkçe ekler korunur: PatientDesk'e → Peyşınt Desk'e, PatientDesk'in → Peyşınt Desk'in.
- Okunuşu yazılışla aynı olan bir kayıt “yazıldığı gibi oku, değiştirme” demektir. Otomatik dönüştürücünün yabancı sandığı bir kelimeyi olduğu gibi okutmak için kullanın.
## Öncelik sırası
Bir kelime birden çok yerde geçiyorsa ilk sıradaki kazanır:
- İstekteki pronunciations alanı.
- Hesabınıza kayıtlı söyleniş sözlüğü.
- Sunucudaki gözden geçirilmiş yerleşik liste.
- Otomatik dönüştürücü.
## Hesaba kayıtlı sözlük
Kayıtlı sözlük bu hesabın her konuşma isteğine kendiliğinden uygulanır: API anahtarlarıyla gelenlere de Studio’dan gelenlere de. İsteklerinize bir şey eklemeniz gerekmez.
### Listelemek
GEThttps://voice.patientdesk.ai/v1/pronunciations
created_at Unix zamanıdır (saniye).
Yanıt
{
"object": "list",
"data": [
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "term": "PatientDesk", "say_as": "Peyşınt Desk", "created_at": 1759654800 },
{ "id": "7e0a3c51-2f64-4b8d-a1c9-5d2e8f4b6a03", "object": "pronunciation", "term": "Ozempic", "say_as": "Ozempik", "created_at": 1759651200 }
]
}
### Eklemek ya da değiştirmek
POSThttps://voice.patientdesk.ai/v1/pronunciations
termstringzorunlu
Metinde geçtiği biçimiyle kelime ya da kelimeler, 1–100 karakter.
say_asstringzorunlu
Nasıl okunacağı, Türkçe harflerle, 1–200 karakter. term ile aynıysa kelime yazıldığı gibi okunur.
Yeni bir kelime 201 Created döner. Aynı kelime (büyük-küçük harf gözetmeden) zaten kayıtlıysa okunuşu güncellenir ve 200 OK döner; yinelenen kayıt oluşmaz.
Yanıt
HTTP/1.1 201 Created
content-type: application/json
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "term": "PatientDesk", "say_as": "Peyşınt Desk", "created_at": 1759654800 }
### Silmek
DELETEhttps://voice.patientdesk.ai/v1/pronunciations/{id}
Yanıt
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "deleted": true }
### Örnekler
# your saved list
curl https://voice.patientdesk.ai/v1/pronunciations -H "Authorization: Bearer pd_live_..."
# add a word, or change how a saved one is said
curl https://voice.patientdesk.ai/v1/pronunciations \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "term": "PatientDesk", "say_as": "Peyşınt Desk" }'
# delete one by its id
curl -X DELETE https://voice.patientdesk.ai/v1/pronunciations/b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b -H "Authorization: Bearer pd_live_..."
## Tek istekte
Bir isteğe özel kelimeler için POST /v1/audio/speech gövdesine pronunciations ekleyin. Kelimeler yalnızca o istekte geçerlidir ve kayıtlı sözlükteki aynı kelimelerin önüne geçer. Nesne ({"yazılış": "okunuş"}) ya da {term, say_as} dizisi olarak gönderebilirsiniz.
Geliştirici panelindeki API konsolunda isteğe pronunciations ekleyip sonucu hemen dinleyebilirsiniz.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
--output hosgeldiniz.wav \
--data-binary @- <<'JSON'
{
"model": "alania-v2",
"voice": "alania2-f1",
"input": "PatientDesk'e hoş geldiniz. Ozempic kullanıyorsanız lütfen belirtin.",
"pronunciations": { "PatientDesk": "Peyşınt Desk", "Ozempic": "Ozempik" }
}
JSON
Dizi biçimi
"pronunciations": [
{ "term": "PatientDesk", "say_as": "Peyşınt Desk" },
{ "term": "Ozempic", "say_as": "Ozempik" }
]
## Sınırlar
Ne | Sınır |
pronunciations | İstek başına en fazla 200 kayıt |
term | 1–100 karakter |
say_as | 1–200 karakter |
kayıtlı sözlük | Hesap başına en fazla 500 kelime; her kelime bir kez (büyük-küçük harf gözetmeden) |
## Hatalar
Durum | code | Anlamı |
400 | invalid_pronunciations | pronunciations ya da POST /v1/pronunciations gövdesi geçersiz: biçim yanlış, term veya say_as boş ya da çok uzun, 200’den çok kayıt. |
403 | account_required | Sözlüğü yönetmek bir hesap ister; demo oturumu kelime kaydedemez. Demo istekleri pronunciations alanını yine de gönderebilir. |
404 | unknown_pronunciation | /v1/pronunciations/{id} içindeki kimlikle bir kayıt yok: silinmiş ya da başka bir hesaba ait. |
409 | pronunciation_limit_reached | Hesapta zaten 500 kelime var. Yenisini eklemek için birini silin. |
503 | pronunciation_store_unavailable | Sözlük geçici olarak okunamıyor ya da yazılamıyor; biraz sonra tekrar deneyin. |
