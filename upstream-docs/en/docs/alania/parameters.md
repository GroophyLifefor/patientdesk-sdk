# Parameters reference
Every field of the POST /v1/audio/speech body, with its default and range. Send JSON or multipart/form-data.
POSThttps://voice.patientdesk.ai/v1/audio/speech Try it
## Request body
The fields fall into four groups. Only input is required; everything else has a default. Each group has an example body beside it.
### Text and model
inputstringrequired
The Turkish text to speak, up to 5,000 characters. Numbers, dates, times and amounts are read as spoken. Long text is split at sentence boundaries and spoken in order. On Alania-2 a leading (…) is read as the instruction.
modelstring
alania-v2, alania-v1 or the free antalia-mini. The OpenAI names tts-1, tts-1-hd and gpt-4o-mini-tts reach the default model. One exception: a request with no model and voice: "alania-v1" reaches Alania-1.
Defaultalania-v2
The shortest request
{
"model": "alania-v2",
"input": "Siparişiniz yola çıktı; yarın öğleden önce elinizde."
}
### Voice
voicestring
Alania-2: one of the 11 built-in voices, alania2-f1 (female, the default), alania2-nisa, alania2-oncel (the default male voice; male or erkek work too), alania2-m1, alania2-emre, alania2-fikri, alania2-sezgin, alania2-selin, alania2-lina, alania2-melisa, alania2-nil (the named voices also go by their name), or the id of a saved voice. See Voices. Alania-1: alania. Ignored when voice_description or reference_audio is sent.
Defaultalania2-f1
stylestringalania-v2
A ready speaking style's id: support-warm, support-calm, sales-energetic, reception-smile, apologetic, empathetic, slow, fast, whisper (GET /v1/styles). Stands in for instructions; cannot be combined with it or with voice_description. See Ready styles.
instructionsstringalania-v2
How to speak, at most 200 characters, no parentheses. Short ones work best; one not in English is translated to English. See Style instructions.
voice_descriptionstringalania-v2
A description of a new voice, at most 200 characters; one not in English is translated to English. Preview. Cannot be combined with instructions or reference_audio. See Voice design.
reference_audiofile | base64alania-v2
The voice to clone: 3–30 seconds (20–30 is best), at most 10 MB. Base64 or a data URI in JSON, a file in multipart. Needs consent: true. See Voice cloning.
reference_textstringalania-v2
The transcript of reference_audio, at most 1,000 characters. Optional and not used: the clone is made from the audio alone.
consentbooleanalania-v2
Required with reference_audio: states that the speaker agreed.
pronunciationsobject | array
How to say particular words in this request: {"PatientDesk": "Peyşınt Desk"} or [{"term": …, "say_as": …}], at most 200 entries. Takes precedence over your saved pronunciation dictionary. See Pronunciation dictionary.
{
"model": "alania-v2",
"voice": "alania2-m1",
"input": "Siparişiniz yola çıktı."
}
### Output format
response_format"wav" | "pcm" | "mulaw" | "alaw" | "mp3" | "opus" | "flac" | "aac"
wav and pcm are 16-bit mono; mulaw and alaw are headerless G.711 for phone lines (8 kHz by default). Streams accept wav, pcm, mulaw and alaw. See Telephony.
Defaultwav
sample_rateinteger
The output's sample rate: 8000, 16000, 22050, 24000, 44100 or 48000, at most the model's own (Alania-2 48000, Alania-1 24000). opus takes 8000, 16000, 24000 or 48000.
Defaultthe model's rate · 8000 for G.711
streamboolean
When true, audio is sent as it is generated. See Streaming.
Defaultfalse
Format examples
{
"input": "Görüşmeniz kayıt altına alınmaktadır.",
"response_format": "mulaw",
"stream": true
}
// 8 kHz G.711 μ-law, one byte a sample, as it is made
### Generation
seedinteger
0 to 2147483647. Random when omitted. The same seed, text and settings produce the same audio.
temperaturenumber
0.6–2.0 on Alania-2, 0–2.0 on Alania-1. Higher values vary the delivery and make the voice less consistent. Alania-2 goes silent below 0.6, so those values are refused.
Default1.0 · 0.30 on Alania-1
cfgnumberalania-v2
1.0–5.0. Guidance strength: higher values stay closer to the voice, instruction or description. Leave the default unless you are tuning.
Default2.0 · 3.0 for design
top_pnumberalania-v1
0.01–1.0. Alania-2 ignores it.
Default0.9
Generation settings
{
"model": "alania-v2",
"voice": "alania2-f1",
"input": "Kampanyamız bu hafta sonuna kadar sürüyor!",
"seed": 42, // same seed + text + settings = same audio
"temperature": 1.2, // livelier delivery, less consistent
"cfg": 2.5 // stay a little closer to the voice
}
## Output
model | Sample rate | Format |
alania-v2 | 48 kHz (or sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) or compressed |
alania-v1 | 24 kHz (or sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) or compressed |
antalia-mini | 48 kHz (or sample_rate) | Mono, PCM16 (wav, pcm), G.711 (mulaw, alaw) or compressed |
response_format | Content-Type |
wav | audio/wav |
pcm | audio/L16; rate=48000 (24000) |
mulaw | audio/PCMU; rate=8000 |
alaw | audio/PCMA; rate=8000 |
mp3 | audio/mpeg |
opus | audio/ogg |
flac | audio/flac |
aac | audio/aac |
## Response headers
x-request-idstring
The request id; include it in support requests.
x-modelstring
The model that produced the audio: alania-v2, alania-v1 or antalia-mini.
x-model-releasestring
Alania-2 only: the model release that produced the audio, such as alania-v2.1. On the WebSocket, the release field of speech_start.
x-disclosure"ai-generated"
On every response. Telling listeners that the audio is AI-generated is your responsibility.
x-charactersinteger
Characters this request billed to your account; 0 for the free antalia-mini.
x-audio-secondsnumber
Length of the audio produced. Not sent on streams.
x-queue-wait-msinteger
Time the request waited for a generation slot. The first thing to check when a caller says the API is slow.
## Billing
Alania is billed per character, at the same price in every mode (built-in voice, style, design, cloning). What counts is input as you sent it; expanding numbers into words does not add to it. instructions, voice_description and reference_text are not counted; a leading (…) in input is.
The price is $0.015 · ₺0,75 per 1,000 characters, the same for Alania-2 and Alania-1; antalia-mini is free. See Pricing.
