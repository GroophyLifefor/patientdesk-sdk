# Alania-1’den geçiş
Alania-2 artık varsayılan model. Model belirtmeyen istekler Alania-2’ye gider. Alania-1’de kalmak için model: "alania-v1" gönderin.
## Ne değişti
| alania-v1 | alania-v2 |
Varsayılan | Hayır (eski sürüm) | Evet |
Örnekleme hızı | 24 kHz | 48 kHz |
Sesler | alania | alania2-f1, alania2-m1 |
Üslup, tasarım, klonlama | Yok | Var |
temperature | 0–2.0, varsayılan 0.30 | 0.6–2.0, varsayılan 1.0 |
top_p · cfg | top_p | cfg |
Fiyat | Karakter başına | Karakter başına, aynı |
## İsteğiniz nereye gider
Gönderdiğiniz | Şimdi |
model yok, voice yok | Alania-2, alania2-f1, 48 kHz |
model yok, voice: "alania" | Alania-2, alania2-f1, 48 kHz |
model yok, voice: "alania-v1" | Alania-1, değişiklik yok |
model: "alania-v1" | Alania-1, değişiklik yok |
model: "tts-1" (OpenAI adları) | Alania-2 |
## Alania-1’de kalmak
WebSocket’te bağlantıyı ?model=alania-v1 ile açın ya da her speak mesajına model: "alania-v1" ekleyin.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v1", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania" }' \
--output merhaba-v1.wav # audio/wav, 24 kHz mono
## Alania-2’ye geçmek
- model: "alania-v2" gönderin ve bir ses seçin: alania2-f1 ya da alania2-m1.
- Oynatıcınızı 48 kHz’e hazırlayın; hızı yanıttan okuyun.
- temperature gönderiyorsanız yeniden ayarlayın: Alania-2’nin varsayılanı 1.0’dır. top_p artık etkisizdir.
- İsterseniz üslup talimatı ekleyin.
