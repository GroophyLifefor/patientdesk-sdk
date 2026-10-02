# Troubleshooting

Every message below comes from a real path in the SDK or the test scripts. Start
here when something fails and the reason is not obvious.

## `Missing API key`

The client throws a `PatientDeskError` with code `missing_api_key` when neither
`apiKey` nor `PATIENDESK_API_KEY` nor `PATIENDESK_KEY` is set. Set the env var or
pass the key.

```ts
const pd = new PatientDesk({ apiKey: "pd_live_..." });
```

## `No global fetch found`

The runtime has no `fetch`. Pass one, or upgrade to Node 18+.

```ts
const pd = new PatientDesk({ apiKey, fetch: myFetch });
```

## `No WebSocket available`

Streaming needs a `WebSocket`. Node 18 through 21 do not ship one. Inject `ws`.

```ts
import WebSocket from "ws";
const pd = new PatientDesk({ apiKey, WebSocket });
```

## `input is N characters`

Alania accepts at most 5,000 characters. Split the text and join the audio, see
[Text to speech](text-to-speech.md#splitting-long-text).

## STT returns `undecodable_audio`

This is a server-side error. The request was well formed, PatientDesk could not
decode the audio. It has been seen for valid WAV, MP3 and M4A files, and it was
confirmed with a working key on a fully operational service, so it is not a sign
of a bad file, a bad key or a bad SDK. The live suite labels it
`PATIENDESK API FAULT`.

Two message shapes appear. One is `[Errno 1094995529] Invalid data found when
processing input: '<none>'`, the other is a Python error such as
`open() got an unexpected keyword argument 'metadata_errors'`. Both mean the
same thing: the decode step failed inside the service.

Check the service first with `fetchStatus`. If it is operational and the error
persists, it is on PatientDesk's side. The `full-test` run reports it as
`PATIENDESK API FAULT while transcribing ...` and can be downgraded to skipped
with `PATIENDESK_ALLOW_API_FAULTS=1` while the outage lasts.

## Streaming never becomes ready

The WebSocket endpoint uses a `token` query parameter, not `key`. With `key` the
socket connects but no `ready` frame ever arrives. With any other name the
service answers `missing_api_key`. This changed over time, so older clients that
still send `key` fail silently. See [Streaming](streaming.md#a-known-endpoint-change).

The handshake is also intermittently refused: a fresh socket sometimes closes
with code `1006` before `ready`, roughly one attempt in five. Retry two or three
times before treating it as a client bug.

When the connection is ready and you still get no `final`, check the audio. It
must be 16 kHz mono signed 16-bit little-endian PCM and contain speech. Silence,
tones or the wrong framing never produce a transcript.

## `429` rate limit

The client raises a `PatientDeskError` with `isRateLimit` true. Read `scope` to
see whether it is a `user` or `pool` limit, and `resetsAt` for the reset time.
The client already retried twice, honouring `Retry-After`. Back off until
`resetsAt`, then retry.

```ts
if (err instanceof PatientDeskError && err.isRateLimit) {
  await sleep(err.resetsAt!.getTime() - Date.now());
}
```

## Requests hang

A request times out after `timeout` milliseconds, `120000` by default. Lower it
when a long call is not expected:

```ts
const pd = new PatientDesk({ apiKey, timeout: 30_000 });
```

An already-aborted `AbortSignal` fails immediately instead of hanging, so
cancellation is safe at any point.

## `full-test` does not run

The preflight stopped it. Either the key is missing, or the Statuspage is not
fully operational. The message names which. Unit tests still run with
`npm test`. If the service is degraded, retry later, or set
`PATIENDESK_ALLOW_API_FAULTS=1` to downgrade API faults to skipped.

## Live tests fail with `SDK FAULT`

That is a genuine bug in this repository. Read the context after `while`, which
names the operation, and open an issue with the full output. Do not set
`PATIENDESK_ALLOW_API_FAULTS` to hide it: that flag only affects API faults.

## Docs do not build

`npm run docs:build` needs the `marked` dev dependency. Run `npm install` first.
The generated HTML, `search-index.json`, `llms.txt`, `llms-full.txt` and
`sitemap.xml` are written under `docs/`.
