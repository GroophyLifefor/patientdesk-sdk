# Alania: genel bakış
Alania Türkçe metni sese çevirir. Alania-2 varsayılan modeldir: 11 yerleşik ses, nasıl konuşacağını söyleyen kısa talimatlar, tarifle ya da kayıttan yeni sesler ve 48 kHz ses.
POSThttps://voice.patientdesk.ai/v1/audio/speech Deneyin
Gövde OpenAI audio/speech ile aynıdır; mevcut OpenAI istemciniz base_url değiştirilerek çalışır. Alania-2’nin ek alanları aynı gövdeye eklenir. Tüm alanlar için parametre referansına bakın.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania2-f1" }' \
--output merhaba.wav # audio/wav, 48 kHz mono
## Ses seçmenin dört yolu
Yol | Alanlar | Ayrıntı |
Yerleşik ses | voice | Aşağıdaki seslerden biri. Her istekte aynı tını. |
Üslup talimatı (önizleme) | voice + instructions ya da hazır style | Konuşma üslubu: yavaş, sakin, fısıltıyla… ya da çağrı merkezi için hazır stiller. |
Ses tasarımı (önizleme) | voice_description | Ses tasarımı: sözle tarif edilen yeni bir ses; beğendiğinizi kaydedip kimliğiyle kullanabilirsiniz. |
Ses klonlama (beta) | reference_audio + consent ya da kayıtlı sesin kimliğiyle voice | Ses klonlama: 3–30 saniyelik (en iyisi 20–30) izinli bir kayıttan, her istekte ya da bir kez kaydedip kimliğiyle. |
Fiyat dört yolda da aynıdır: input alanındaki karakter başına.
## Sesler
voice | Ses | Not |
alania2-f1 | Kadın | Alania-2’nin varsayılan sesi. |
alania2-nisa | Kadın, yumuşak ve neşeli | |
alania2-oncel | Erkek, olgun ve güven veren | Varsayılan erkek ses. |
alania2-m1 | Erkek | |
alania2-emre | Erkek, yumuşak ve düşünceli | |
alania2-fikri | Erkek, net ve nazik | |
alania2-sezgin | Erkek, sakin ve buğulu | |
alania2-selin | Kadın, rahat ve samimi | |
alania2-lina | Kadın, sıcak ve sakin | |
alania2-melisa | Kadın, parlak ve enerjik | |
alania2-nil | Kadın, sıcak ve coşkulu | |
alania | Erkek · Alania-1 | Yalnızca model: "alania-v1" ile. Kimliği alania-v1. |
antalia-mini | Erkek · Antalia-2 Mini | Ücretsiz model. model: "antalia-mini" ile ya da model belirtmeden bu sesle. |
alania2-m2 ve alania2-f2 12 Ekim 2026’da kaldırıldı; bu adlarla gelen istekler 400 unknown_voice alır.
Adlı dokuz ses de (alania2-nisa, alania2-oncel, alania2-emre, alania2-fikri, alania2-sezgin, alania2-selin, alania2-lina, alania2-melisa, alania2-nil) f1 ve m1 gibi tasarlanmış seslerdir: seslendirme sanatçıları kaydetmedi; aday sesler tasarladık, bunları kör dinlemeyle seçip adlandırdık. Her biri kendi sabit referansından konuşur, her istekte aynı tınıyla. voice alanına kimliğini ya da adını yazın ("nisa"; Öncel için "öncel" ya da "oncel"). Modele eğitilmedikleri için bir konuşma üslubuyla (instructions ya da style) f1 ve m1’e göre kendi tınılarından biraz daha fazla uzaklaşırlar.
GEThttps://voice.patientdesk.ai/v1/voices
Liste yerleşik sesleri ve hesabınıza kaydettiğiniz sesleri (kind: "custom"; source değeri "clone" ya da "design") içerir; bkz. Kaydedilmiş sesler. Tasarlanan bir ses kaydedildiğinde listelenir; istekle gönderilen kayıtlar kaydedilmez, listelenmez.
Sesleri dinleyin
-
-
Dokuz ses daha
“Merhaba, ben sizin dijital asistanınızım. Size bugün nasıl yardımcı olabilirim?”
-
-
-
-
-
-
-
-
-
Yanıt
{
"object": "list",
"data": [
{
"id": "alania-v1", "name": "Alania", "gender": "male", "language": "tr-TR",
"model": "alania-v1", "sample_rate": 24000, "default": false,
"f0_band_hz": [125.1, 137.5], "kind": "builtin", "tuned": false, "beta": false
},
{
"id": "alania2-f1", "name": "Alania F1", "gender": "female", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": true,
"f0_band_hz": [199.5538, 238.605], "kind": "builtin", "tuned": false, "beta": false
},
{
"id": "alania2-nisa", "name": "Nisa", "gender": "female", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": false,
"f0_band_hz": [218.49, 279.76], "kind": "builtin", "tuned": false, "beta": false
},
{
"id": "alania2-oncel", "name": "Öncel", "gender": "male", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": false,
"f0_band_hz": [128.99, 167.0], "kind": "builtin", "tuned": false, "beta": false
},
…
]
}
## Modeller
GEThttps://voice.patientdesk.ai/v1/alania/models
Aynı alan adı iki ürüne de hizmet verdiği için, iki tarafta da bulunan uç noktalar Alania tarafında /alania ile adlandırılır: /v1/alania/models, /v1/alania/usage, /health/alania. Ses uç noktaları ve /v1/voices olduğu gibi kalır.
Yanıt
{
"object": "list",
"data": [
{ "id": "alania-v1", "object": "model", "owned_by": "patientdesk-ai",
"default": false, "legacy": true, "free": false, "sample_rate": 24000, "status": "ok" },
{ "id": "alania-v2", "object": "model", "owned_by": "patientdesk-ai",
"default": true, "legacy": false, "free": false, "sample_rate": 48000, "status": "ok" },
{ "id": "antalia-mini", "object": "model", "owned_by": "patientdesk-ai",
"default": false, "legacy": false, "free": true, "sample_rate": 48000, "status": "ok" }
]
}
## Yanıt
Her yanıt x-disclosure: ai-generated başlığını taşır. Sesin yapay zekâyla üretildiğini dinleyicilerinize belirtmek sizin sorumluluğunuzdadır. Tüm başlıklar parametre referansında.
HTTP
HTTP/1.1 200 OK
content-type: audio/wav
x-request-id: 3f9c2b1e7a…
x-model: alania-v2
x-model-release: alania-v2.1
x-disclosure: ai-generated
x-characters: 45
x-audio-seconds: 3.18
x-queue-wait-ms: 0
<RIFF header, then PCM16 48 kHz mono>
## Ölçümler
Ölçüm | Değer | Koşullar |
İlk ses | ~190 ms | Akışlı istekten ilk ses parçasına, ortanca; genel API üzerinden, ağ süresi dahil ölçüldü. |
Karakter hata oranı · alania2-f1 | %2,7 | 292 cümlelik Türkçe test setimiz; üretilen ses Whisper ile yazıya döküldü. |
Karakter hata oranı · alania2-m1 | %2,8 | Aynı test seti ve yöntem. |
