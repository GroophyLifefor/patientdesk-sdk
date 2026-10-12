# Quickstart
Generate your first audio and transcribe your first recording in a few minutes.
- Create an API key in the dashboard. It is shown only once, so store it somewhere safe.
- Send Alania a sentence; the response is a WAV file.
- Send a recording to Duyu and get the text back.
## 1 · Speak
POSThttps://voice.patientdesk.ai/v1/audio/speech Try it
If you leave out model, the request reaches Alania-2 and speaks with the alania2-f1 voice. The response is a 48 kHz mono WAV file. The Python example uses the OpenAI SDK; changing base_url is all it takes.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania2-f1" }' \
--output merhaba.wav # audio/wav, 48 kHz mono
### With Alania-1
The previous model keeps working as alania-v1: 24 kHz, one voice (alania), and no style, design or cloning fields.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v1", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania" }' \
--output merhaba-v1.wav # audio/wav, 24 kHz mono
### With Antalia-2 Mini (free)
model: "antalia-mini" uses Antalia-2 Mini, our open-source model (7.6M parameters): 48 kHz, one male voice (antalia-mini), and only seed and pronunciations as fields. It is free: it uses none of your quota and keeps working when the quota is spent (x-characters: 0). To prevent abuse it has its own limits: 60 requests a minute and 5,000 a day per account or key; past them you get 429 free_limit_exceeded. You can also run the same model on your own server with pip install antalia-mini, or in a browser.
## 2 · Transcribe
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions Try it
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@kayit.m4a \
-F response_format=json
Response
{ "text": "Randevunuz yarın saat 14:05 için oluşturuldu." }
## Then
Or start from a project that works end to end: a web app, a phone line, live captions.
AlaniaFour ways to choose a voiceBuilt-in voice, style instructions, design from a description, cloning.AlaniaStreamingStart playing while audio is still being generated: HTTP or WebSocket.DuyuLive streamingFrom a microphone over WebSocket: partial drafts, then a final after silence.
