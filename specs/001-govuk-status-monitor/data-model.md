# Data Model

This document describes the key data entities for the GOV.UK Public Services Status Monitor.

## Service

Represents a public service or infrastructure component being monitored.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | The display name of the service. Must be unique. Max 100 ASCII characters. |
| `protocol` | string | The protocol to use for the health check (HTTP or HTTPS). |
| `method` | string | The HTTP method to use (GET, HEAD, or POST). |
| `resource` | string | The URL of the service to check. |
| `tags` | array | An array of strings for categorizing the service. ASCII only, lowercase, max 100 chars. |
| `expected` | object | An object defining the expected validation criteria. See **Expected Validation**. |
| `headers` | array | An array of objects for custom request headers. |
| `payload` | object | A JSON object for the POST request body. |
| `interval` | number | The interval in seconds between health checks. Defaults to 60. |
| `warning_threshold` | number | The latency in seconds to consider the service 'DEGRADED'. Defaults to 2. |
| `timeout` | number | The timeout in seconds for the health check. Defaults to 5. |

## Health Check Result

Represents the outcome of a single monitoring probe execution.

| Field | Type | Description |
| :--- | :--- | :--- |
| `service_name` | string | The name of the service that was checked. |
| `timestamp` | string | The ISO 8601 timestamp of when the check was performed. |
| `status` | string | The result of the health check. Can be `PASS`, `DEGRADED`, `FAIL`, or `THROTTLED`. |
| `latency_ms` | number | The response latency in milliseconds. |
| `http_status_code` | number | The HTTP status code received from the service. |
| `failure_reason` | string | A description of why the check failed, if applicable. |
| `correlation_id` | string | A UUID (v4) to correlate with logs. |

## Tag

Represents a category label displayed with each service for visual identification.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | The name of the tag. ASCII only, lowercase, max 100 chars. |

## Expected Validation

Represents criteria for determining service health.

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | number | The expected HTTP status code. |
| `text` | string | An optional substring to search for in the response body. |
| `headers` | object | An optional object of expected response headers (e.g., `Location`). |

## Configuration

Represents the complete monitoring setup defined in `config.yaml`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `settings` | object | Global settings for check intervals, timeouts, etc. |
| `pings` | array | An array of **Service** objects. |

## Historical Record

Represents a time-series data record for service health stored in `history.csv`. This has the same structure as **Health Check Result**.