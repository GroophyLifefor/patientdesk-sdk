# Streaming
Start playing while the rest is still being generated: over HTTP with stream: true, or over one WebSocket connection for many sentences.
## HTTP streaming
With stream: true the body starts with a 44-byte WAV header, followed by raw PCM16 as it is generated: little-endian, mono, 48 kHz on Alania-2 and 24 kHz on Alania-1. The length of a stream is not known in advance, so the header's length fields are 0xFFFFFFFF.
- Streams accept wav, pcm, mulaw and alaw. pcm is raw samples without a header; the rate is in Content-Type: audio/L16; rate=48000. For phone lines see Telephony (8 kHz).
- Network chunks may split a sample: carry a leftover byte over to the next chunk.
- Long text is split at sentence boundaries, with 250 ms of silence between parts.
- x-audio-seconds is not sent on a stream: it is not known until the audio ends.
curl -N https://voice.patientdesk.ai/v1/audio/speech \
-H "Authorization: Bearer pd_live_..." \
-H "Content-Type: application/json" \
-d '{ "model": "alania-v2", "voice": "alania2-f1", "input": "Randevunuz oluşturuldu.", "stream": true }' \
| ffplay -autoexit -nodisp - # 48 kHz PCM16 as it is generated
## 48 kHz playback in the browser
The Browser tab of the HTTP streaming example schedules each chunk with Web Audio. What matters:
- Create buffers at the right rate: createBuffer(1, n, 48000). Read the rate from byte 24 of the WAV header, or from speech_start.sample_rate on a WebSocket; Alania-1 is 24 kHz.
- new AudioContext({ sampleRate: 48000 }) avoids needless resampling; if the device runs at another rate, the browser converts.
- Schedule each chunk at the end of the previous one; a 50 ms margin on the first avoids a stutter.
- An AudioContext only plays after a user gesture; start the request from a click.
## Latency
On Alania-2, a streamed request gets its first audio in about 190 ms (median, measured through the public API with the network included). What you measure depends on your network and distance to the servers. The x-queue-wait-ms header reports the time the request waited for a generation slot.
## WebSocket
WSSwss://voice.patientdesk.ai/v1/audio/speech/stream
For an application that speaks many sentences in a row, such as a voice agent, use one connection. Each speak message returns one audio stream and the connection stays open. Authenticate with ?key= or ?token=; ?model=alania-v1 makes Alania-1 the connection's default model. For a phone line, ?encoding=mulaw (or alaw) sends the audio as 8 kHz G.711; ?sample_rate=16000 and the like choose another rate.
WebSocket
const ws = new WebSocket("wss://voice.patientdesk.ai/v1/audio/speech/stream?key=pd_live_...");
ws.binaryType = "arraybuffer";
let rate = 48000;
ws.onmessage = (e) => {
if (e.data instanceof ArrayBuffer) return play(new Int16Array(e.data), rate); // PCM16 mono
const m = JSON.parse(e.data);
if (m.type === "ready") ws.send(JSON.stringify({
type: "speak",
model: "alania-v2",
voice: "alania2-f1",
input: "Randevunuz yarın saat 14:05 için oluşturuldu.",
}));
if (m.type === "speech_start") rate = m.sample_rate; // 48000 (24000 for alania-v1)
if (m.type === "speech_end") ws.send(JSON.stringify({ type: "stop" }));
if (m.type === "error") console.error(m.code, m.message);
};
### Messages you send
speakJSON
input is required. Every field of the HTTP body works: model, voice, instructions, voice_description, reference_audio (base64), reference_text, consent, cfg, temperature, seed, sample_rate; encoding (pcm_s16le, mulaw, alaw) overrides the connection's output for this message. Messages are handled in order, one at a time.
stopJSON
Answered with stopped, then the connection closes. close does the same.
### Messages you receive
readyJSON
model, voice, sample_rate, encoding, models, usage. The connection is ready; usage is your remaining allowance.
speech_startJSON
characters, model, voice, sample_rate, encoding (pcm_s16le, mulaw or alaw), disclosure. Arrives before the audio of each speak.
binaryPCM16 · G.711
Audio, mono: PCM16, or one byte a sample when encoding is mulaw/alaw. On Alania-2 messages are usually 0.16 seconds (7,680 samples at 48 kHz); the last one may be shorter.
speech_endJSON
audio_s, infer_ms. This speak is done.
stoppedJSON
The reply to stop.
errorJSON
message, code, category, retry_after. After an unknown message type the connection stays open; after any other error it closes.
Example message stream
{"type":"ready","model":"alania-v2","voice":"alania2-f1","sample_rate":48000,"encoding":"pcm_s16le","models":["alania-v1","alania-v2"],"usage":{"unit":"characters","used":1204,"quota":100000,"remaining":98796,"free":true,"free_until":null}}
{"type":"speech_start","characters":45,"model":"alania-v2","voice":"alania2-f1","sample_rate":48000,"encoding":"pcm_s16le","disclosure":"ai-generated"}
<binary PCM16 frames, 0.16 s each>
{"type":"speech_end","audio_s":3.2,"infer_ms":…}
{"type":"stopped"}
Error message
{"type":"error","message":"Cloning a voice needs `consent: true`: …","code":"consent_required","category":"invalid_request_error","retry_after":0}
## Compressed formats
For non-streaming requests response_format can be mp3, opus (Ogg), flac or aac, which saves bandwidth for mobile apps. They cannot be streamed: half a container file is not playable, so they are refused with a 400.
## Telephony (8 kHz)
A phone line carries 8 kHz G.711. response_format: "mulaw" (μ-law, North America and Japan) or "alaw" (A-law, Türkiye and Europe) returns audio in that form directly, headerless, one byte a sample; there is nothing to resample. It works on streams and on the WebSocket too.
- sample_rate picks another rate: 8000, 16000, 22050, 24000, 44100 or 48000 (up to the model's own). G.711 defaults to 8000, everything else to the model's rate. For example "response_format": "pcm", "sample_rate": 16000 gives 16 kHz PCM16.
- The conversion runs on the server as the audio is made and adds no time to the first audio. 8 kHz μ-law is 12 times less data than 48 kHz PCM16.
- Content-Type states the format and rate: audio/PCMU; rate=8000, audio/PCMA; rate=8000, audio/L16; rate=16000.
