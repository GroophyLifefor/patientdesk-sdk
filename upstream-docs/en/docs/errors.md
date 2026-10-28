# Errors and limits
Errors follow the OpenAI shape: error.message, error.type, error.code. Temporary errors come with a Retry-After header.
Branch on code in your program; message is written for people and may change. On WebSockets the same information arrives in an error message.
HTTP
HTTP/1.1 400 Bad Request
content-type: application/json
{
"error": {
"message": "`voice_description` designs a new voice; it cannot be combined with `reference_audio`.",
"type": "invalid_request_error",
"code": "conflicting_fields"
}
}
## Common codes
Status | code | Meaning |
400 | invalid_requestinvalid_json | The body could not be parsed or a field is invalid; the message names the field. |
401 | missing_api_keyinvalid_api_key | No key, or an invalid or revoked key. |
401 | invalid_tokentoken_expired | The session token is invalid or has expired. |
401 | auth_unavailable | Authentication is temporarily unavailable; retry. |
402 | insufficient_balance | Your credit is used up. Add credit or turn on automatic top-up; Antalia-2 Mini keeps working. |
429 | quota_exceeded | The monthly ceiling is used up (it guards against abuse; write to us to raise it). |
429 | rate_limit_exceeded | The per-minute request limit or the concurrency limit was reached. Retry-After is in seconds. |
503 | model_loadingserver_busyhigh_demand | Temporary; retry after Retry-After. |
## Retrying
429 and 503 are temporary: wait for the time in Retry-After and send the same request again. quota_exceeded and 402 insufficient_balance do not clear by waiting. A 400-range error points at the request itself; fix it instead of retrying.
A client that retries
import time
import requests
API = "https://voice.patientdesk.ai/v1/audio/speech"
AUTH = {"Authorization": "Bearer pd_live_..."}
def speak(body, tries=5):
for attempt in range(tries):
r = requests.post(API, headers=AUTH, json=body, timeout=120)
if r.ok:
return r.content
err = r.json().get("error", {}) if "json" in r.headers.get("content-type", "") else {}
if r.status_code not in (429, 502, 503) or err.get("code") == "quota_exceeded":
r.raise_for_status() # a 4xx will not fix itself: fix the request
time.sleep(float(r.headers.get("Retry-After", 2 ** attempt)))
raise RuntimeError("still failing after retries")
## Alania
Status | code | Meaning |
400 | input_too_long | input is over 5,000 characters. |
400 | unknown_model | model is not recognised. Valid: alania-v2, alania-v1. |
400 | unknown_voice | The voice does not exist on this model; the message lists the valid ones. |
400 | conflicting_fields | Fields that cannot be combined: voice_description with instructions, style or reference_audio; style with instructions; instructions with a leading (…). |
400 | unknown_styleinvalid_style | style is not one of the ready styles; the message lists the valid ids (GET /v1/styles). |
400 | seed_required | A designed voice was sent to be saved without its seed. |
422 | design_unusable | The design to be saved did not render cleanly (it read its description or garbled the text); try another seed. |
400 | consent_required | A recording was sent (reference_audio, or POST /v1/voices) without consent: true. |
400 | unsupported_field | An Alania-2 field was sent with alania-v1. |
400 | invalid_instructionsinvalid_voice_description | Over 200 characters, not a string, or contains parentheses. |
400 | invalid_referencereference_too_shortreference_too_longreference_too_large | The cloning recording (in a request or to POST /v1/voices) could not be decoded, is outside 3–30 seconds, or is over 10 MB. |
403 | account_required | Saving a voice or a pronunciation needs an account API key; a demo session cannot save them. |
404 | unknown_voice | No saved voice has the id in voice or /v1/voices/{id}: it was deleted or belongs to another account. |
409 | voice_limit_reached | The account already holds 50 saved voices. Delete one to add another. |
503 | design_save_unavailable | Saving designed voices is temporarily unavailable; clones are not affected. |
400 | invalid_pronunciations | The pronunciations field or the POST /v1/pronunciations body is invalid. See Pronunciation dictionary. |
404 | unknown_pronunciation | No entry has the id in /v1/pronunciations/{id}. |
409 | pronunciation_limit_reached | The account already holds 500 pronunciations. Delete one to add another. |
503 | pronunciation_store_unavailable | The pronunciation dictionary is temporarily unavailable; retry. |
502 | engine_error | The audio could not be generated. Retry; if it persists, write to us with the x-request-id. |
503 | model_loading | The model is starting (Retry-After: 10). The other model may keep answering meanwhile. |
## Duyu
Status | code | Meaning |
400 | missing_fileempty_audio | No file field, or the audio is empty. |
400 | undecodable_audio | The file could not be decoded as audio. |
400 | bad_response_formatbad_temperature | response_format or temperature is invalid. |
404 | model_not_found | model is not duyu-1 or whisper-1. |
413 | file_too_largeaudio_too_long | The 100 MB or 2 hour limit was exceeded. |
## Limits
These are the default limits. We raise the concurrent request and stream limits per account, for example for a phone line whose calls cluster at the same hour. Write to sezgin@patientdesk.ai with your peak numbers.
Limit | Value |
Requests per minute (per key, each product) | 600 |
Alania · text length | 5,000 characters |
Alania · instructions, voice_description | 200 characters |
Alania · cloning recording | 3–30 seconds, 10 MB |
Alania · saved voices (per account) | 50 |
Alania · concurrent requests / WebSockets (per key) | 8 / 4 |
Duyu · file size / length | 100 MB / 2 hours |
Duyu · concurrent requests / streams (per key) | 3 / 2 |
Session token lifetime | 10 minutes |
## Service status
Live status, 90-day uptime and incident history are at status.patientdesk.ai. The checks run every minute from outside our infrastructure, and every two minutes they transcribe a real Turkish clip and synthesize a sentence. To wire our status into your own monitoring, use the Statuspage-compatible JSON endpoint.
Alania's own health endpoint reports each model separately. While one model is starting, status is degraded and requests for that model get model_loading.
GEThttps://voice.patientdesk.ai/health/alania
curl
curl https://status.patientdesk.ai/api/v2/status.json
JSON
{
"status": "ok",
"service": "tts",
"model": "alania-v2",
"models": {
"alania-v1": { "status": "ok", "sample_rate": 24000, "default": false },
"alania-v2": { "status": "ok", "sample_rate": 48000, "default": true },
"antalia-mini": { "status": "ok", "sample_rate": 48000, "default": false }
},
"limits_degraded": false
}
