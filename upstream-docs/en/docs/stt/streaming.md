# Live streaming
Send raw PCM from a microphone or phone line; each utterance arrives as a final shortly after silence.
WSSwss://voice.patientdesk.ai/v1/audio/stream Try it
WebSocket
const ws = new WebSocket("wss://voice.patientdesk.ai/v1/audio/stream?key=pd_live_...");
ws.onopen = () => ws.send(JSON.stringify({ type: "start", sampleRate: 48000 }));
// then: ws.send(int16PcmChunk.buffer) for every ~40 ms of microphone audio
ws.onmessage = (e) => {
const m = JSON.parse(e.data);
if (m.type === "final") console.log(m.start, m.end, m.text);
};
// when done: ws.send(JSON.stringify({ type: "stop" }))
## Protocol
- Open the connection and send {"type":"start","sampleRate":16000}. Optional: partials: true, partial_ms, eager_final: true, min_silence_ms.
- Send a raw Int16 PCM chunk every 40–100 ms (binary message). The server resamples; the 8 kHz telephone band is supported.
- Read events as JSON. When done, send {"type":"stop"}; the open utterance closes as a final and stopped follows.
## Events
readyevent
model, quota.remaining_s. The connection is ready.
vadevent
prob, active. About every 100 ms, and immediately when active flips. Use it for a level meter.
segment_startevent
Speech started (start).
partialevent
Draft of the utterance in progress; only with partials: true, every partial_ms.
segment_endevent
Speech ended (end). A final follows.
finalevent
text, start, end, audio_s, infer_ms, rtf. The definitive text of the utterance.
stoppedevent
All utterances decoded; audio_s is the billed duration.
errorevent
message, code.
Example event stream
{"type":"ready","model":"duyu-1","quota":{"remaining_s":7130}}
{"type":"vad","prob":0.91,"active":true}
{"type":"segment_start","start":0.42}
{"type":"partial","text":"Yarın saat"}
{"type":"partial","text":"Yarın saat on dörtteki"}
{"type":"segment_end","end":3.10}
{"type":"final","text":"Yarın saat on dörtteki randevumu on altıya alabilir miyiz?","start":0.42,"end":3.10,"audio_s":2.68,"infer_ms":118,"rtf":0.04}
{"type":"stopped","audio_s":2.68}
## Turn taking
A final arrives after 500 ms of silence. With eager_final: true the model may commit the utterance before the silence threshold, moving a voice agent's reply about 120 ms earlier. No external VAD is needed: vad and segment_* events come from the model itself.
Set it per connection with min_silence_ms in the start message: 200–2000 ms; a value outside that range returns a bad_request error. A shorter silence answers sooner, but it also treats pauses inside a sentence as the end: on Turkish speech, 250 ms split a sentence in the middle. For phone calls, start at 400–500 ms and measure on your own calls. eager_final starts its decode at a 400 ms pause, so it gains nothing with a min_silence_ms of 400 or less.
