# Parametre referansı
POST /v1/audio/speech gövdesindeki her alan, varsayılanı ve aralığıyla. JSON ya da multipart/form-data gönderebilirsiniz.
POSThttps://voice.patientdesk.ai/v1/audio/speech Deneyin
## İstek gövdesi
Alanlar dört gruba ayrılır. Yalnızca input zorunludur; geri kalanların hepsinin bir varsayılanı vardır. Her grubun yanında gövdenin örneği durur.
### Metin ve model
inputstringzorunlu
Seslendirilecek Türkçe metin, en fazla 5.000 karakter. Sayılar, tarihler, saatler ve tutarlar konuşulduğu gibi okunur. Uzun metin cümle sınırlarından bölünür ve sırayla seslendirilir. Alania-2’de baştaki bir (…) talimat olarak okunur.
modelstring
alania-v2, alania-v1 ya da ücretsiz antalia-mini. OpenAI adları tts-1, tts-1-hd ve gpt-4o-mini-tts varsayılan modele gider. Tek istisna: model belirtmeden voice: "alania-v1" gönderen istekler Alania-1’e gider.
Varsayılanalania-v2
En kısa istek
{
"model": "alania-v2",
"input": "Siparişiniz yola çıktı; yarın öğleden önce elinizde."
}
### Ses
voicestring
Alania-2: 11 yerleşik sesten biri: alania2-f1 (kadın, varsayılan), alania2-nisa, alania2-oncel (varsayılan erkek ses; male ya da erkek de olur), alania2-m1, alania2-emre, alania2-fikri, alania2-sezgin, alania2-selin, alania2-lina, alania2-melisa, alania2-nil (adlı sesler adıyla da seçilir); ya da kaydedilmiş bir sesin kimliği. Bkz. Sesler. Alania-1: alania. voice_description ya da reference_audio gönderildiğinde yok sayılır.
Varsayılanalania2-f1
stylestringalania-v2
Hazır bir konuşma stilinin kimliği: support-warm, support-calm, sales-energetic, reception-smile, apologetic, empathetic, slow, fast, whisper (GET /v1/styles). instructions yerine geçer; onunla ya da voice_description ile birlikte kullanılamaz. Bkz. Hazır stiller.
instructionsstringalania-v2
Nasıl konuşacağı, en fazla 200 karakter, parantezsiz. Kısa olanlar en iyi sonucu verir; İngilizce olmayanlar İngilizceye çevrilir. Bkz. Konuşma üslubu.
voice_descriptionstringalania-v2
Yeni bir sesin tarifi, en fazla 200 karakter; İngilizce olmayanlar İngilizceye çevrilir. Önizleme. instructions ve reference_audio ile birlikte kullanılamaz. Bkz. Ses tasarımı.
reference_audiofile | base64alania-v2
Klonlanacak ses: 3–30 saniye (en iyisi 20–30), en fazla 10 MB. JSON’da base64 ya da data URI, multipart’ta dosya. consent: true ister. Bkz. Ses klonlama.
reference_textstringalania-v2
reference_audio kaydının metni, en fazla 1.000 karakter. İsteğe bağlı ve kullanılmaz: klon yalnızca kayıttan yapılır.
consentbooleanalania-v2
reference_audio ile zorunlu: konuşanın izin verdiğini beyan eder.
pronunciationsobject | array
Bu istekte belirli kelimelerin nasıl okunacağı: {"PatientDesk": "Peyşınt Desk"} ya da [{"term": …, "say_as": …}], en fazla 200 kayıt. Hesabınızdaki söyleniş sözlüğünün önüne geçer. Bkz. Söyleniş sözlüğü.
{
"model": "alania-v2",
"voice": "alania2-m1",
"input": "Siparişiniz yola çıktı."
}
### Çıktı biçimi
response_format"wav" | "pcm" | "mulaw" | "alaw" | "mp3" | "opus" | "flac" | "aac"
wav ve pcm 16 bit mono’dur; mulaw ve alaw telefon hatları için başlıksız G.711’dir (varsayılan 8 kHz). Akışta wav, pcm, mulaw ve alaw. Bkz. Telefon.
Varsayılanwav
sample_rateinteger
Çıktının örnekleme hızı: 8000, 16000, 22050, 24000, 44100 ya da 48000, modelin kendi hızını aşmadan (Alania-2 48000, Alania-1 24000). opus 8000, 16000, 24000 ya da 48000 alır.
Varsayılanmodelin hızı · G.711’de 8000
streamboolean
true ise ses üretildikçe gönderilir. Bkz. Akış.
Varsayılanfalse
Biçim örnekleri
{
"input": "Görüşmeniz kayıt altına alınmaktadır.",
"response_format": "mulaw",
"stream": true
}
// 8 kHz G.711 μ-law, one byte a sample, as it is made
### Üretim
seedinteger
0 ile 2147483647 arası. Verilmezse rastgele seçilir. Aynı seed, aynı metin ve aynı ayarlar aynı sesi üretir.
temperaturenumber
Alania-2’de 0.6–2.0, Alania-1’de 0–2.0. Yükseltmek söyleyişi çeşitlendirir, sesin tutarlılığını azaltır. Alania-2 0.6’nın altında sessizleştiği için bu değerler reddedilir.
Varsayılan1.0 · Alania-1’de 0.30
cfgnumberalania-v2
1.0–5.0. Yönlendirme gücü: yüksek değer sese, talimata ya da tarife daha sıkı bağlı kalır. Ayar yapmıyorsanız varsayılanı kullanın.
Varsayılan2.0 · tasarımda 3.0
top_pnumberalania-v1
0.01–1.0. Alania-2 bu alanı yok sayar.
Varsayılan0.9
Üretim ayarları
{
"model": "alania-v2",
"voice": "alania2-f1",
"input": "Kampanyamız bu hafta sonuna kadar sürüyor!",
"seed": 42, // same seed + text + settings = same audio
"temperature": 1.2, // livelier delivery, less consistent
"cfg": 2.5 // stay a little closer to the voice
}
## Çıktı
model | Örnekleme hızı | Biçim |
alania-v2 | 48 kHz (ya da sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) ya da sıkıştırılmış |
alania-v1 | 24 kHz (ya da sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) ya da sıkıştırılmış |
antalia-mini | 48 kHz (ya da sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) ya da sıkıştırılmış |
response_format | Content-Type |
wav | audio/wav |
pcm | audio/L16; rate=48000 (24000) |
mulaw | audio/PCMU; rate=8000 |
alaw | audio/PCMA; rate=8000 |
mp3 | audio/mpeg |
opus | audio/ogg |
flac | audio/flac |
aac | audio/aac |
## Yanıt başlıkları
x-request-idstring
İsteğin kimliği; destek taleplerinde paylaşın.
x-modelstring
Sesi üreten model: alania-v2, alania-v1 ya da antalia-mini.
x-model-releasestring
Yalnızca Alania-2: sesi üreten model sürümü, örneğin alania-v2.1. WebSocket’te speech_start iletisinin release alanı.
x-disclosure"ai-generated"
Her yanıtta bulunur. Sesin yapay zekâ üretimi olduğunu dinleyiciye belirtmek sizin sorumluluğunuzdadır.
x-charactersinteger
Bu isteğin hesabınızdan düşen karakter sayısı; ücretsiz antalia-mini için 0.
x-audio-secondsnumber
Üretilen sesin süresi. Akışta gönderilmez.
x-queue-wait-msinteger
İsteğin üretim yuvası beklediği süre. Yavaşlık şikâyetinde ilk bakılacak yer.
## Faturalandırma
Alania karakter başına faturalanır; fiyat her modda aynıdır (yerleşik ses, üslup, tasarım, klonlama). Sayılan, input alanının gönderdiğiniz hâlidir; sayıların okunuşa çevrilmesi gibi işlemler sayıyı artırmaz. instructions, voice_description ve reference_text sayılmaz; input başındaki (…) sayılır.
Fiyat 1.000 karakter başına ₺0,75 · $0.015; Alania-2 ve Alania-1 aynıdır, antalia-mini ücretsizdir. Bkz. Fiyatlar.
