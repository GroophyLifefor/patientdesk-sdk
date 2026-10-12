# Voice designPreview
Describe a voice in words with voice_description, and Alania-2 creates a new voice for that request. No recording needed.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"input": "Merhaba, siparişiniz yarın öğleden önce teslim edilecek.",
"voice_description": "A young man with a clear, energetic voice",
"seed": 42 }' \
--output tasarim.wav
A designed voice
-
## Writing a description
- Describe age, gender, timbre, pace and energy in a few words.
- Write it in Turkish or English. A description that is not in English is translated to English before it reaches the model.
- At most 200 characters. No parentheses.
- Examples: A young man with a clear, energetic voice · A calm middle-aged woman with a warm, low voice · tok sesli, yetmişlerinde bir dede (Turkish).
## Rules
- When voice_description is present, voice is ignored. The OpenAI SDKs always send voice, so this is deliberate.
- It cannot be combined with instructions or reference_audio (conflicting_fields).
- A designed voice is not saved on its own; you can save one you like. Every part of a long text is read in the same voice.
- To get the same result again, send a seed: the same seed, description and text give the same audio.
- The default cfg is 3.0 for design (2.0 otherwise); a higher value holds the voice closer to the description.
## Save a designed voice
Save a design you like to your account; after that each request names it by its id in voice, like a saved clone. Send the design request itself (voice_description, seed, input) and a name to POST /v1/voices. The server makes the design's first sentence again with the same seed, has Duyu listen to it, and keeps it as the voice's recording.
POSThttps://voice.patientdesk.ai/v1/voices
namestringrequired
The voice's name, at most 80 characters.
voice_descriptionstringrequired
The design's description, the same as when you rendered it.
seedintegerrequired
The seed that made the voice. The same description gives a different voice with every seed, so a design cannot be saved without one (seed_required). The Studio picks and keeps a seed for every design.
inputstringrequired
The text the design read. What is kept is its first sentence (the part the design made); if that is under 3 seconds, a neutral passage in the same voice is added after it.
cfg · temperature · pronunciations
Send them if you rendered the design with them.
- No real person's voice is in a designed voice, so no consent is needed. The voice is marked source: "design" and its description is kept.
- Why it is made again from your request: in our measurements, a voice saved from the design you heard stayed clearly closer to it on new sentences, while a passage made from scratch with the same description and seed came out as a different voice.
- A saved design also takes instructions and ready styles, and follows a clone's rules: the 50-voice limit, listing with GET /v1/voices, deleting with DELETE /v1/voices/{id}.
- If the remade voice reads its description aloud or garbles the text, it is not saved (design_unusable, 422): render the design again with another seed and save that one.
curl
# 1 · design a voice, with a seed you keep
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice_description": "A warm, middle-aged woman with a low voice",
"seed": 4242,
"input": "Merhaba, randevunuzu yarın saat on dörde aldım." }' \
--output tasarim.wav
# 2 · liked it? save the same request as a voice
curl https://voice.patientdesk.ai/v1/voices \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "name": "Danışman",
"voice_description": "A warm, middle-aged woman with a low voice",
"seed": 4242,
"input": "Merhaba, randevunuzu yarın saat on dörde aldım." }'
Response
HTTP/1.1 201 Created
content-type: application/json
{
"id": "6f1c2a9e-4b7d-4e2a-9c51-3d8f0b2e7a14",
"object": "voice",
"name": "Danışman",
"transcript": "Merhaba, randevunuzu yarın saat on dörde aldım.",
"duration_s": 4.1,
"created_at": 1759651200,
"kind": "custom",
"tuned": false,
"source": "design",
"voice_description": "A warm, middle-aged woman with a low voice",
"warnings": [],
"quality": { "checked": true, "cer": 0.0 }
}
