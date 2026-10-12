# Alania: overview
Alania reads Turkish text aloud. Alania-2 is the default model: two built-in voices, short instructions for how to speak, new voices from a description or a recording, and 48 kHz audio.
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
alania2-m1 | Male | |
alania2-m2 | Male, deep | Beta. |
alania2-f2 | Female, bright | Beta. |
alania | Male · Alania-1 | Only with model: "alania-v1". Its id is alania-v1. |
antalia-mini | Male · Antalia-2 Mini | The free model. With model: "antalia-mini", or with this voice and no model. |
The beta voices are built-in voices trained on recordings from speakers who gave their consent, chosen with voice like the others. Each chunk is listened to before it is sent and made again when a word is missing (except a stream's first chunk, which plays as it is made). They may still miss a word slightly more often than the two main voices. GET /v1/voices marks them with "beta": true.
GEThttps://voice.patientdesk.ai/v1/voices
The list holds the built-in voices and the voices saved to your account (kind: "custom"; source is "clone" or "design"); see Saved voices. A designed voice is listed once you save it; recordings sent with a request are not saved or listed.
Hear the voices
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
