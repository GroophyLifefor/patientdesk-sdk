# Health and status

PatientDesk publishes a public Statuspage. The SDK ships a standalone helper for
it that takes **no API key**, so a test run can check service health before
touching the paid endpoints.

## Endpoint

```
GET https://status.patientdesk.ai/api/v2/status.json
```

## Usage

```ts
import { fetchStatus, isOperational, statusDescription } from "patientdesk-sdk";

const status = await fetchStatus();
console.log(statusDescription(status)); // "All Systems Operational"
if (!isOperational(status)) {
  throw new Error("PatientDesk is degraded, skipping live checks");
}
```

## Functions

| Function | Returns | Notes |
| --- | --- | --- |
| `fetchStatus(options?)` | `Promise<StatusResponse>` | Fetches and parses the summary. |
| `isOperational(status)` | `boolean` | `false` when the indicator is not `none`. |
| `statusDescription(status)` | `string` | The human summary, or `"unknown"`. |

`isOperational` treats `minor`, `major`, `critical` and `maintenance` as
degraded. Anything else, including a missing indicator, returns `false` only for
a missing indicator.

## Options

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `url` | `string` | the endpoint above | Override the status endpoint. |
| `fetch` | `typeof fetch` | global `fetch` | Inject a fetch. |
| `timeout` | `number` | `10000` | Milliseconds. `0` disables. |
| `signal` | `AbortSignal` | unset | Cancel the request. |
| `retries` | `number` | `1` | Retries on network errors and 5xx. |

Unlike `PatientDesk.request`, this helper does not wrap failures in
`PatientDeskError`. It throws the underlying error, which makes it easy to call
from a preflight script.

## Response shape

| Field | Type | Notes |
| --- | --- | --- |
| `status.indicator` | `string` | `none`, `minor`, `major`, `critical`, `maintenance`. |
| `status.description` | `string` | e.g. `All Systems Operational`. |
| `page.name` | `string` | The status page name. |
| `page.updated_at` | `string` | ISO time of the last update. |

The full body is preserved, so any extra field Statuspage adds is available.

## Using it as a preflight

`scripts/preflight.mjs` does exactly this: it requires `PATIENDESK_API_KEY`, calls
`fetchStatus`, and stops the live suite with one message when the service is not
fully operational. See [Testing](testing.md).
