# Examples

Runnable Node.js recipes for the patientdesk-sdk. No npm dependencies. The only
external tool is `ffmpeg` (and `ffplay`, which ships with it) for recording and
playback.

```sh
export PATIENDESK_API_KEY="pd_live_..."   # PowerShell: $env:PATIENDESK_API_KEY="pd_live_..."
```

Install ffmpeg if you do not have it:

- Windows: `winget install Gyan.FFmpeg`
- macOS: `brew install ffmpeg`
- Debian or Ubuntu: `sudo apt install ffmpeg`

| File | What it does |
| --- | --- |
| `tts.mjs` | Speak text with Alania, save it, and play it. `--stream` pipes PCM to ffplay for low latency. |
| `stt-file.mjs` | Transcribe an audio file with Duyu, with `verbose_json`, `srt` and `vtt` modes. |
| `stt-mic.mjs` | Record N seconds from the microphone with ffmpeg, then transcribe it. |
| `stt-live.mjs` | Stream the microphone to Duyu over WebSocket and print live transcripts. |

## Text to speech

```sh
node examples/tts.mjs "Randevunuz yarın saat 14:05 için oluşturuldu."
node examples/tts.mjs "Hello" --format mp3 --out hello.mp3
node examples/tts.mjs "Low latency" --stream   # plays while it downloads
```

## Speech to text

```sh
node examples/stt-file.mjs kayit.m4a
node examples/stt-file.mjs kayit.wav --verbose
node examples/stt-file.mjs interview.mp3 --format srt > interview.srt

node examples/stt-mic.mjs 5
node examples/stt-mic.mjs 5 --keep --play --out kayit.wav

node examples/stt-live.mjs 10
```

## Notes

- Audio capture uses the default microphone. On Windows DirectShow needs a device
  name, which `audio.mjs` discovers automatically. Override it with
  `--device "<name>"`.
- `stt-live.mjs` needs a global `WebSocket` (Node 22+) or a `WebSocket`
  implementation passed to the client.
- These scripts import `patientdesk-sdk`. From a clone, run `npm run build` first
  so `dist/` exists. When installed from npm, they work as is.
- The WebSocket streaming endpoint is undocumented, so `stt-live.mjs` is
  experimental. See the [Streaming guide](../docs/md/streaming.md).
