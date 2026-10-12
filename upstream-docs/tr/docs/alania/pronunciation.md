# Pronunciation dictionary
Alania reads Turkish spelling. Tell it how to say brand names and foreign words once, on your account, or for a single request with the pronunciations field.
Alania-2 reads text the way it is spelled in Turkish, so English words and brand names are respelled the Turkish way before they are spoken: PatientDesk becomes “Peyşınt Desk”, ChatGPT “Çet Ci Pi Ti”. A reviewed list of common names and an automatic respeller already run on the server. Words that are yours, such as your clinic's name, doctors' names or drug brands, you add to the pronunciation dictionary.
term | say_as |
PatientDesk | Peyşınt Desk |
Ozempic | Ozempik |
Mayo Clinic | Meyo Klinik |
## Matching
- Whole words only: an entry for Desk does not change Desktop.
- Case does not matter: PatientDesk, patientdesk and PATIENTDESK all match the same entry.
- Terms can be several words: Mayo Clinic → Meyo Klinik.
- Turkish suffixes after an apostrophe are kept: PatientDesk'e → Peyşınt Desk'e, PatientDesk'in → Peyşınt Desk'in.
- An entry whose say_as is the same as its term means “read it as written, don't respell it”. Use it for a word the automatic respeller takes for a foreign one.
## Precedence
When a word appears in more than one place, the first one in this order wins:
- The request's pronunciations field.
- The pronunciation dictionary saved to your account.
- The reviewed built-in list on the server.
- The automatic respeller.
## The saved dictionary
The saved dictionary applies on its own to every speech request from the account, whether it comes with an API key or from the Studio. Your requests need nothing extra.
### List
GEThttps://voice.patientdesk.ai/v1/pronunciations
created_at is a Unix time in seconds.
Response
{
"object": "list",
"data": [
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "term": "PatientDesk", "say_as": "Peyşınt Desk", "created_at": 1759654800 },
{ "id": "7e0a3c51-2f64-4b8d-a1c9-5d2e8f4b6a03", "object": "pronunciation", "term": "Ozempic", "say_as": "Ozempik", "created_at": 1759651200 }
]
}
### Add or change
POSThttps://voice.patientdesk.ai/v1/pronunciations
termstringrequired
The word or words as they appear in text, 1–100 characters.
say_asstringrequired
How to say it, in Turkish letters, 1–200 characters. The same as term means the word is read as written.
A new word returns 201 Created. If the same word is already saved (ignoring case), its spelling is updated and the response is 200 OK; no duplicate is created.
Response
HTTP/1.1 201 Created
content-type: application/json
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "term": "PatientDesk", "say_as": "Peyşınt Desk", "created_at": 1759654800 }
### Delete
DELETEhttps://voice.patientdesk.ai/v1/pronunciations/{id}
Response
{ "id": "b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b", "object": "pronunciation", "deleted": true }
### Examples
# your saved list
curl https://voice.patientdesk.ai/v1/pronunciations -H "Authorization: Bearer pd_live_..."
# add a word, or change how a saved one is said
curl https://voice.patientdesk.ai/v1/pronunciations \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "term": "PatientDesk", "say_as": "Peyşınt Desk" }'
# delete one by its id
curl -X DELETE https://voice.patientdesk.ai/v1/pronunciations/b2d4e6f8-1a3c-4e5f-8a7b-9c0d1e2f3a4b -H "Authorization: Bearer pd_live_..."
## In one request
For words that belong to one request, add pronunciations to the POST /v1/audio/speech body. They apply to that request only and take precedence over the same words in the saved dictionary. Send an object ({"term": "say as"}) or an array of {term, say_as}.
In the developer panel's API console you can add pronunciations to a request and hear the result straight away.
curl https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
--output hosgeldiniz.wav \
--data-binary @- <<'JSON'
{
"model": "alania-v2",
"voice": "alania2-f1",
"input": "PatientDesk'e hoş geldiniz. Ozempic kullanıyorsanız lütfen belirtin.",
"pronunciations": { "PatientDesk": "Peyşınt Desk", "Ozempic": "Ozempik" }
}
JSON
Array form
"pronunciations": [
{ "term": "PatientDesk", "say_as": "Peyşınt Desk" },
{ "term": "Ozempic", "say_as": "Ozempik" }
]
## Limits
What | Limit |
pronunciations | At most 200 entries per request |
term | 1–100 characters |
say_as | 1–200 characters |
saved dictionary | At most 500 words per account; each word once (ignoring case) |
## Errors
Status | code | Meaning |
400 | invalid_pronunciations | pronunciations or the POST /v1/pronunciations body is invalid: the wrong shape, an empty or too-long term or say_as, or more than 200 entries. |
403 | account_required | Managing the dictionary needs an account; a demo session cannot save words. Demo requests can still send the pronunciations field. |
404 | unknown_pronunciation | No entry has the id in /v1/pronunciations/{id}: it was deleted or belongs to another account. |
409 | pronunciation_limit_reached | The account already holds 500 words. Delete one to add another. |
503 | pronunciation_store_unavailable | The dictionary cannot be read or written right now; retry shortly. |
