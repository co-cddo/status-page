# Data Model: GOV.UK Status Monitor

**Feature**: 001-govuk-status-monitor
**Date**: 2025-10-21
**Specification**: [spec.md](./spec.md)

## Overview

This document defines the core data entities, their attributes, relationships, validation rules, and state transitions for the GOV.UK Public Services Status Monitor application.

## Entity Diagrams

```
┌─────────────────────┐
│   Configuration     │
│─────────────────────│
│ + settings          │──┐
│ + pings[]           │  │
└─────────────────────┘  │
                         │ contains
                         ▼
                    ┌─────────────────────┐
                    │   Service/Ping      │
                    │─────────────────────│
                    │ + name              │
                    │ + protocol          │
                    │ + method            │──┐
                    │ + resource          │  │
                    │ + tags[]            │  │ validates against
                    │ + expected          │  │
                    │ + headers[]         │  ▼
                    │ + payload           │  ┌──────────────────────┐
                    │ + interval          │  │ ExpectedValidation   │
                    │ + warning_threshold │  │──────────────────────│
                    │ + timeout           │  │ + status             │
                    │ + currentStatus     │  │ + text?              │
                    │ + lastCheckTime     │  │ + headers?           │
                    │ + lastLatency       │  └──────────────────────┘
                    └─────────────────────┘
                             │
                             │ produces
                             ▼
                    ┌─────────────────────┐
                    │  HealthCheckResult  │
                    │─────────────────────│
                    │ + serviceName       │
                    │ + timestamp         │
                    │ + method            │
                    │ + status            │──┐
                    │ + latency_ms        │  │
                    │ + http_status_code  │  │ becomes
                    │ + expected_status   │  │
                    │ + failure_reason    │  ▼
                    │ + correlation_id    │  ┌──────────────────────┐
                    └─────────────────────┘  │  HistoricalRecord    │
                             │                │──────────────────────│
                             │ aggregated to  │ + timestamp          │
                             ▼                │ + service_name       │
                    ┌─────────────────────┐  │ + status             │
                    │      Tag            │  │ + latency_ms         │
                    │─────────────────────│  │ + http_status_code   │
                    │ + name              │  │ + failure_reason     │
                    └─────────────────────┘  │ + correlation_id     │
                             ▲                └──────────────────────┘
                             │
                             │ categorizes
                             │
                    ┌─────────────────────┐
                    │      Service        │
                    └─────────────────────┘
```

## Core Entities

### 1. Configuration

**Description**: Root configuration object loaded from YAML file defining all monitoring settings and services.

**Attributes**:
- `settings` (object, optional): Global configuration settings
  - `check_interval` (number, default: 60): Default interval between checks in seconds
  - `warning_threshold` (number, default: 2): Latency threshold for DEGRADED state in seconds
  - `timeout` (number, default: 5): HTTP timeout threshold for FAILED state in seconds
  - `page_refresh` (number, default: 60): Browser auto-refresh interval in seconds
  - `max_retries` (number, default: 3): Failed check retry attempts before marking as down
  - `worker_pool_size` (number, default: 0): Concurrent health check workers (0 = auto: 2x CPU cores)
  - `history_file` (string, default: "history.csv"): CSV file path for historical data
  - `output_dir` (string, default: "./output"): Directory for generated HTML/JSON
- `pings` (array, required): Array of service definitions to monitor

**Validation Rules**:
- Configuration file must be valid YAML syntax (FR-007)
- `pings` array must contain at least one service definition
- All numeric settings must be positive integers
- `settings.check_interval` must be >= 10 seconds (prevent service overload)
- `settings.warning_threshold` must be < `settings.timeout`
- Service names must be unique across all pings (FR-007a)
- Invalid configuration causes startup failure with detailed errors to stderr (FR-007)

**State Transitions**: N/A (configuration is immutable after load)

**Relationships**:
- Contains 0..n `Service/Ping` entities
- Configuration changes require service restart (FR-032)

---

### 2. Service/Ping

**Description**: Represents a public service or infrastructure component being monitored.

**Attributes**:
- `name` (string, required): Display name for the service (must be unique)
- `protocol` (enum, required): HTTP | HTTPS
- `method` (enum, required): GET | HEAD | POST
- `resource` (string, required): Full URL of the endpoint to check
- `tags` (string[], optional): Category labels for visual identification (e.g., ["health", "driving licences"])
- `expected` (ExpectedValidation, required): Validation criteria for determining health
- `headers` (Header[], optional): Custom HTTP headers for requests
  - `name` (string): Header name
  - `value` (string): Header value
