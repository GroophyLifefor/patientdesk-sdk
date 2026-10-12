# Narrating a long text
Turn an article or a book chapter into one audio file: split the text into 5,000-character parts, ask for raw PCM, and write a single WAV.
One request takes up to 5,000 characters. Split longer text at sentence boundaries and request each part with response_format: "pcm": headerless samples join end to end into one seamless file.
## The script
The script reads makale.txt, packs sentences into parts of at most 5,000 characters, speaks each with the alania2-m1 voice and writes everything to makale.wav, with a 0.4-second pause between parts.
narrate.py
# narrate.py — pip install requests
import re
import wave
import requests
API = "https://voice.patientdesk.ai/v1/audio/speech"
KEY = "pd_live_..."
LIMIT = 5000 # characters per request
RATE = 48000 # Alania-2 speaks at 48 kHz
def parts(text, limit=LIMIT):
"""Whole sentences, packed into requests of at most `limit` characters."""
sentences = re.split(r"(?<=[.!?…])\s+", " ".join(text.split()))
buf = ""
for s in sentences:
if buf and len(buf) + 1 + len(s) > limit:
yield buf
buf = s
else:
buf = f"{buf} {s}" if buf else s
if buf:
yield buf
with open("makale.txt", encoding="utf-8") as f:
text = f.read()
with wave.open("makale.wav", "wb") as out:
out.setnchannels(1)
out.setsampwidth(2) # PCM16
out.setframerate(RATE)
for i, part in enumerate(parts(text), 1):
r = requests.post(
API,
headers={"Authorization": f"Bearer {KEY}"},
json={
"model": "alania-v2",
"voice": "alania2-m1",
"input": part,
"response_format": "pcm", # raw samples: parts join without headers
"seed": 7, # the same file every time you run it
},
timeout=600,
)
r.raise_for_status()
out.writeframes(r.content)
out.writeframes(b"\0\0" * int(RATE * 0.4)) # a short pause between parts
print(f"part {i}: {len(part)} characters, {len(r.content) / (RATE * 2):.1f} s")
## Running it
For a smaller file for the web or a podcast feed, convert the WAV to MP3 with ffmpeg. Alania can return mp3 directly too, but for one file joined from parts, PCM is cleaner.
shell
python narrate.py
# part 1: 4987 characters, 312.4 s
# part 2: 2210 characters, 140.9 s
# a smaller file for the web or a podcast feed
ffmpeg -i makale.wav -codec:a libmp3lame -b:a 96k makale.mp3
## Names and terms
If the text has foreign terms, add pronunciations to each request or save them once to your account's dictionary. Numbers, dates and amounts are already read as spoken.
Request body
{
"model": "alania-v2",
"voice": "alania2-m1",
"input": "…",
"response_format": "pcm",
"pronunciations": { "Kubernetes": "Kubernetis", "PostgreSQL": "Postgres Kiyuel" }
}
