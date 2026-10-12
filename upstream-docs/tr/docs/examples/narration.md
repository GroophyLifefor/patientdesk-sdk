# Uzun bir metni seslendirmek
Bir makaleyi ya da kitap bölümünü tek bir ses dosyasına çevirin: metni 5.000 karakterlik parçalara bölün, ham PCM isteyin ve tek bir WAV yazın.
Tek bir istek en fazla 5.000 karakter alır. Daha uzun bir metni cümle sınırlarından parçalara ayırın ve her parçayı response_format: "pcm" ile isteyin: başlıksız örnekler arka arkaya eklenir ve ortaya tek, kesintisiz bir dosya çıkar.
## Betik
Betik makale.txt dosyasını okur, cümleleri 5.000 karakteri aşmayacak biçimde paketler, her parçayı alania2-m1 sesiyle seslendirir ve hepsini makale.wav dosyasına yazar. Parçalar arasına 0,4 saniyelik bir duraklama ekler.
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
## Çalıştırmak
Web ya da podcast için daha küçük bir dosya isterseniz WAV’ı ffmpeg ile MP3’e çevirin. Alania doğrudan mp3 de verebilir, ama parçalardan birleştirilen tek bir dosya için PCM daha temizdir.
shell
python narrate.py
# part 1: 4987 characters, 312.4 s
# part 2: 2210 characters, 140.9 s
# a smaller file for the web or a podcast feed
ffmpeg -i makale.wav -codec:a libmp3lame -b:a 96k makale.mp3
## Adlar ve terimler
Metinde yabancı terimler varsa her isteğe pronunciations ekleyin ya da bir kez hesabınızın sözlüğüne kaydedin. Sayılar, tarihler ve tutarlar zaten konuşulduğu gibi okunur.
İstek gövdesi
{
"model": "alania-v2",
"voice": "alania2-m1",
"input": "…",
"response_format": "pcm",
"pronunciations": { "Kubernetes": "Kubernetis", "PostgreSQL": "Postgres Kiyuel" }
}
