# Voice cloningBeta
Make a voice from a 3–30 second recording: save it once and use it by its id, or send the recording with each request. Alania-2 reads the text in that voice. The voice comes from the audio alone; no transcript is needed. You state the speaker's consent with consent: true.
## Saved voices
If you use the same voice often, save it once. The recording and the consent are kept on your account, and later requests send only the voice's id. Requests get smaller and start sooner.
### Create a voice
POSThttps://voice.patientdesk.ai/v1/voices
filefilerequired
The recording: between 3 and 30 seconds (20–30 is best), at most 10 MB. Common formats such as WAV, MP3, M4A, FLAC and OGG are accepted.
namestringrequired
The voice's name, at most 80 characters. Shown in lists; it does not have to be unique.
transcriptstring
What is said in the recording, at most 1,000 characters. Optional, and kept with the voice; the clone is made from the audio alone, so it does not change the result. If you send it, it is checked against the recording (transcript_mismatch).
consentbooleanrequired
Must be true: states that the person in the recording agreed to have their voice reproduced.
warnings says how well the recording will work as a clone: background (noise, hum or music under the speech), echo (room echo), clipping (distorted, too loud), transcript_mismatch (the transcript does not fit the recording). The voice is saved either way, but with a warning, making it again from a cleaner recording improves the result clearly. quality holds the measurements behind them. A recording with almost no speech in it is refused with invalid_reference.
curl https://voice.patientdesk.ai/v1/voices \
-H "Authorization: Bearer pd_live_..." \
-F name="Sesim" \
-F file=@ornek.wav \
-F transcript="Kayıtta söylenen cümlenin tam metni." \
-F consent=true
Response
HTTP/1.1 201 Created
content-type: application/json
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"object": "voice",
"name": "Sesim",
"transcript": "Kayıtta söylenen cümlenin tam metni.",
"duration_s": 21.4,
"created_at": 1759651200,
"kind": "custom",
"tuned": false,
"source": "clone",
"warnings": [],
"quality": { "speech_s": 16.8, "snr_db": 41.2, "echo_t20_s": 0.07, "clipped": 0.0, "chars_per_s": 13.9 }
}
### Speak with a saved voice
Put the voice's id in voice. No reference_audio or consent is needed: the server uses the saved clip and the consent on record. instructions works with these voices too.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"input": "Bu ses, konuşanın izniyle kaydedilen kısa bir örnekten üretildi." }' \
--output klon.wav
### List and delete
GEThttps://voice.patientdesk.ai/v1/voices
DELETEhttps://voice.patientdesk.ai/v1/voices/{id}
GET /v1/voices returns the built-in voices together with your account's voices; the ones you saved carry kind: "custom". Requests that name a deleted voice get unknown_voice.
# built-in voices and your saved ones
curl https://voice.patientdesk.ai/v1/voices -H "Authorization: Bearer pd_live_..."
# delete a saved voice
curl -X DELETE https://voice.patientdesk.ai/v1/voices/6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14 -H "Authorization: Bearer pd_live_..."
Responses
{
"object": "list",
"data": [
{
"id": "alania2-f1", "name": "Alania F1", "gender": "female", "language": "tr-TR",
"model": "alania-v2", "sample_rate": 48000, "default": true,
"f0_band_hz": [199.5538, 238.605]
},
…,
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14", "object": "voice", "name": "Sesim",
"transcript": "Kayıtta söylenen cümlenin tam metni.", "duration_s": 21.4,
"created_at": 1759651200, "kind": "custom", "tuned": false, "source": "clone"
}
]
}
## Send the recording with the request
You can also send the recording itself with every request, without saving the voice. This suits one-off jobs.
curl sends the file as multipart/form-data. In a JSON body, reference_audio is base64, or a data URI such as data:audio/wav;base64,….
reference_audiofile | base64required
Between 3 and 30 seconds (20–30 is best), at most 10 MB. Common formats such as WAV, MP3, M4A, FLAC and OGG are accepted.
reference_textstring
What is said in the recording, at most 1,000 characters. Optional and not used: the clone is made from the audio alone. It is accepted so existing clients keep working.
consentbooleanrequired
Must be true: states that the person in the recording agreed to have their voice reproduced.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-F model=alania-v2 \
-F input="Bu ses, konuşanın izniyle kaydedilen kısa bir örnekten üretildi." \
-F reference_audio=@ornek.wav \
-F reference_text="Kayıtta söylenen cümlenin tam metni." \
-F consent=true \
--output klon.wav
## A good recording
The recording decides most of how close the clone sounds. A few minutes of care make a clear difference.
- One person speaking. No music, television or other voices in the background.
- Speak as you normally would in a quiet room, with the phone or microphone about 20 cm from your mouth; do not shout or whisper. A room with carpet and curtains cuts down echo.
- 20–30 seconds of clear, continuous speech is best. A shorter recording keeps less of the voice; a longer one is not better, and anything over 30 seconds is not used. Long pauses and silence do not help.
- Avoid distortion: if the recording crackles or breaks up, move a little away from the microphone.
- You do not need to write down what is said: the clone is made from the audio alone. If you upload a long recording, the Studio picks its cleanest 20 seconds, and tells you about noise, echo or distortion before you save.
- The Studio cleans a recording before saving it: it filters out low rumble, trims the silence at the start and end, and evens out the speech level. If you send your own recordings to the API, doing the same improves the result.
## Style with a cloned voice
instructions also works with a cloned voice. It cannot be sent with voice_description (conflicting_fields). When the recording comes with the request, voice is ignored.
## Errors
code | Meaning |
consent_required | consent: true was not sent. |
reference_too_shortreference_too_long | The recording is under 3 seconds or over 30 seconds. |
reference_too_large | The recording is over 10 MB. |
invalid_reference | Not valid base64, or could not be decoded as audio. |
invalid_request | reference_text without reference_audio, or a transcript over 1,000 characters. |
voice_limit_reached | The account already holds 50 saved voices. Delete one to add another. |
unknown_voice | No saved voice has this id: it was deleted or belongs to another account. |
## Professional clone (beta)
With 1–5 minutes of recordings you can train your own professional clone in the Studio: trained just for your account, usually ready in about 20–30 minutes, and free during the beta. See Professional clone.
## Dedicated voice (enterprise)Paid
Instant cloning works from half a minute of audio. If you need a voice that sounds closer and stays the same from sentence to sentence, our team trains one just for you from 5–30 minutes of clean recordings. This is a paid service, priced per voice.
- Closer to the speaker and steadier than instant cloning.
- The speaker's consent is verified separately.
- When it is ready it appears on your account as a voice and is used by its id.
Contact usor write to
