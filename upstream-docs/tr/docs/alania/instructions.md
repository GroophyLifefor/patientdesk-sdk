# Style instructionsPreview
Tell a built-in voice how to speak with one short sentence in instructions. The voice stays the same; the delivery changes.
In the Python and Node OpenAI SDKs, instructions is a regular argument; nothing extra is needed.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"input": "Randevunuz yarın saat 14:05 için oluşturuldu.",
"voice": "alania2-f1",
"instructions": "speaking slowly and calmly" }' \
--output randevu.wav
With an instruction
-
-
## Writing instructions
- Describe the delivery: pace, loudness, pitch, emotion. The instruction is turned into an English description of the delivery in the form the model was trained on (“A woman speaks calmly, a little slower than usual…”); roles and stories (“like a calm nurse”, “as if telling a secret”) are reduced to the delivery alone.
- You can write in Turkish. An instruction in any language becomes that English description before it reaches the model. The text stays Turkish.
- Be concrete: pace, loudness, emotion, setting.
- At most 200 characters. No parentheses.
- If a result begins with the instruction read aloud, it is generated again. In a stream (stream: true or the WebSocket), the opening seconds of an instruction longer than 40 characters are held back until they have been heard and checked, which adds about 0.4 seconds to the first audio. Short instructions start at once.
Example instruction | When |
Whisper. | Quiet settings, night-time notices |
speak like a calm nurse | Patient calls, test results |
speaking slowly and calmly | Appointment reminders, directions |
cheerful and upbeat | Greetings |
in a serious, formal tone | Formal announcements |
## Ready styles
Ready styles we chose by measurement for call centers: instead of writing an instruction, send one's id in style. Each maps to a description of the delivery that the model was trained on word for word; it is never translated or rewritten, and it never holds back the start of a stream.
style | When |
support-warm | Everyday customer service: warm and friendly. |
support-calm | Complaints, waits, bad news: calm and reassuring. |
sales-energetic | Campaigns and offers: lively and upbeat. |
reception-smile | Greetings and bookings: bright and welcoming. |
apologetic | Delays, mistakes, apologies: sincere and sorry. |
empathetic | Patient calls, difficult news: gentle and understanding. |
slow | Older callers, numbers, addresses: much slower and clear. |
fast | Notices and disclaimers: much faster. |
whisper | Quiet settings, night-time notices: hushed and breathy. |
- Works with the built-in voices, the beta voices, saved voices and clones. Not with voice_description.
- It cannot be sent with instructions or a leading (…) (conflicting_fields). An unknown id is refused with unknown_style; the message lists the valid ids.
- In our measurements (two voices, 12 styles, 10 call-center sentences) the styles clearly moved pace, pitch and energy the way they were asked to, did not add word errors, and the style was never read aloud. The voice stays closer to its own timbre than with the previous model, though it still shifts a little from the plain voice.
GEThttps://voice.patientdesk.ai/v1/styles
curl
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-f1",
"style": "support-warm",
"input": "Merhaba, Anadolu Sigorta’ya hoş geldiniz. Size nasıl yardımcı olabilirim?" }' \
--output karsilama.wav
Response
{
"object": "list",
"data": [
{ "id": "support-warm", "object": "style", "name": "Warm support",
"description": "Warm and friendly, for everyday customer service." },
{ "id": "support-calm", "object": "style", "name": "Calm support",
"description": "Calm and reassuring, for complaints, waits and bad news." },
{ "id": "sales-energetic", "object": "style", "name": "Energetic sales",
"description": "Lively and upbeat, for campaigns and offers." },
{ "id": "reception-smile", "object": "style", "name": "Smiling receptionist",
"description": "Bright and welcoming, for greetings and bookings." },
{ "id": "apologetic", "object": "style", "name": "Apologetic",
"description": "Sincere and sorry, for delays, mistakes and apologies." },
{ "id": "empathetic", "object": "style", "name": "Empathetic",
"description": "Gentle and understanding, for patient calls and difficult news." },
{ "id": "slow", "object": "style", "name": "Slow and clear",
"description": "Much slower and clear, for older callers, numbers and addresses." },
{ "id": "fast", "object": "style", "name": "Fast",
"description": "Much faster, for notices and disclaimers." },
{ "id": "whisper", "object": "style", "name": "Whisper",
"description": "Hushed and breathy, for quiet settings and night-time notices." }
]
}
## Instruction at the start of the text
Alania-2 reads a parenthesised phrase at the very start of input as the instruction. This helps with tools that can only send text.
curl
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2",
"voice": "alania2-m1",
"input": "(whispering softly) Bebek yeni uyudu, lütfen sessiz olalım." }' \
--output fisilti.wav
## With other fields
Together with | Result |
voice | The chosen built-in voice speaks as instructed. |
reference_audio | The cloned voice speaks as instructed. |
voice_description | Not allowed (conflicting_fields): the description already says how the voice speaks. |
style | Not allowed (conflicting_fields): either a ready style or your own instruction. |
model: "alania-v1" | Not allowed (unsupported_field). |
