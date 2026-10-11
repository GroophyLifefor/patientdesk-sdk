# Health and status

PatientDesk publishes a public Statuspage and an API health endpoint. The SDK
ships standalone helpers for both that take **no API key**, so a test run can
check service health before touching the paid endpoints.

## Statuspage

```
GET https://status.patientdesk.ai/api/v2/status.json
```

```ts
import { fetchStatus, isOperational, statusDescription } from "patientdesk-sdk";

const status = await fetchStatus();
console.log(statusDescription(status)); // "All Systems Operational"
if (!isOperational(status)) {
  throw new Error("PatientDesk is degraded, skipping live checks");
}
```

## API health

```
GET https://voice.patientdesk.ai/health/alania
```

Per-model status: a model is `degraded` while it is loading, and requests to it
answer `model_loading` until it is ready.

```ts
import { fetchAlaniaHealth } from "patientdesk-sdk";

const health = await fetchAlaniaHealth();
health.status;                          // "ok"
health.models?.["alania-v2"]?.status;   // "ok" | "degraded"
health.limits_degraded;                 // boolean
```

Pass `{ origin }` to point it at another host. Like `fetchStatus`, the helper
does not require a key.

## Functions

| Function | Returns | Notes |
| --- | --- | --- |
| `fetchStatus(options?)` | `Promise<StatusResponse>` | Fetches and parses the Statuspage summary. |
| `fetchAlaniaHealth(options?)` | `Promise<AlaniaHealthResponse>` | Fetches `/health/alania`. |
| `isOperational(status)` | `boolean` | `false` when the indicator is not `none`. |
| `statusDescription(status)` | `string` | The human summary, or `"unknown"`. |

`isOperational` treats `minor`, `major`, `critical` and `maintenance` as
degraded. A missing indicator returns `false`.

## Options

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `url` | `string` | the Statuspage endpoint | `fetchStatus` only: override the URL. |
| `origin` | `string` | `https://voice.patientdesk.ai` | `fetchAlaniaHealth` only: API origin. |
| `fetch` | `typeof fetch` | global `fetch` | Inject a fetch. |
| `timeout` | `number` | `10000` | Milliseconds. `0` disables. |
| `signal` | `AbortSignal` | unset | Cancel the request. |
| `retries` | `number` | `1` | Retries on network errors and 5xx. |

Unlike `PatientDesk.request`, these helpers do not wrap failures in
`PatientDeskError`. They throw the underlying error, which makes them easy to
call from a preflight script.

## Response shapes

Statuspage:

| Field | Type | Notes |
| --- | --- | --- |
| `status.indicator` | `string` | `none`, `minor`, `major`, `critical`, `maintenance`. |
| `status.description` | `string` | e.g. `All Systems Operational`. |
| `page.name` | `string` | The status page name. |
| `page.updated_at` | `string` | ISO time of the last update. |

`/health/alania`:

| Field | Type | Notes |
| --- | --- | --- |
| `status` | `string` | `ok` when the service is up. |
| `models` | `Record<string, { status, sample_rate, default }>` | Per-model status. |
| `limits_degraded` | `boolean` | Whether rate limits are relaxed/degraded. |

The full bodies are preserved, so any extra field is available.

## Using it as a preflight

`scripts/preflight.mjs` calls `fetchStatus`: it requires `PATIENDESK_API_KEY`,
checks the service, and stops the live suite with one message when the service is
not fully operational. See [Testing](testing.md).
