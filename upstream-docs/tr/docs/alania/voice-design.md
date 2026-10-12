# Ses tasarımıÖnizleme
voice_description ile bir sesi sözle tarif edin; Alania-2 bu istek için yeni bir ses oluşturur. Kayıt gerekmez.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"input": "Merhaba, siparişiniz yarın öğleden önce teslim edilecek.",
"voice_description": "A young man with a clear, energetic voice",
"seed": 42 }' \
--output tasarim.wav
Tasarlanan bir ses
-
## Tarif yazmak
- Yaş, cinsiyet, tını, hız ve enerjiyi birkaç kelimeyle anlatın.
- Türkçe ya da İngilizce yazabilirsiniz. İngilizce olmayan bir tarif modele gitmeden önce İngilizceye çevrilir.
- En fazla 200 karakter. Parantez içeremez.
- Örnekler: A young man with a clear, energetic voice · A calm middle-aged woman with a warm, low voice · tok sesli, yetmişlerinde bir dede.
## Kurallar
- voice_description gönderildiğinde voice yok sayılır. OpenAI SDK’ları voice alanını her zaman gönderdiği için bu bilinçli bir tercihtir.
- instructions ya da reference_audio ile birlikte kullanılamaz (conflicting_fields).
- Tasarlanan ses kendiliğinden kaydedilmez; beğendiğinizi kaydedebilirsiniz. Uzun bir metnin tüm parçaları aynı sesle okunur.
- Aynı sonucu yeniden almak için seed gönderin: aynı seed, aynı tarif ve aynı metin aynı sesi verir.
- Varsayılan cfg tasarımda 3.0’dır (diğer modlarda 2.0); daha yüksek değer sesi tarife daha sıkı bağlar.
## Tasarlanan sesi kaydetmek
Beğendiğiniz bir tasarımı hesabınıza kaydedin; sonra her istekte yalnızca kimliğini voice alanına yazarsınız, kayıtlı bir klon gibi. POST /v1/voices uç noktasına tasarım isteğinin kendisini (voice_description, seed, input) ve bir ad gönderin. Sunucu tasarımın ilk cümlesini aynı tohumla yeniden üretir, Duyu ile dinleyip denetler ve sesin kaydı olarak saklar.
POSThttps://voice.patientdesk.ai/v1/voices
namestringzorunlu
Sesin adı, en fazla 80 karakter.
voice_descriptionstringzorunlu
Tasarımın tarifi, sesi üretirken gönderdiğinizle aynı.
seedintegerzorunlu
Sesi üreten tohum. Aynı tarif her tohumda başka bir ses verir; tohum olmadan tasarım kaydedilemez (seed_required). Studio her tasarımda bir tohum seçip saklar.
inputstringzorunlu
Tasarımın okuduğu metin. Kaydedilen, bu metnin ilk cümlesidir (tasarımı yapan kısım); 3 saniyeden kısaysa ardına aynı sesle nötr bir paragraf eklenir.
cfg · temperature · pronunciations
Tasarımı bunlarla ürettiyseniz aynılarını gönderin.
- Tasarlanan seste kimsenin gerçek sesi yoktur, bu yüzden consent gerekmez. Ses source: "design" ile işaretlenir ve tarifi saklanır.
- Neden yeniden üretim: ölçümlerimizde, duyduğunuz tasarımdan kaydedilen ses yeni cümlelerde ona belirgin biçimde daha çok benzedi; aynı tarif ve tohumla baştan üretilen bir paragraf ise başka bir ses gibi çıktı.
- Kayıtlı tasarım instructions ve hazır stillerle de konuşur, bir klonun tüm kurallarıyla: 50 ses sınırı, GET /v1/voices ile listeleme, DELETE /v1/voices/{id} ile silme.
- Yeniden üretilen ses talimatı okursa ya da metni bozuk okursa kaydedilmez (design_unusable, 422): tasarımı başka bir tohumla yeniden üretip onu kaydedin.
curl
# 1 · design a voice, with a seed you keep
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice_description": "A warm, middle-aged woman with a low voice",
"seed": 4242,
"input": "Merhaba, randevunuzu yarın saat on dörde aldım." }' \
--output tasarim.wav
# 2 · liked it? save the same request as a voice
curl https://voice.patientdesk.ai/v1/voices \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "name": "Danışman",
"voice_description": "A warm, middle-aged woman with a low voice",
"seed": 4242,
"input": "Merhaba, randevunuzu yarın saat on dörde aldım." }'
Yanıt
HTTP/1.1 201 Created
content-type: application/json
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"object": "voice",
"name": "Danışman",
"transcript": "Merhaba, randevunuzu yarın saat on dörde aldım.",
"duration_s": 4.1,
"created_at": 1759651200,
"kind": "custom",
"tuned": false,
"source": "design",
"voice_description": "A warm, middle-aged woman with a low voice",
"warnings": [],
"quality": { "checked": true, "cer": 0.0 }
}
