# Testing

Testing is the point of this repository, so it is split in two suites on
purpose. One proves the SDK is correct with no key and no network. The other
proves it against the real service and names the faulty side when it breaks.

| Command | Needs key | Hits the network | Purpose |
| --- | --- | --- | --- |
| `npm test` | no | no | Unit and contract tests with a mock `fetch` and `WebSocket`. |
| `npm run full-test` | **yes** | **yes** | The unit suite, a preflight, then live tests. |

## Unit suite, `npm test`

Builds the package, then runs every file under `test/unit`. It injects a mock
`fetch` and a local WebSocket double, so it is deterministic and offline. It
covers:

- the client: auth headers, retries, backoff, timeouts and abort signals
- TTS: body building, format mapping, `createRaw`, input validation
- STT: base64 encoding, every `response_format`, format detection
- streaming: the `start` frame, binary sends, `final` handling, `stop()`
- errors: parsing, rate-limit fields, `resetsAt`
- status: indicators and descriptions
- down behavior: what happens when the service answers with an outage

## Preflight

`npm run full-test` runs `scripts/preflight.mjs` before any live call. It:

1. requires `PATIENDESK_API_KEY`, otherwise exits non-zero with the exact
   PowerShell or shell line to set it
2. calls `fetchStatus` and checks `isOperational`
3. writes `test/.live-enabled=1` only on success

If either check fails it writes `0`, prints one actionable message, and stops.
Live tests do not run. There is never a silent green.

```sh
# macOS / Linux
export PATIENDESK_API_KEY="pd_live_..."
npm run full-test

# Windows PowerShell
$env:PATIENDESK_API_KEY="pd_live_..."
npm run full-test
```

## Deciding is it us or is it PatientDesk

Live failures are classified by fault party:

- `SDK FAULT while ...`: the request was well formed, so the failure is ours.
- `PATIENDESK API FAULT while ...`: PatientDesk surfaced its own internal error,
  for example `undecodable_audio` for a valid file, or a bundled stack trace.

Both **fail the run by default**, but the message names the culprit. The
classifier lives in `helpers/live.mjs` and matches known upstream patterns such
as `unexpected keyword`, `not subscriptable` and `Line N`.

To keep a genuine outage from looking like a broken repository, downgrade API
faults to skipped. They are still printed, never hidden:

```sh
PATIENDESK_ALLOW_API_FAULTS=1 npm run full-test
```

## Fixtures

Test fixtures under `test/fixtures/` are real Turkish speech generated with
Alania, converted with `ffmpeg` into `wav`, `m4a`, `mp3`, `ogg`, `webm`, `flac`
and 16 kHz raw PCM, plus a deliberately truncated WAV for the decode-error path.

```sh
npm run fixtures
```

The script uses `PATIENDESK_API_KEY` when it is set. Without a key it writes a
synthetic tone so the offline layout is still complete, and it says so.

## Live suites

The live tests under `test/live/` cover TTS, STT over REST, and the WebSocket
stream. They read the `.live-enabled` flag, so running them directly without
preflight skips rather than fails.

## Adding a test

Put offline tests in `test/unit` and import the built package from `dist`. Put
live tests in `test/live` and wrap the body with `guard(t, context, fn)` from
`helpers/live.mjs` so a service fault is attributed, not blamed on the SDK.