- `payload` (object, optional): POST request body (JSON format, only valid when method=POST)
- `interval` (number, optional): Override default check interval in seconds
- `warning_threshold` (number, optional): Override default warning threshold in seconds
- `timeout` (number, optional): Override default timeout in seconds
- `currentStatus` (enum, runtime): PENDING | PASS | DEGRADED | FAIL (runtime state)
- `lastCheckTime` (Date, runtime): Timestamp of most recent health check
- `lastLatency` (number, runtime): Response latency in milliseconds from most recent check
- `consecutiveFailures` (number, runtime): Count of consecutive check failures (for HTML display threshold)

**Validation Rules**:
- `name` must not be empty and must be unique across all services (FR-007a)
- `resource` must be a valid HTTP/HTTPS URL
- `protocol` and `method` must match allowed enum values
- `payload` is only valid when `method` is POST
- `payload` must be valid JSON object if provided
- `interval`, `warning_threshold`, and `timeout` must be positive integers if provided
- Per-service `warning_threshold` must be < per-service `timeout`
- `tags` array elements must be non-empty strings
- Custom headers must have both `name` and `value` populated
- If service is removed from config, it disappears from status display but historical CSV data is preserved (FR-007b)

**State Transitions**:

```
PENDING (no data yet)
    │
    │ first check completes successfully
    ▼
PASS (passing validations, latency within warning_threshold)
    │
    ├── latency exceeds warning_threshold ──► DEGRADED
    │
    └── validation fails OR timeout ──► FAIL
         │
         │ single failure recorded to CSV/JSON (FR-015)
         │
         │ 2nd consecutive failure ──► displayed as DOWN on HTML (FR-015a)

DEGRADED (passing validations, latency exceeds warning_threshold but within timeout)
    │
    ├── latency returns to normal ──► PASS
    │
    └── validation fails OR timeout ──► FAIL

FAIL (validation failed or timeout exceeded)
    │
    └── validation passes and latency normal ──► PASS
         │
         │ resets consecutiveFailures counter
```

**Relationships**:
- Belongs to `Configuration`
- Has one `ExpectedValidation`
- Has 0..n `Tag` references
- Produces 0..n `HealthCheckResult` records over time
- Current status displayed on HTML page, historical results in CSV

---

### 3. ExpectedValidation

**Description**: Validation criteria for determining service health from HTTP response.

**Attributes**:
- `status` (number, required): Expected HTTP status code (e.g., 200, 301, 404)
- `text` (string, optional): Expected substring in response body (searches first 100KB per FR-014)
- `headers` (object, optional): Expected response headers for validation
  - Key-value pairs where key is header name (e.g., "location") and value is expected header value
  - Case-insensitive header name matching
  - Example: `{ "location": "http://example.com/redirect" }` for redirect validation (FR-004a)

**Validation Rules**:
- `status` must be a valid HTTP status code (100-599)
- `text` validation uses case-sensitive substring matching
- `text` search limited to first 100KB of response body (FR-014)
- `headers` validation uses case-insensitive header name matching and case-sensitive value matching
- All specified validation criteria must pass for health check to be considered PASS

**State Transitions**: N/A (validation criteria are immutable)

**Relationships**:
- Belongs to one `Service/Ping`
- Used by `HealthCheckResult` to determine pass/fail status

---

### 4. HealthCheckResult

**Description**: Outcome of a single monitoring probe execution against a service.

**Attributes**:
- `serviceName` (string, required): Name of the service checked
- `timestamp` (Date, required): ISO 8601 timestamp when check was executed
- `method` (enum, required): HTTP method used (GET | HEAD | POST)
- `status` (enum, required): PASS | DEGRADED | FAIL
- `latency_ms` (number, required): Response latency in integer milliseconds
- `http_status_code` (number, required): Actual HTTP status code received
- `expected_status` (number, required): Expected HTTP status code from configuration
- `textValidationResult` (boolean, optional): Whether expected text was found (null if not configured)
- `headerValidationResult` (object, optional): Header validation results (null if not configured)
  - Map of header name to boolean (pass/fail)
- `failure_reason` (string, required): Human-readable failure description (empty string if passed)
  - Examples: "Connection timeout", "DNS failure", "Expected status 200, got 500", "Expected text 'OK' not found", "Expected Location header 'http://example.com' not found"
- `correlation_id` (string, required): UUID linking to structured logs for traceability (FR-036)

**Validation Rules**:
- `serviceName` must match a configured service
- `timestamp` must be valid ISO 8601 format
- `latency_ms` must be non-negative integer
- `http_status_code` must be valid HTTP status code or 0 (for connection failures)
- `status` determination:
  - FAIL: validation failed OR timeout exceeded (FR-015)
  - DEGRADED: validation passed AND latency > warning_threshold AND latency <= timeout (FR-015b)
  - PASS: validation passed AND latency <= warning_threshold
- `failure_reason` must be populated for FAIL status, empty string for PASS/DEGRADED

