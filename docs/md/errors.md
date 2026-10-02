# Errors

Every non-2xx response, and every transport failure the client wraps, throws a
`PatientDeskError`. It carries the parsed PatientDesk error shape plus the
rate-limit fields, so you can schedule a retry from `resetsAt`.

## Catching

```ts
import { PatientDeskError } from "patientdesk-sdk";

try {
  await pd.speech.create({ input: "x" });
} catch (err) {
  if (err instanceof PatientDeskError) {
    console.error(err.status, err.code, err.message);
    if (err.isRateLimit) {
      console.log(`quota (${err.scope}) resets at ${err.resetsAt}`);
    }
  }
}
```

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `number` | HTTP status. `0` for a transport or timeout failure. |
| `code` | `string \| undefined` | e.g. `rate_limit_error`, `model_retired`. |
| `body` | `unknown` | Parsed error body, when it was JSON. |
| `reason` | `string \| undefined` | `error.details.reason`. |
| `scope` | `string \| undefined` | `user` or `pool`. |
| `retryAfterSeconds` | `number \| undefined` | From `Retry-After` or `details`. |
| `resetAt` | `string \| undefined` | ISO time from `error.details.resetAt`. |
| `isRateLimit` | `boolean` (getter) | `true` when `status === 429`. |
| `resetsAt` | `Date \| null` (getter) | `resetAt`, or now plus `retryAfterSeconds`. |

`resetsAt` returns a `Date` when the server gave either a reset time or a retry
delay, and `null` otherwise.

## Local validation errors

These throw before any request and are not `PatientDeskError`:

| Error | Cause |
| --- | --- |
| `TypeError` | Empty `input`, missing `audio`, empty audio, wrong audio type. |
| `RangeError` | `input` over 5,000 characters. |

Client construction errors are `PatientDeskError`:

| Code | Cause |
| --- | --- |
| `missing_api_key` | No key passed and no env var set. |
| `no_fetch` | No global `fetch` and none injected. |
| `no_websocket` | Streaming without a `WebSocket` implementation. |
| `no_base64` | No `btoa` or `Buffer` for the STT payload. |

## Retries and backoff

The client retries automatically on `408`, `409`, `425`, `429`, `500`, `502`,
`503`, `504`, and on network failures. Everything else `4xx` is returned at once.

- Default `maxRetries` is `2`, so up to 3 attempts.
- When a `Retry-After` header is present, the wait is capped at 30 seconds.
- Otherwise the delay grows exponentially, base `250 ms`, capped at `4 s`, with a
  small jitter.

A timeout aborts the request after `timeout` milliseconds, `120000` by default.
Set `timeout: 0` to disable it.

```ts
const pd = new PatientDesk({ apiKey, maxRetries: 0, timeout: 30_000 });
```

## Mapping the message

The message comes from `error.message` in the body, then falls back to
`PatientDesk HTTP <status>`. The code comes from `error.code`.

## Reading the body once

The error is built from a clone of the response, so the original body is left
untouched. The client never retries a non-retryable `4xx`.
