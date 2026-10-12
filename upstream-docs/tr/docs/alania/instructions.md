# Konuşma üslubuÖnizleme
instructions alanıyla yerleşik sese nasıl konuşacağını kısa bir cümleyle söyleyin. Ses aynı kalır, söyleyiş değişir.
Python ve Node OpenAI SDK’larında instructions doğrudan bir argümandır; ek bir ayar gerekmez.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"input": "Randevunuz yarın saat 14:05 için oluşturuldu.",
"voice": "alania2-f1",
"instructions": "speaking slowly and calmly" }' \
--output randevu.wav
Talimatla okunan örnekler
-
-
## Talimat yazmak
- Söyleyişi tarif edin: hız, ses yüksekliği, perde, duygu. Talimatınız, modelin eğitildiği biçimde İngilizce bir söyleyiş tarifine dönüştürülür (“A woman speaks calmly, a little slower than usual…”); roller ve hikâyeler (“sakin bir hemşire gibi”, “bir sır verir gibi”) yalnızca söyleyişe indirgenir.
- Türkçe yazabilirsiniz. Her dildeki talimat modele gitmeden önce bu İngilizce tarife dönüştürülür. Metin Türkçe kalır.
- Somut olun: hız, ses yüksekliği, duygu, ortam.
- En fazla 200 karakter. Parantez içeremez.
- Sonuç talimatın okunmasıyla başlıyorsa ses yeniden üretilir. Akışta (stream: true ya da WebSocket) 40 karakterden uzun bir talimatın ilk saniyeleri, dinlenip denetlenene kadar bekletilir; bu, ilk sese yaklaşık 0,4 saniye ekler. Kısa talimatlar beklemeden başlar.
Örnek talimat | Ne zaman |
Whisper. | Sessiz ortamlar, gece bildirimleri |
speak like a calm nurse | Hasta aramaları, sonuç bildirimleri |
speaking slowly and calmly | Randevu hatırlatmaları, yol tarifleri |
cheerful and upbeat | Karşılama mesajları |
in a serious, formal tone | Resmî duyurular |
## Hazır stiller
Çağrı merkezleri için ölçerek seçtiğimiz hazır stiller: talimat yazmak yerine style alanına birinin kimliğini gönderin. Her stil, modelin kelimesi kelimesine eğitildiği bir söyleyiş tarifine karşılık gelir; çevrilmez, yeniden yazılmaz ve akışın başını bekletmez.
style | Ne zaman |
support-warm | Günlük müşteri hizmetleri: sıcak ve güler yüzlü. |
support-calm | Şikâyet, bekleme, kötü haber: sakin ve güven veren. |
sales-energetic | Kampanya ve teklifler: canlı ve coşkulu. |
reception-smile | Karşılama ve rezervasyon: parlak ve davetkâr. |
apologetic | Gecikme, hata, özür: samimi ve mahcup. |
empathetic | Hasta aramaları, zor haberler: şefkatli ve anlayışlı. |
slow | Yaşlı arayanlar, numaralar, adresler: belirgin biçimde yavaş ve net. |
fast | Bilgilendirme ve yasal metinler: belirgin biçimde hızlı. |
whisper | Sessiz ortamlar, gece bildirimleri: alçak sesle, fısıldayarak. |
- Yerleşik seslerle, beta seslerle, kayıtlı seslerle ve klonlarla çalışır. voice_description ile kullanılamaz.
- instructions ya da baştaki (…) ile birlikte gönderilemez (conflicting_fields). Bilinmeyen bir kimlik unknown_style ile reddedilir; mesaj geçerli kimlikleri listeler.
- Ölçümlerimizde (iki ses, 12 stil, 10 çağrı merkezi cümlesi) stiller hızı, perdeyi ve enerjiyi istenen yönde belirgin biçimde değiştirdi, kelime hatasını artırmadı ve stil tarifi hiç sesli okunmadı. Ses, önceki modele göre kendi rengine daha yakın kalır; yine de düz sese göre biraz değişir.
GEThttps://voice.patientdesk.ai/v1/styles
curl
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-f1",
"style": "support-warm",
"input": "Merhaba, Anadolu Sigorta’ya hoş geldiniz. Size nasıl yardımcı olabilirim?" }' \
--output karsilama.wav
Yanıt
{
"object": "list",
"data": [
{ "id": "support-warm", "object": "style", "name": "Warm support",
"description": "Warm and friendly, for everyday customer service." },
{ "id": "support-calm", "object": "style", "name": "Calm support",
"description": "Calm and reassuring, for complaints, waits and bad news." },
{ "id": "sales-energetic", "object": "style", "name": "Energetic sales",
"description": "Lively and upbeat, for campaigns and offers." },
{ "id": "reception-smile", "object": "style", "name": "Smiling receptionist",
"description": "Bright and welcoming, for greetings and bookings." },
{ "id": "apologetic", "object": "style", "name": "Apologetic",
"description": "Sincere and sorry, for delays, mistakes and apologies." },
{ "id": "empathetic", "object": "style", "name": "Empathetic",
"description": "Gentle and understanding, for patient calls and difficult news." },
{ "id": "slow", "object": "style", "name": "Slow and clear",
"description": "Much slower and clear, for older callers, numbers and addresses." },
{ "id": "fast", "object": "style", "name": "Fast",
"description": "Much faster, for notices and disclaimers." },
{ "id": "whisper", "object": "style", "name": "Whisper",
"description": "Hushed and breathy, for quiet settings and night-time notices." }
]
}
## Metnin başında talimat
Alania-2, input alanının başındaki parantezli ifadeyi talimat olarak okur. Bu, yalnızca metin gönderebilen araçlarda işe yarar.
curl
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-m1",
"input": "(whispering softly) Bebek yeni uyudu, lütfen sessiz olalım." }' \
--output fisilti.wav
## Diğer alanlarla
Birlikte | Sonuç |
voice | Seçilen yerleşik ses, talimata göre konuşur. |
reference_audio | Klonlanan ses talimata göre konuşur. |
voice_description | İzin verilmez (conflicting_fields): tarif zaten nasıl konuşacağını anlatır. |
style | İzin verilmez (conflicting_fields): ya hazır bir stil ya da kendi talimatınız. |
model: "alania-v1" | İzin verilmez (unsupported_field). |