**State Transitions**:

```
Health check starts
    │
    ├── Network error (DNS, connection) ──► FAIL with failure_reason
    │
    ├── Timeout exceeded ──► FAIL with "timeout" failure_reason
    │
    ├── Unexpected status code ──► FAIL with status code mismatch reason
    │
    ├── Expected text not found ──► FAIL with text mismatch reason
    │
    ├── Expected header mismatch ──► FAIL with header mismatch reason
    │
    └── All validations pass
         │
         ├── latency > timeout ──► FAIL with "timeout" reason
         │
         ├── latency > warning_threshold ──► DEGRADED
         │
         └── latency <= warning_threshold ──► PASS
```

**Relationships**:
- Produced by one `Service/Ping`
- Converted to `HistoricalRecord` for CSV storage
- Aggregated to update service `currentStatus` in status.json

---

### 5. HistoricalRecord

**Description**: Time-series data for service health stored in CSV format.

**Attributes** (CSV columns):
- `timestamp` (string, required): ISO 8601 timestamp (e.g., "2025-10-21T14:30:00.000Z")
- `service_name` (string, required): Name of the service
- `status` (enum, required): PASS | DEGRADED | FAIL (uppercase)
- `latency_ms` (integer, required): Response latency in milliseconds
- `http_status_code` (integer, required): HTTP status code received
- `failure_reason` (string, required): Failure description (empty string if passed)
- `correlation_id` (string, required): UUID for log traceability (FR-018)

**Validation Rules**:
- CSV must maintain strict column order
- All fields are required (no null/empty except `failure_reason`)
- `status` must be one of: PASS, DEGRADED, FAIL
- `latency_ms` and `http_status_code` must be non-negative integers
- Records are append-only (no updates or deletes)
- CSV write failures cause process exit with non-zero code (FR-020a)
- Historical data for removed services is preserved indefinitely (FR-007b)

**State Transitions**: N/A (records are immutable once written)

**Relationships**:
- Derived from `HealthCheckResult`
- Stored in CSV file (default: history.csv)
- Consumed by external analytics/reporting tools
- Enables uptime percentage calculations (SC-008)

---

### 6. Tag

**Description**: Category label displayed with each service for visual identification.

**Attributes**:
- `name` (string, required): Tag display name (e.g., "health", "ministry of foo", "roads")

**Validation Rules**:
- Tag names must be non-empty strings
- Tags are case-sensitive for display purposes
- No uniqueness constraint (multiple services can share tags)
- Services without tags are displayed in "Untagged Services" section (FR-024a)

**State Transitions**: N/A (tags are static labels)

**Relationships**:
- Referenced by 0..n `Service/Ping` entities
- Displayed as GOV.UK tag components on status page (FR-025)
- Used for visual categorization in flat list (no filtering/grouping UI)

---

## Data Flow

### Health Check Execution Flow

```
1. Configuration loaded from config.yaml
   ↓
2. Services scheduled in priority queue (by next check time)
   ↓
3. Worker pool executes HTTP requests concurrently
   ↓
4. HealthCheckResult created for each check
   ↓
5. Result appended to history.csv (HistoricalRecord)
   ↓
6. Service currentStatus updated in memory
   ↓
7. _data/services.json written (current status only)
   ↓
8. Eleventy triggered to regenerate HTML/JSON
   ↓
9. _site/index.html and _site/api/status.json updated
```

### Status Display Flow

```
1. User accesses status.gov.uk
   ↓
2. Static HTML served from _site/index.html
   ↓
3. HTML displays services sorted: FAIL → DEGRADED → PASS
   ↓
4. Services without tags shown in "Untagged Services" section
   ↓
5. Tags displayed as GOV.UK tag components
   ↓
6. Page auto-refreshes every 60 seconds (FR-029)
```

### API Flow

```
1. API consumer requests _site/api/status.json
   ↓
2. Static JSON served with current status only
   ↓
3. Consumer parses JSON array of service objects
   ↓
4. For historical data: Consumer reads history.csv directly
```

## Storage Schema

### CSV File Schema (history.csv)

```csv
timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-10-21T14:30:00.000Z,example,PASS,120,200,,550e8400-e29b-41d4-a716-446655440000
2025-10-21T14:30:00.000Z,example head,DEGRADED,2500,200,,550e8400-e29b-41d4-a716-446655440001
2025-10-21T14:30:00.000Z,example three,FAIL,0,0,Connection timeout,550e8400-e29b-41d4-a716-446655440002
```

### JSON API Schema (_site/api/status.json)

