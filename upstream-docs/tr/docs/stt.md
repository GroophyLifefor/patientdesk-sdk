# Transcription
Send an audio file, get the text. Same contract as OpenAI audio/transcriptions; your existing Whisper client works unchanged.
POSThttps://voice.patientdesk.ai/v1/audio/transcriptions Try it
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@kayit.m4a \
-F response_format=json
## Form fields
Send multipart/form-data. wav, mp3, m4a, webm, ogg and flac are accepted. Files longer than 30 s are split and re-joined automatically.
filefilerequired
The audio file. Up to 100 MB and 2 hours.
modelstring
duyu-1. whisper-1 is accepted for compatibility.
Defaultduyu-1
language"tr" | "auto"
The language spoken.
Defaulttr
promptstring
Spelling and vocabulary hint: drug names, person names, ID numbers. The model prefers these spellings.
response_formatstring
json, text, verbose_json, srt, vtt. See Output formats.
Defaultjson
timestamp_granularities[]string[]
segment and/or word; only with verbose_json.
temperaturenumber
0–1.
Default0
## Response
{ "text": "Merhaba, ben Ayşe Yılmaz. Sipariş numaram CNB123." }
