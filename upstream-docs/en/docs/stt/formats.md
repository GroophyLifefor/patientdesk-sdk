# Output formats
Same call, different response_format: plain text for dictation, word timestamps for archives, subtitles for video.
response_format | Content | Content-Type |
json | text only. | application/json |
text | Plain text with a trailing newline. | text/plain |
verbose_json | text, language, duration, segments[], and words[] on request. | application/json |
srt | SubRip subtitles. | text/plain |
vtt | WebVTT subtitles. | text/vtt |
## verbose_json
segments[]object[]
id, start, end, text. Sentence-level timing.
words[]object[]
word, start, end, probability. With timestamp_granularities[]=word.
durationnumber
Audio length in seconds. This is the billed duration.
verbose_json
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@toplanti.mp3 \
-F response_format=verbose_json \
-F "timestamp_granularities[]=word"
{
"task": "transcribe", "language": "tr", "duration": 512.4,
"text": "Merhaba, ben Ayşe Yılmaz. Sipariş numaram CNB123...",
"segments": [{ "id": 0, "start": 0.0, "end": 4.2, "text": "Merhaba, ben Ayşe Yılmaz." }, ...],
"words": [{ "word": "Merhaba,", "start": 0.0, "end": 0.6, "probability": 0.98 }, ...]
}
## Subtitles
Subtitle cues follow segment boundaries and are wrapped to at most 42 characters and 2 lines.
srt
1
00:00:00,420 --> 00:00:03,100
Yarın saat on dörtteki randevumu on altıya alabilir miyiz?
2
00:00:03,600 --> 00:00:05,020
Tabii, hemen bakıyorum.
