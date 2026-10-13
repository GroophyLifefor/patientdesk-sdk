# Alania: overview
Alania reads Turkish text aloud. Alania-2 is the default model: 11 built-in voices, short instructions for how to speak, new voices from a description or a recording, and 48 kHz audio.
POSThttps://voice.patientdesk.ai/v1/audio/speech Try it
The body is the same as OpenAI audio/speech, so your OpenAI client works once you change base_url. Alania-2's extra fields go in the same body. See the parameters reference for every field.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "input": "Merhaba, randevunuz onaylandı.", "voice": "alania2-f1" }' \
--output merhaba.wav # audio/wav, 48 kHz mono
## Four ways to choose a voice
Way | Fields | Details |
Built-in voice | voice | One of the voices below. The same timbre on every request. |
Style instructions (preview) | voice + instructions, or a ready style | Style instructions: slowly, calmly, whispering… or ready styles for call centers. |
Voice design (preview) | voice_description | Voice design: a new voice described in words; save one you like and use it by its id. |
Voice cloning (beta) | reference_audio + consent, or voice set to a saved voice's id | Voice cloning: from a 3–30 second recording (20–30 is best) you have permission to use, sent with each request or saved once and used by its id. |
The price is the same for all four: per character of input.
## Voices
voice | Voice | Note |
alania2-f1 | Female | Alania-2's default voice. |
alania2-nisa | Female, gentle and playful | |
alania2-oncel | Male, mature and reassuring | The default male voice. |
alania2-m1 | Male | |
alania2-emre | Male, smooth and thoughtful | |
alania2-fikri | Male, clear and gentle | |
alania2-sezgin | Male, soft-spoken and breathy | |
alania2-selin | Female, relaxed and friendly | |
alania2-lina | Female, warm and calm | |
alania2-melisa | Female, bright and energetic | |
alania2-nil | Female, warm and enthusiastic | |
alania | Male · Alania-1 | Only with model: "alania-v1". Its id is alania-v1. |
antalia-mini | Male · Antalia-2 Mini | The free model. With model: "antalia-mini", or with this voice and no model. |
alania2-m2 and alania2-f2 were retired on 12 October 2026; requests naming them get 400 unknown_voice.
The nine named voices (alania2-nisa, alania2-oncel, alania2-emre, alania2-fikri, alania2-sezgin, alania2-selin, alania2-lina, alania2-melisa, alania2-nil) are designed voices, like f1 and m1: no voice actor recorded them; we designed candidates, then picked these in blind listening and named them. Each speaks from its own fixed reference, with the same timbre on every request. Put its id or its name in voice ("nisa"; for Öncel, "öncel" or "oncel"). They are not trained into the model, so with a speaking style (instructions or style) they drift a little further from their own timbre than f1 and m1 do.
GEThttps://voice.patientdesk.ai/v1/voices
The list holds the built-in voices and the voices saved to your account (kind: "custom"; source is "clone" or "design"); see Saved voices. A designed voice is listed once you save it; recordings sent with a request are not saved or listed.
Hear the voices
-
-
Nine more voices
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
Response
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
## Models
GEThttps://voice.patientdesk.ai/v1/alania/models
One host serves both products, so the endpoints that exist on both carry /alania on the speech side: /v1/alania/models, /v1/alania/usage, /health/alania. The audio endpoints and /v1/voices stay as they are.
Response
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
## Response
Every response carries x-disclosure: ai-generated. Telling your listeners that the audio is AI-generated is your responsibility. All headers are in the parameters reference.
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
## Measurements
Measure | Value | Conditions |
First audio | ~190 ms | Streamed request to first audio chunk, median, measured through the public API with the network included. |
Character error rate · alania2-f1 | 2.7% | Our 292-sentence Turkish test set; the audio was transcribed with Whisper. |
Character error rate · alania2-m1 | 2.8% | Same test set and method. |
