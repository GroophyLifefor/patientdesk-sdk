Docs
# Build with Turkish speech
Two Turkish speech models, one API key. Alania turns text into speech; Duyu turns speech into text. Both work with the OpenAI client libraries: change base_url and you are done.
QuickstartParameters reference
First request
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-f1",
"input": "Talebinizi ilgili ekibe aktardım, sonucu size kısa mesajla ileteceğiz." }' \
--output talep.wav
Result: talep.wav
-
## Products
Guides and reference for each product.
Text to speech
Alania
Built-in voices, style instructions, voice design from a description, consented cloning. 48 kHz audio that streams as it is made.
- Overview and voices
- Style instructionsPreview
- Voice designPreview
- Voice cloningBeta
- Professional cloneBeta
- Pronunciation dictionary
- Streaming
- Parameters reference
- Migrating from Alania-1
Speech to text
Duyu
File transcription and live streaming. Compatible with OpenAI Whisper clients; word timestamps, SRT and VTT.
- Transcription
- Live streaming
- Output formats
## Models
The ids you put in model.
alania-v2DefaultText to speech. Built-in voices, style, design, cloning.48 kHzantalia-miniFreeThe open-source Antalia-2 Mini. One voice, no quota used.48 kHzalania-v1LegacyThe first Alania. One voice, no extra fields.24 kHzduyu-1STTSpeech to text: files and live streams.REST · WebSocket
## Examples
End-to-end projects you can copy and run.
Speech in a web appKeep your key on the server: a small route forwards the request to Alania and streams the audio back, and the browser starts playing on the first chunk.A phone line with TwilioAnswer a call, transcribe the caller live with Duyu and reply in Alania's voice. Audio stays 8 kHz μ-law both ways; nothing to resample.Live captions in the browserStream the microphone to Duyu and show the words as they are spoken: partial drafts while someone talks, a settled final line when they pause.Narrating a long textTurn an article or a book chapter into one audio file: split the text into 5,000-character parts, ask for raw PCM, and write a single WAV.Subtitles for a videoPull the audio track out with ffmpeg, ask Duyu for srt, and attach the subtitles to the video.
## Base URLs
Every request goes over HTTPS or WSS; errors come back as JSON in the OpenAI shape.
Alania · REST
POSThttps://voice.patientdesk.ai/v1/audio/speech
Alania · WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/speech/stream
Duyu · REST
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions
Duyu · WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/stream
## Reference
- AuthenticationEvery request carries a key from your dashboard. The same key works for Alania and Duyu. Browser connections use short-lived tokens instead.
- Parameters referenceEvery field of the POST /v1/audio/speech body, with its default and range. Send JSON or multipart/form-data.
- Errors and limitsErrors follow the OpenAI shape: error.message, error.type, error.code. Temporary errors come with a Retry-After header.
- Service statusLive status, 90-day uptime and incident history.