```typescript
type StatusAPI = ServiceStatus[];

interface ServiceStatus {
  name: string;                    // Service display name
  status: "PENDING" | "PASS" | "DEGRADED" | "FAIL";
  latency_ms: number | null;       // null if PENDING
  last_check_time: string | null;  // ISO 8601 timestamp, null if PENDING
  tags: string[];                  // Empty array if no tags
  http_status_code: number | null; // null if PENDING
  failure_reason: string;          // Empty string if passed
}
```

Example:
```json
[
  {
    "name": "example",
    "status": "PASS",
    "latency_ms": 120,
    "last_check_time": "2025-10-21T14:30:00.000Z",
    "tags": ["health", "driving licences", "roads", "ministry of foo"],
    "http_status_code": 200,
    "failure_reason": ""
  },
  {
    "name": "example head",
    "status": "DEGRADED",
    "latency_ms": 2500,
    "last_check_time": "2025-10-21T14:30:00.000Z",
    "tags": ["health", "justice", "central government", "example dept"],
    "http_status_code": 200,
    "failure_reason": ""
  },
  {
    "name": "example three",
    "status": "FAIL",
    "latency_ms": 0,
    "last_check_time": "2025-10-21T14:30:00.000Z",
    "tags": ["health", "driving licences", "roads", "ministry of foo"],
    "http_status_code": 0,
    "failure_reason": "Connection timeout"
  }
]
```

### Eleventy Data File Schema (_data/services.json)

Identical to JSON API schema. This file feeds Eleventy templates to generate HTML.

## TypeScript Type Definitions

```typescript
// Configuration types
interface Configuration {
  settings?: GlobalSettings;
  pings: ServiceDefinition[];
}

interface GlobalSettings {
  check_interval?: number;       // Default: 60
  warning_threshold?: number;    // Default: 2
  timeout?: number;              // Default: 5
  page_refresh?: number;         // Default: 60
  max_retries?: number;          // Default: 3
  worker_pool_size?: number;     // Default: 0 (auto)
  history_file?: string;         // Default: "history.csv"
  output_dir?: string;           // Default: "./output"
}

interface ServiceDefinition {
  name: string;
  protocol: "HTTP" | "HTTPS";
  method: "GET" | "HEAD" | "POST";
  resource: string;
  tags?: string[];
  expected: ExpectedValidation;
  headers?: CustomHeader[];
  payload?: Record<string, unknown>;
  interval?: number;
  warning_threshold?: number;
  timeout?: number;
}

interface ExpectedValidation {
  status: number;
  text?: string;
  headers?: Record<string, string>;
}

interface CustomHeader {
  name: string;
  value: string;
}

// Runtime types
type ServiceStatus = "PENDING" | "PASS" | "DEGRADED" | "FAIL";

interface Service extends ServiceDefinition {
  currentStatus: ServiceStatus;
  lastCheckTime: Date | null;
  lastLatency: number | null;
  consecutiveFailures: number;
}

interface HealthCheckResult {
  serviceName: string;
  timestamp: Date;
  method: "GET" | "HEAD" | "POST";
  status: ServiceStatus;
  latency_ms: number;
  http_status_code: number;
  expected_status: number;
  textValidationResult?: boolean;
  headerValidationResult?: Record<string, boolean>;
  failure_reason: string;
  correlation_id: string;
}

// CSV record type
interface HistoricalRecord {
  timestamp: string;           // ISO 8601
  service_name: string;
  status: "PASS" | "DEGRADED" | "FAIL";
  latency_ms: number;
  http_status_code: number;
  failure_reason: string;
  correlation_id: string;
}

// JSON API type (same as _data/services.json)
interface ServiceStatusAPI {
  name: string;
  status: ServiceStatus;
  latency_ms: number | null;
  last_check_time: string | null;
  tags: string[];
  http_status_code: number | null;
  failure_reason: string;
}

type StatusAPI = ServiceStatusAPI[];
```

## Indexes and Performance Considerations

### CSV File
- No indexes (append-only file)
- Manual rotation/archival when file size exceeds threshold
- Consider migration to time-series database for long-term retention

### In-Memory Service State
- Services indexed by name (Map<string, Service>) for O(1) lookup
- Priority queue for scheduling (next check time as priority)

### JSON API
- Static file (no database queries)
- Sorted in memory before writing: FAIL → DEGRADED → PASS → PENDING

## Migration Strategy

Future extensibility for database-backed storage (per FR-019):
- Maintain CSV writer interface to enable backend swapping
- Create abstract `HistoryStorage` interface with implementations:
  - `CSVHistoryStorage` (current)
  - `PostgreSQLHistoryStorage` (future)
  - `TimescaleDBHistoryStorage` (future - optimized for time-series)
- No changes to HealthCheckResult model required
- Configuration update to specify storage backend type

## References

- Feature Specification: [spec.md](./spec.md)
- Research: [research.md](./research.md)
- Implementation Plan: [plan.md](./plan.md)
