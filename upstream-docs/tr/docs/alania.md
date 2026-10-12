# Alania: genel bakış
Alania Türkçe metni sese çevirir. Alania-2 varsayılan modeldir: iki yerleşik ses, nasıl konuşacağını söyleyen kısa talimatlar, tarifle ya da kayıttan yeni sesler ve 48 kHz ses.
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
alania2-m1 | Erkek | |
alania2-m2 | Erkek, kalın | Beta. |
alania2-f2 | Kadın, parlak | Beta. |
alania | Erkek · Alania-1 | Yalnızca model: "alania-v1" ile. Kimliği alania-v1. |
antalia-mini | Erkek · Antalia-2 Mini | Ücretsiz model. model: "antalia-mini" ile ya da model belirtmeden bu sesle. |
Beta sesler, izin veren konuşmacıların kayıtlarıyla eğitilmiş yerleşik seslerdir ve diğerleri gibi voice ile seçilir. Her parça gönderilmeden önce dinlenir; eksik kelimeli bir okuma yeniden üretilir (akışta ilk parça hariç, o üretilirken çalınır). Yine de iki ana sesten biraz daha sık kelime kaçırabilirler. GET /v1/voices yanıtında "beta": true ile işaretlidirler.
GEThttps://voice.patientdesk.ai/v1/voices
Liste yerleşik sesleri ve hesabınıza kaydettiğiniz sesleri (kind: "custom"; source değeri "clone" ya da "design") içerir; bkz. Kaydedilmiş sesler. Tasarlanan bir ses kaydedildiğinde listelenir; istekle gönderilen kayıtlar kaydedilmez, listelenmez.
Sesleri dinleyin
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
"id": "alania2-m1", "name": "Alania M1", "gender": "male", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": false,
"f0_band_hz": [109.0961, 131.6118], "kind": "builtin", "tuned": false, "beta": false
},
{
"id": "alania2-m2", "name": "Alania M2", "gender": "male", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": false,
"f0_band_hz": [92.2704, 106.0399], "kind": "builtin", "tuned": false, "beta": true
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
