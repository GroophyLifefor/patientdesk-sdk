# Subtitles for a video
Pull the audio track out with ffmpeg, ask Duyu for srt, and attach the subtitles to the video.
## 1 · From audio to subtitles
Duyu takes files up to 100 MB and 2 hours. Instead of sending the video, extract the audio as mono 16 kHz Opus: even two hours stay under 30 MB.
# 1 · the audio track: mono, 16 kHz Opus keeps two hours under 100 MB
ffmpeg -i video.mp4 -vn -ac 1 -ar 16000 -c:a libopus -b:a 32k ses.ogg
# 2 · subtitles from Duyu (prompt: names it should spell your way)
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@ses.ogg \
-F response_format=srt \
-F prompt="PatientDesk, Alania, Duyu" \
-o video.srt
Put the names that appear in the video in prompt, and Duyu spells them your way. Cues follow sentence boundaries and wrap to at most 2 lines of 42 characters.
## 2 · Attaching to the video
Use mov_text for a subtitle track viewers can switch on and off. For social media, burn the subtitles into the picture.
shell
# a subtitle track viewers can switch on and off
ffmpeg -i video.mp4 -i video.srt -c copy -c:s mov_text \
-metadata:s:s:0 language=tur video-altyazili.mp4
# or burned into the picture, for social media
ffmpeg -i video.mp4 -vf subtitles=video.srt -c:a copy video-yazili.mp4
## On the web
For the browser's own video player, ask for response_format=vtt and link the file with a <track>.
HTML
<!-- response_format=vtt gives WebVTT for the browser's own player -->
<video controls src="video.mp4">
<track kind="subtitles" srclang="tr" label="Türkçe" src="video.vtt" default />
</video>
