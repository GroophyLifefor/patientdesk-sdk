# Configuration

All client options are optional except the API key, which can come from the
environment.

## Constructor

```ts
import { PatientDesk } from "patientdesk-sdk";

const pd = new PatientDesk({
  apiKey: process.env.PATIENDESK_API_KEY,
  baseUrl: "https://voice.patientdesk.ai/v1",
  maxRetries: 2,
  timeout: 120_000,
  defaultHeaders: { "x-app": "my-clinic" },
});
```

## Options

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `apiKey` | `string` | `PATIENDESK_API_KEY`, then `PATIENDESK_KEY` | Required. Missing throws. |
| `baseUrl` | `string` | `https://voice.patientdesk.ai/v1` | Trailing slashes are trimmed. |
| `fetch` | `typeof fetch` | global `fetch` | Inject for tests or edge runtimes. |
| `WebSocket` | `WebSocketConstructor` | global `WebSocket` | Needed only for streaming STT. |
| `maxRetries` | `number` | `2` | Retries for 429, 5xx and network errors. |
| `timeout` | `number` | `120000` | Per-request milliseconds. `0` disables. |
| `defaultHeaders` | `Record<string, string>` | `{}` | Merged into every request. |

## Environment variables

| Variable | Read by | Notes |
| --- | --- | --- |
| `PATIENDESK_API_KEY` | `PatientDesk`, `full-test`, `fixtures` | Preferred key. |
| `PATIENDESK_KEY` | same | Fallback if the first is unset. |
| `PATIENDESK_BASE_URL` | live tests | Override the API base URL. |
| `PATIENDESK_ALLOW_API_FAULTS` | live tests | `1` downgrades PatientDesk faults to skipped. |

## Constants and exports

| Export | Value | Notes |
| --- | --- | --- |
| `DEFAULT_BASE_URL` | `https://voice.patientdesk.ai/v1` | |
| `DEFAULT_STATUS_URL` | `https://status.patientdesk.ai/api/v2/status.json` | |
| `RETRYABLE_STATUS` | a `ReadonlySet<number>` | `408, 409, 425, 429, 500, 502, 503, 504`. |
| `MAX_INPUT_CHARS` | `5000` | Alania input limit. |
| `MAX_AUDIO_BYTES` | `9 * 1024 * 1024` | Duyu audio limit. |
| `CONTENT_TYPE` | a format to MIME map | Used by `SpeechResponse.contentType`. |

## Custom `fetch`

Useful for logging, tests or a proxy. Any function with the `fetch` signature is
accepted.

```ts
const pd = new PatientDesk({
  apiKey,
  fetch: (input, init) => {
    console.log(input);
    return fetch(input, init);
  },
});
```

## Custom `WebSocket`

Node 18 through 21 have no global `WebSocket`. Inject one for streaming.

```ts
import WebSocket from "ws";

const pd = new PatientDesk({ apiKey, WebSocket });
```

## Edge runtimes

Because the SDK uses globals and has no dependencies, it runs on Cloudflare
Workers, Deno and Bun. Provide `apiKey` explicitly on runtimes without
`process.env`.
