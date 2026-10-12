# Migrating from Alania-1
Alania-2 is now the default model. Requests that name no model reach Alania-2. To stay on Alania-1, send model: "alania-v1".
## What changed
| alania-v1 | alania-v2 |
Default | No (legacy) | Yes |
Sample rate | 24 kHz | 48 kHz |
Voices | alania | alania2-f1, alania2-m1 |
Style, design, cloning | No | Yes |
temperature | 0–2.0, default 0.30 | 0.6–2.0, default 1.0 |
top_p · cfg | top_p | cfg |
Price | Per character | Per character, the same |
## Where your request goes
You send | Now |
No model, no voice | Alania-2, alania2-f1, 48 kHz |
No model, voice: "alania" | Alania-2, alania2-f1, 48 kHz |
No model, voice: "alania-v1" | Alania-1, unchanged |
model: "alania-v1" | Alania-1, unchanged |
model: "tts-1" (OpenAI names) | Alania-2 |
## Staying on Alania-1
On a WebSocket, open the connection with ?model=alania-v1, or add model: "alania-v1" to each speak message.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v1", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania" }' \
--output merhaba-v1.wav # audio/wav, 24 kHz mono
## Moving to Alania-2
- Send model: "alania-v2" and pick a voice: alania2-f1 or alania2-m1.
- Make your player ready for 48 kHz; read the rate from the response.
- If you send temperature, retune it: Alania-2's default is 1.0. top_p no longer has an effect.
- Optionally add style instructions.
