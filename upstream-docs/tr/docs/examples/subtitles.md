# Videoya altyazı
Ses kanalını ffmpeg ile çıkarın, Duyu’dan srt isteyin ve altyazıyı videoya ekleyin.
## 1 · Sesten altyazıya
Duyu en fazla 100 MB ve 2 saatlik dosya alır. Videonun kendisini göndermek yerine ses kanalını mono, 16 kHz Opus olarak çıkarın: iki saatlik bir kayıt bile 30 MB’ın altında kalır.
# 1 · the audio track: mono, 16 kHz Opus keeps two hours under 100 MB
ffmpeg -i video.mp4 -vn -ac 1 -ar 16000 -c:a libopus -b:a 32k ses.ogg
# 2 · subtitles from Duyu (prompt: names it should spell your way)
curl https://voice.patientdesk.ai/v1/audio/transcriptions \
-H "Authorization: Bearer pd_live_..." \
-F file=@ses.ogg \
-F response_format=srt \
-F prompt="PatientDesk, Alania, Duyu" \
-o video.srt
prompt alanına videoda geçen özel adları yazın; Duyu onları sizin yazdığınız gibi yazar. Altyazı satırları cümle sınırlarını izler ve en fazla 2 satır, 42 karakter olacak biçimde bölünür.
## 2 · Videoya eklemek
Açılıp kapatılabilen bir altyazı kanalı için mov_text kullanın. Sosyal medya için altyazıyı görüntünün üstüne yakın.
shell
# a subtitle track viewers can switch on and off
ffmpeg -i video.mp4 -i video.srt -c copy -c:s mov_text \
-metadata:s:s:0 language=tur video-altyazili.mp4
# or burned into the picture, for social media
ffmpeg -i video.mp4 -vf subtitles=video.srt -c:a copy video-yazili.mp4
## Web’de
Tarayıcının kendi video oynatıcısı için response_format=vtt isteyin ve dosyayı bir <track> ile bağlayın.
HTML
<!-- response_format=vtt gives WebVTT for the browser's own player -->
<video controls src="video.mp4">
<track kind="subtitles" srclang="tr" label="Türkçe" src="video.vtt" default />
</video>
