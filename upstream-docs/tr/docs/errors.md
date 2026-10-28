# Hatalar ve sınırlar
Hatalar OpenAI biçimindedir: error.message, error.type, error.code. Geçici hatalar Retry-After başlığıyla gelir.
Programınızda code alanına göre karar verin; message insanlar için yazılmıştır ve değişebilir. WebSocket’lerde aynı bilgi bir error mesajında gelir.
HTTP
HTTP/1.1 400 Bad Request
content-type: application/json
{
"error": {
"message": "`voice_description` designs a new voice; it cannot be combined with `reference_audio`.",
"type": "invalid_request_error",
"code": "conflicting_fields"
}
}
## Ortak kodlar
Durum | code | Anlamı |
400 | invalid_requestinvalid_json | Gövde çözümlenemedi ya da bir alan geçersiz; mesaj alanı adlandırır. |
401 | missing_api_keyinvalid_api_key | Anahtar yok ya da geçersiz. |
401 | invalid_tokentoken_expired | Oturum tokenı geçersiz ya da süresi dolmuş. |
401 | auth_unavailable | Kimlik doğrulama geçici olarak yanıt vermiyor; tekrar deneyin. |
402 | insufficient_balance | Bakiye bitti. Bakiye yükleyin ya da otomatik yüklemeyi açın; Antalia-2 Mini çalışmaya devam eder. |
429 | quota_exceeded | Aylık üst sınır doldu (kötüye kullanıma karşı; yükseltmek için bize yazın). |
429 | rate_limit_exceeded | Dakikalık istek sınırı ya da eşzamanlı istek sınırı aşıldı. Retry-After saniye cinsindendir. |
503 | model_loadingserver_busyhigh_demand | Geçici; Retry-After süresi sonra tekrar deneyin. |
## Yeniden denemek
429 ve 503 geçicidir: Retry-After başlığındaki süre kadar bekleyip aynı isteği tekrar gönderin. quota_exceeded ve 402 insufficient_balance beklemekle geçmez. 400 ile başlayan hatalar istekteki bir sorunu gösterir; tekrar denemek yerine isteği düzeltin.
Yeniden deneyen bir istemci
import time
import requests
API = "https://voice.patientdesk.ai/v1/audio/speech"
AUTH = {"Authorization": "Bearer pd_live_..."}
def speak(body, tries=5):
for attempt in range(tries):
r = requests.post(API, headers=AUTH, json=body, timeout=120)
if r.ok:
return r.content
err = r.json().get("error", {}) if "json" in r.headers.get("content-type", "") else {}
if r.status_code not in (429, 502, 503) or err.get("code") == "quota_exceeded":
r.raise_for_status() # a 4xx will not fix itself: fix the request
time.sleep(float(r.headers.get("Retry-After", 2 ** attempt)))
raise RuntimeError("still failing after retries")
## Alania
Durum | code | Anlamı |
400 | input_too_long | input 5.000 karakteri aşıyor. |
400 | unknown_model | model tanınmıyor. Geçerli: alania-v2, alania-v1. |
400 | unknown_voice | Ses bu modelde yok; mesaj geçerli sesleri listeler. |
400 | conflicting_fields | Birlikte kullanılamayan alanlar: voice_description ile instructions, style ya da reference_audio; style ile instructions; instructions ile baştaki (…). |
400 | unknown_styleinvalid_style | style hazır stillerden biri değil; mesaj geçerli kimlikleri listeler (GET /v1/styles). |
400 | seed_required | Tasarlanan bir ses seed olmadan kaydedilmek istendi. |
422 | design_unusable | Kaydedilmek istenen tasarım temiz üretilemedi (talimatı okudu ya da metni bozdu); başka bir tohumla deneyin. |
400 | consent_required | reference_audio ya da POST /v1/voices ile kayıt gönderildi ama consent: true yok. |
400 | unsupported_field | Alania-2 alanı alania-v1 ile gönderildi. |
400 | invalid_instructionsinvalid_voice_description | 200 karakteri aşıyor, metin değil ya da parantez içeriyor. |
400 | invalid_referencereference_too_shortreference_too_longreference_too_large | Klonlama kaydı (istekte ya da POST /v1/voices ile) çözülemedi, 3–30 saniye dışında ya da 10 MB’tan büyük. |
403 | account_required | Ses ya da söyleniş kaydetmek bir hesap API anahtarı ister; demo oturumu kaydedemez. |
404 | unknown_voice | voice ya da /v1/voices/{id} içindeki kimlikle kayıtlı bir ses yok: silinmiş ya da başka bir hesaba ait. |
409 | voice_limit_reached | Hesapta zaten 50 kayıtlı ses var. Yeni ses eklemek için birini silin. |
503 | design_save_unavailable | Tasarlanan sesleri kaydetmek geçici olarak kullanılamıyor; klonlar etkilenmez. |
400 | invalid_pronunciations | pronunciations alanı ya da POST /v1/pronunciations gövdesi geçersiz. Bkz. Söyleniş sözlüğü. |
404 | unknown_pronunciation | /v1/pronunciations/{id} içindeki kimlikle bir kayıt yok. |
409 | pronunciation_limit_reached | Hesapta zaten 500 söyleniş kaydı var. Yenisi için birini silin. |
503 | pronunciation_store_unavailable | Söyleniş sözlüğü geçici olarak yanıt vermiyor; tekrar deneyin. |
502 | engine_error | Ses üretilemedi. Tekrar deneyin; sürerse x-request-id ile bize yazın. |
503 | model_loading | Model başlatılıyor (Retry-After: 10). Bu sırada diğer model yanıt vermeye devam edebilir. |
## Duyu
Durum | code | Anlamı |
400 | missing_fileempty_audio | file alanı yok ya da ses boş. |
400 | undecodable_audio | Dosya ses olarak çözülemedi. |
400 | bad_response_formatbad_temperature | response_format ya da temperature geçersiz. |
404 | model_not_found | model duyu-1 ya da whisper-1 değil. |
413 | file_too_largeaudio_too_long | 100 MB ya da 2 saat sınırı aşıldı. |
## Sınırlar
Varsayılan sınırlar aşağıdadır. Eşzamanlı istek ve akış sınırlarını hesap başına yükseltiyoruz: örneğin aramaları aynı saatte toplanan bir telefon hattı için. Tepe sayınızla sezgin@patientdesk.ai adresine yazın.
Sınır | Değer |
İstek / dakika (anahtar başına, her ürün) | 600 |
Alania · metin uzunluğu | 5.000 karakter |
Alania · instructions, voice_description | 200 karakter |
Alania · klonlama kaydı | 3–30 saniye, 10 MB |
Alania · kayıtlı ses (hesap başına) | 50 |
Alania · eşzamanlı istek / WebSocket (anahtar başına) | 8 / 4 |
Duyu · dosya boyutu / süresi | 100 MB / 2 saat |
Duyu · eşzamanlı istek / akış (anahtar başına) | 3 / 2 |
Oturum tokenı ömrü | 10 dakika |
## Servis durumu
Canlı durum, 90 günlük erişilebilirlik ve olay geçmişi status.patientdesk.ai adresindedir. Kontroller altyapımızın dışından her dakika çalışır; iki dakikada bir gerçek bir Türkçe kaydı yazıya döker ve bir cümleyi seslendirir. Durumu kendi izleme sisteminize bağlamak için Statuspage uyumlu JSON uç noktasını kullanın.
Alania’nın kendi sağlık ucu her modelin durumunu ayrı verir. Bir model başlatılırken status degraded olur ve o modele giden istekler model_loading alır.
GEThttps://voice.patientdesk.ai/health/alania
curl
curl https://status.patientdesk.ai/api/v2/status.json
JSON
{
"status": "ok",
"service": "tts",
"model": "alania-v2",
"models": {
"alania-v1": { "status": "ok", "sample_rate": 24000, "default": false },
"alania-v2": { "status": "ok", "sample_rate": 48000, "default": true },
"antalia-mini": { "status": "ok", "sample_rate": 48000, "default": false }
},
"limits_degraded": false
}
