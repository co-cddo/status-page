# Data Contracts

This directory contains the data contracts for the machine-readable outputs of the GOV.UK Public Services Status Monitor.

## `status.json`

The `status.json` file provides the current status of all monitored services. The OpenAPI specification for this file is defined in `status-api.openapi.yaml`.

## `history.csv`

The `history.csv` file provides a historical log of all health check results. The file is a standard CSV with the following columns:

| Column | Description |
| :--- | :--- |
| `timestamp` | The ISO 8601 timestamp of when the check was performed. |
| `service_name` | The name of the service that was checked. |
| `status` | The result of the health check. Can be `PASS`, `DEGRADED`, `FAIL`, or `THROTTLED`. |
| `latency_ms` | The response latency in milliseconds. |
| `http_status_code` | The HTTP status code received from the service. |
| `failure_reason` | A description of why the check failed, if applicable. |
| `correlation_id` | A UUID (v4) to correlate with logs. |