# Professional cloneBeta
A voice trained just for your account from 1–5 minutes of one speaker. It sounds closer to the speaker than the instant clone and stays steadier from sentence to sentence, and is usually ready in about 20–30 minutes. Free during the beta.
You start a professional clone on the Studio's My voices page: name and consent, recordings, a live reading, then training. When it is ready, the voice appears among your saved voices with a “Professional” label and is used by its id like any saved voice.
| Instant clone | Professional clone (beta) |
Recording | 3–30 seconds (20–30 is best) | 1–5 minutes of speech |
Ready | At once | Usually 20–30 minutes |
Likeness | Depends on the recording | Closer to the speaker, steadier |
Consent | consent: true statement | The speaker's permission, explicit consent to the voice comparison, and a live reading |
Limit | 50 saved voices | 2 professional voices, 1 training at a time |
## Recordings
- 1–5 minutes of speech in total. The Studio shows the speech time without the silences; the server measures again after cleaning the recordings, and its measurement is the one that counts.
- One speaker. The same person speaks in every recording, with no other voices, music or television.
- A quiet room without echo, the microphone about 20 cm from the mouth. The Studio flags background noise, echo, distortion and a quiet level for every recording; replacing a flagged one improves the result clearly.
- You can record in the browser or upload files (wav, mp3, m4a, webm, ogg, flac; up to 100 MB each), or mix the two. Texts to read are ready in the Studio.
- If you have more than 5 minutes of recordings, or want a dedicated voice built by our team, see the paid dedicated voice service.
## Live verification
So that nobody's voice is cloned without their consent, once the recordings are uploaded a random Turkish sentence appears on screen and the person in the recordings reads it aloud, there and then (3–20 seconds). The sentence is picked fresh each time, so it cannot be recorded in advance.
- Duyu listens to the reading at once. If what was said does not match the sentence, you see what was heard and get a new sentence; there are at most 5 tries.
- Before training, the voice in the reading is checked against the uploaded recordings to be the same person. If it is not, there is no training.
## Timing and stages
Training starts by itself after verification and usually takes about 20–30 minutes. You can leave the page; when you come back to My voices, the status is there.
status | Meaning |
awaiting_upload | The training exists; the recordings are awaited. |
awaiting_verification | The recordings are in; the live reading is awaited. |
queued | Queued. The training server is starting; this can take a few minutes. |
preparing | The recordings are cleaned, split into sentences and transcribed. |
training | The voice is trained on your recordings; the longest stage. |
evaluating | Compared with the instant clone on held-out recordings. |
ready | Ready: the voice is among your saved voices (voice_id). |
rejected | Not released: it was not better than the instant clone, or the reading did not match the recordings. The reason is in error. |
failed | Could not finish (for example, 5 verification tries used up). The reason is in error. |
canceled | Canceled. |
## Limits
- At most 2 professional voices per account. Delete one to train another.
- One training at a time. You can cancel the one in progress or wait for it to finish.
- Free during the beta. Speaking with a professional voice is billed per character, like any voice.
## Privacy
- Your recordings, the live reading and the trained voice are kept in private storage in the EU (the Netherlands, europe-west4); only your account can reach them.
- Raw recordings are deleted 7 days after training finishes, and at once when you cancel or delete the training.
- You can delete the trained voice at any time, on My voices or with DELETE /v1/voices/{id}.
## API
Trainings belong to your account and are visible with your API key too. For now, recordings are uploaded from the Studio only (to your account's private storage); the routes below are for following the status and managing trainings.
Route | What it does |
POST /v1/voice-tunings | Creates a training from {"name", "consent": true, "biometric_consent": true}; returns the upload prefix. 409 tuning_limit_reached, 400 consent_required. |
POST /v1/voice-tunings/{id}/sources | {"paths": [...]}: measures the uploaded recordings (60–300 s of speech) and issues the sentence to read (challenge). 400 source_too_short, source_too_long. |
POST /v1/voice-tunings/{id}/verify | Multipart file: the live reading (3–20 s). On a match, queued; otherwise 400 verification_failed with what was heard, and a new sentence. |
GET /v1/voice-tunings | The account's trainings, {"object": "list", "data": [...]}. |
GET /v1/voice-tunings/{id} | One training. |
DELETE /v1/voice-tunings/{id} | Cancels a training in progress or removes a finished one, deleting its recordings. The voice it made stays. |
When it is ready, speak with voice_id: put this id in voice, and nothing else in the request changes. GET /v1/voices lists professional voices with "tuned": true.
code | Meaning |
account_required | An account is needed; not available with demo access (403). |
consent_required | consent: true or biometric_consent: true was not sent. |
tuning_limit_reached | The account has 2 professional voices, or a training is already running (409). |
source_too_shortsource_too_long | The recordings hold under 60 or over 300 seconds of speech. |
verification_failed | The reading did not match the sentence; a new one was issued. |
curl
# your trainings
curl https://voice.patientdesk.ai/v1/voice-tunings -H "Authorization: Bearer pd_live_..."
# one training
curl https://voice.patientdesk.ai/v1/voice-tunings/{id} -H "Authorization: Bearer pd_live_..."
# cancel or remove it
curl -X DELETE https://voice.patientdesk.ai/v1/voice-tunings/{id} -H "Authorization: Bearer pd_live_..."
The training object
{
"id": "7c1e0b52-3f4a-4d1e-9a51-2b8f6c0d9e11",
"object": "voice_tuning",
"name": "Sesim (profesyonel)",
"status": "ready",
"source_seconds": 212.4,
"speech_seconds": 188.1,
"challenge": null,
"verification": { "passed": true, "heard": "…" },
"metrics": {
"zero_shot": { "similarity": 0.64, "cer": 0.024 },
"tuned": { "similarity": 0.71, "cer": 0.019 }
},
"error": null,
"voice_id": "5b0f8a8e-1d2c-4f7a-8f3e-6a9b2c4d1e07",
"created_at": 1759651200,
"updated_at": 1759652940,
"finished_at": 1759652940
}
