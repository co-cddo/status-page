# Feature Specification: GOV.UK Public Services Status Monitor

**Feature Branch**: `001-govuk-status-monitor`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "Build an application that will resemble downdetector (use perplexity to research this), I have also provided screenshots of it attached. The purpose of the application is to provide a new service that will be hosted on status.gov.uk that will show the health of public services and related underlying infrastructre within the supplychain. The probes that are run for the healthchecks will be extendible but we'll start with timed HTTP(s) polling (i.e. record the latency from request to response). configuration will be managed by a yaml file. The display will highlight failing services first, the yaml file will contain a hiearchy for everything else, the html display will respect this. it will record a history in a CSV file, though this storage backend will be extended, in the future, it will also generate a static html page that is compliant with the gov.uk design system using the frontend design toolkit (research this with perplexity, websearch, webfetch). the main application is just running as a backend service that generates static assets in order to deliver performance. in addition to the static html, it will also make the same data available in a json file for APIs to poll."

## Clarifications

### Session 2025-10-21

- Q: How should the system handle HTTP redirects (301, 302, 307) - automatically follow them, treat as failures, or validate them? → A: The probe should be configured with the expected status code (e.g., 301) and validate the Location header matches the expected redirect URL. The system does not automatically follow redirects; instead it validates redirect responses when explicitly configured with expected status and Location header.
- Q: How should historical service performance data be presented to users on the status page? → A: Historical data only in JSON API - HTML page shows current status only. Users access historical data programmatically via JSON or by reading the CSV file directly.
- Q: What level of logging detail is required for operational troubleshooting? → A: Structured logs with each check logged (timestamp, service name, result, latency, status code, correlation ID). Verbose debug logging (full HTTP request/response headers and bodies) controlled by environment variable. System also provides metrics telemetry for operational monitoring.
- Q: How should tag-based service organization be displayed on the static HTML status page? → A: Flat list - all services in one list, each showing its tags as labels; no grouping or filtering by tag. Services are sorted with failing services first, then healthy services.
- Q: How should the system behave when YAML configuration validation fails on startup? → A: Fail startup with detailed errors - refuse to start, output all validation errors to stderr/logs, exit with non-zero code. This ensures configuration issues are caught during deployment rather than in production.
- Q: How should the system behave when CSV storage fails (permissions, disk space issues)? → A: Process should fail with non-zero exit code. Storage failures are treated as critical operational errors requiring immediate intervention.
- Q: What happens when multiple services share the exact same name in configuration? → A: Fail configuration validation at startup - duplicate service names are treated as validation errors. System refuses to start and outputs error identifying the duplicate names.
- Q: What happens when response body is too large to search for expected text efficiently? → A: Read first 100KB only - text validation searches within the first 100KB of response body, ignoring remainder to prevent memory exhaustion and ensure fast health checks.
- Q: What happens when metrics telemetry system is unavailable or unreachable? → A: Buffer metrics in memory with size limit - queue metrics until telemetry recovers, flush when available. Drop oldest metrics when buffer limit reached to prevent unbounded memory growth.
- Q: How should the system behave when a service has no tags defined? → A: Allow but display in "Untagged" section - services without tags are permitted and shown separately at the bottom of the status page (after all tagged services) with a clear "Untagged Services" heading.
- Q: How should the system handle failed health checks (timeouts, connection errors, DNS failures) for data recording vs. HTML display? → A: Single failure marks service DOWN immediately in CSV/JSON data for accurate historical tracking. HTML status page requires 2 consecutive check cycle failures before displaying service as DOWN to reduce noise from transient network issues for end users.
- Q: How should verbose debug logging handle sensitive data in request/response bodies (e.g., API keys, tokens, passwords, PII)? → A: No automatic redaction - log everything as-is when debug mode enabled. System emits clear security warnings in documentation and log output when debug mode is active. Operators are responsible for using appropriate log access controls and enabling debug mode only in secure troubleshooting environments.
- Q: How should the system handle services that respond very slowly (e.g., 30+ seconds) but eventually complete successfully? → A: Use two-threshold model - if service fails to respond within 2 seconds (warning_threshold), mark as DEGRADED; if fails to respond within 5 seconds (timeout), mark as FAILED with timeout reason. Both thresholds defined as global configuration parameters with per-service override capability.
- Q: What happens when configuration file is modified while the service is running? → A: Require manual restart - configuration changes only take effect after service restart. Operator must restart the process to apply new configuration. When restarting, system completes in-flight health checks gracefully before shutting down to prevent data loss.
- Q: How should the system handle simultaneous monitoring of many services (e.g., 100+) with different check intervals? → A: Use thread/worker pool sized to available CPU cores (e.g., 2x cores) with priority queue scheduling based on next check time. This provides good concurrency for I/O-bound HTTP checks while limiting resource consumption and ensuring fair scheduling across all services.
- Q: How should the system present status when no historical data exists yet for a service (newly added, never checked)? → A: Show service with "Unknown" or "Pending" status and "No data yet" message, indicating first check is pending. Once first check completes, display actual status. This sets proper expectations that service is configured but not yet validated.
- Q: What happens if the static HTML/JSON generation fails mid-process (disk full, permissions, process killed)? → A: Fail service with non-zero exit code - treat any HTML/JSON generation failure as fatal operational error requiring immediate manual intervention. This prevents serving partial or stale data to users and ensures operators are immediately aware of generation problems.
- Q: How are validation errors communicated in orchestration environments (Kubernetes, systemd) where stderr may not be immediately visible? → A: stderr only - rely on orchestration platforms to properly capture and surface stderr logs. Operators use platform-native tools (journalctl for systemd, kubectl logs for Kubernetes) to view validation errors. Exit with non-zero code triggers restart/failure state that operators monitor through standard platform mechanisms.
- Q: How should logging verbosity be controlled - via environment variable, configuration file, or other mechanism? → A: Logging verbosity controlled by DEBUG environment variable with standard log levels (info, error, debug, etc.). Example: DEBUG=debug enables debug-level logging, DEBUG=info for info-level, etc.
- Q: What exact CSV column structure and data format should be used for historical health check records? → A: CSV columns: timestamp (ISO 8601), service_name, status (PASS/DEGRADED/FAIL), latency_ms (integer milliseconds), http_status_code, failure_reason (empty if passed), correlation_id. This provides complete traceability linking to logs and preserves all metrics for uptime calculations.
- Q: What happens when a previously monitored service is removed from the YAML configuration? → A: Removed service disappears from status display immediately on next generation cycle; historical CSV data for that service is preserved indefinitely for audit purposes; no new health checks are performed for removed services.
- Q: What should the JSON file structure contain - current status only, or both current status and historical data? → A: JSON contains only current status data (no historical data). Structure is an array of service objects with: name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason. Consumers access historical data by reading the CSV file directly.
- Q: What structured log format should the system use for operational observability? → A: Structured JSON logging with fields: timestamp (ISO 8601), level (INFO/ERROR/DEBUG), service_name, correlation_id, event_type (e.g., "health_check_complete", "validation_failed"), message, context object with relevant data (latency_ms, http_status_code, etc.). This enables integration with log aggregation systems (ELK, Splunk, CloudWatch).
- Q: What accessibility standard should the status page meet? → A: WCAG 2.2 AAA - the highest accessibility standard. This exceeds typical government requirements (usually AA) but ensures maximum accessibility for all users including those with disabilities.

## User Scenarios & Testing

### User Story 1 - View Current Service Status (Priority: P1)

As a member of the public or government employee, I need to quickly see which public services are currently operational and which are experiencing issues, so I can understand service availability and plan accordingly.

**Why this priority**: This is the core value proposition of the status monitor - providing immediate visibility into service health. Without this, the application has no purpose.

**Independent Test**: Can be fully tested by accessing the status page and viewing a list of services with their current health status. Delivers immediate value by showing service availability.

**Acceptance Scenarios**:

1. **Given** I access status.gov.uk, **When** the page loads, **Then** I see a list of all monitored public services with their current health status
2. **Given** services are being monitored, **When** a service is experiencing issues, **Then** that service appears at the top of the list with a clear failure indicator
3. **Given** I am viewing the status page, **When** I look at a healthy service, **Then** I see a visual indicator showing the service is operational
4. **Given** I am viewing the status page, **When** I look at any service, **Then** I can see the most recent check time and response latency

---

### User Story 2 - Identify Service Categories via Tags (Priority: P2)

As a user reviewing service status, I need to see tags for each service displayed as labels, so I can understand which categories a service belongs to (departments, service types, infrastructure layers) and identify related services.

**Why this priority**: Once users can see individual service status (P1), they need context about service categorization. Tags displayed as labels enable users to visually identify related services without requiring navigation or filtering.

**Independent Test**: Can be tested by viewing the status page and confirming each service displays its associated tags as visible labels (e.g., "health", "ministry of foo", "roads"). Delivers value by providing organizational context through visual categorization.

**Acceptance Scenarios**:

1. **Given** services have been configured with tags, **When** I view the status page, **Then** I see tagged services in a single flat list sorted with failing services first
2. **Given** a service has multiple tags (e.g., "health", "driving licences", "ministry of foo"), **When** I view the service, **Then** I can see all applicable tags displayed as labels next to the service name
3. **Given** services exist without tags defined, **When** I view the status page, **Then** I see those services in a separate "Untagged Services" section at the bottom of the page
4. **Given** I am reviewing the status page, **When** I look at service tags, **Then** I can visually identify which services share common tags (e.g., all services tagged "health")
5. **Given** services share common tags, **When** reviewing the flat list, **Then** I can identify related services by scanning tag labels without grouping or filtering

---

### User Story 3 - Access Historical Service Performance (Priority: P3)

As a service manager or technical analyst, I need to access historical service performance data programmatically, so I can perform trend analysis, generate reports, and assess reliability patterns over time.

**Why this priority**: Historical data provides valuable trend analysis but is not essential for the core status monitoring function. Users first need current status (P1) and organizational context (P2). This is a programmatic/API-first use case rather than end-user web UI.

**Independent Test**: Can be tested by reading the CSV file to access historical performance metrics. Delivers value by enabling automated trend analysis and reliability assessment.

**Acceptance Scenarios**:

1. **Given** services have been monitored over time, **When** I access the CSV historical data file, **Then** I can retrieve historical health check results for analysis
2. **Given** historical data exists in CSV format, **When** I read the CSV file, **Then** I can identify when outages occurred, their duration, and latency patterns
3. **Given** I am consuming historical data, **When** I parse the CSV records, **Then** I can calculate uptime percentages over different time periods (hours, days, weeks)

---

### User Story 4 - Consume Service Status via API (Priority: P3)

As a developer or automated system, I need to access current service status data in machine-readable format, so I can integrate status information into other applications and monitoring dashboards.

**Why this priority**: API access enables automation and integration but depends on the core monitoring functionality (P1) being operational first.

**Independent Test**: Can be tested by making an HTTP request to the JSON endpoint and receiving structured status data. Delivers value by enabling programmatic access.

**Acceptance Scenarios**:

1. **Given** the status monitor is running, **When** I request the JSON data file, **Then** I receive current status for all monitored services in structured format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason)
2. **Given** I am consuming the JSON API, **When** I parse the JSON response, **Then** I can identify service names, current status, latency metrics, last check time, and tags
3. **Given** the HTML page is updated, **When** the JSON file is generated, **Then** both contain identical current status information

---

### User Story 5 - Automatic Status Updates (Priority: P2)

As a user monitoring service status during an incident, I need the status page to refresh automatically, so I can see updates without manually reloading the page.

**Why this priority**: Once users can view status (P1), automatic updates significantly improve the user experience during active incidents. This is valuable but not as critical as the core status display.

**Independent Test**: Can be tested by opening the status page and observing it update automatically after the configured refresh interval. Delivers value by reducing user effort during monitoring.

**Acceptance Scenarios**:

1. **Given** I am viewing the status page, **When** the configured refresh interval elapses, **Then** the page automatically updates with current status data
2. **Given** automatic refresh is enabled, **When** a service status changes, **Then** I see the updated status within one refresh interval
3. **Given** I am viewing the page, **When** automatic refresh occurs, **Then** I see a visual indication of the last update time

---

### Edge Cases

- What happens when a service check times out or fails to connect (network error, DNS failure, etc.)? (Answer: Single failure marks service DOWN immediately in CSV/JSON data for accurate historical tracking; HTML status page requires 2 consecutive check cycle failures before displaying as DOWN to reduce noise from transient issues)
- How does the system handle services that are configured but not yet reachable?
- What happens when the YAML configuration file contains invalid syntax or missing required fields? (Answer: System fails to start, outputs detailed validation errors to stderr/logs, exits with non-zero code)
- How does the system behave when storage (CSV file) cannot be written due to permissions or disk space issues? (Answer: Process fails with non-zero exit code - storage failures are critical operational errors)
- What happens when services respond very slowly (e.g., 30+ seconds) but eventually complete? (Answer: Two-threshold model - responses exceeding warning_threshold (2s default) marked as DEGRADED; exceeding timeout (5s default) marked as FAILED. Both thresholds configurable globally and per-service)
- How does the system handle simultaneous monitoring of many services (e.g., 100+) with different check intervals? (Answer: Thread/worker pool sized to CPU cores (2x cores) with priority queue scheduling by next check time - ensures good concurrency while limiting resource consumption)
- What happens when a previously monitored service is removed from the configuration? (Answer: Removed service disappears from HTML/JSON status display immediately on next generation cycle; historical CSV data preserved indefinitely for audit; no new checks performed)
- How does the system present status when no historical data exists yet for a service? (Answer: Show with "Unknown" or "Pending" status and "No data yet" message until first check completes, setting proper expectations that service is configured but not yet validated)
- What happens if the static HTML/JSON generation fails mid-process? (Answer: Fail service with non-zero exit code - treat as fatal operational error requiring immediate manual intervention to prevent serving partial or stale data)
- How does the page display when accessed via assistive technologies (screen readers)? (Answer: Page must meet WCAG 2.2 AAA standards ensuring compatibility with screen readers, keyboard navigation, enhanced color contrast, clear focus indicators, and comprehensive ARIA labels)
- What happens when expected status code doesn't match actual response (e.g., expecting 200, receiving 500)?
- What happens when expected response text is not found in the response body?
- How does the system handle POST requests that fail due to invalid payload format?
- What happens when custom headers are required but not properly formatted in the configuration?
- How does the system behave when a service has no tags defined? (Answer: Allow but display in "Untagged" section - shown separately at bottom of page with "Untagged Services" heading)
- What happens when multiple services share the exact same name? (Answer: Configuration validation fails at startup - duplicate names are validation errors, system refuses to start)
- What happens when response body is too large to search for expected text efficiently? (Answer: Read first 100KB only - text validation searches within first 100KB, ignoring remainder)
- What happens when expected Location header doesn't match actual redirect location?
- How does verbose debug logging handle sensitive data in request/response bodies (e.g., API keys, tokens)? (Answer: No automatic redaction - logs everything as-is when debug mode enabled with clear security warnings. Operators responsible for log access controls and enabling only in secure environments)
- What happens when metrics telemetry system is unavailable or unreachable? (Answer: Buffer metrics in memory with size limit - queue until telemetry recovers, drop oldest when buffer full)
- What happens when configuration file is modified while the service is running (given FR-032 supports config reloads)? (Answer: Manual restart required - config changes only take effect after service restart. System completes in-flight checks gracefully before shutdown to prevent data loss)
- How are validation errors communicated in orchestration environments (Kubernetes, systemd) where stderr may not be visible? (Answer: stderr only - orchestration platforms capture stderr logs. Operators use platform-native tools (journalctl, kubectl logs) to view errors. Non-zero exit code triggers restart/failure state for monitoring)

## Requirements

### Functional Requirements

#### Configuration & Setup

- **FR-001**: System MUST read service configuration from a YAML file with a `pings` section containing an array of service definitions
- **FR-002**: Each service definition MUST include: name, protocol (HTTP/HTTPS), method (GET/HEAD/POST), and resource (URL)
- **FR-002a**: Each service definition MAY optionally include tags array; services without tags are displayed in "Untagged Services" section
- **FR-003**: Each service definition MUST specify expected validation criteria including status code
- **FR-004**: Each service definition MAY optionally specify expected response text for content validation
- **FR-004a**: Each service definition MAY optionally specify expected response headers for validation (e.g., Location header for redirect validation)
- **FR-005**: System MUST support custom HTTP headers per service (name-value pairs) in outgoing requests
- **FR-006**: System MUST support POST request payloads (JSON format) for services requiring data submission
- **FR-007**: System MUST validate YAML configuration on startup and fail to start if validation errors are detected, outputting all specific errors (invalid syntax, missing required fields, invalid values, duplicate service names) to stderr and logs, then exiting with non-zero exit code
- **FR-007a**: System MUST enforce unique service names - duplicate service names are configuration validation errors
- **FR-007b**: System MUST exclude removed services (no longer in configuration) from HTML and JSON status output immediately on next generation cycle after restart; historical CSV data for removed services MUST be preserved indefinitely; no new health checks performed for removed services

#### Health Check Execution

- **FR-008**: System MUST perform HTTP(S) health checks against configured service endpoints using the specified method (GET, HEAD, or POST)
- **FR-009**: System MUST execute health checks at configurable intervals (default 60 seconds if not specified per-service)
- **FR-009a**: System MUST use a thread/worker pool (sized to available CPU cores, e.g., 2x cores) to execute health checks concurrently, with priority queue scheduling based on next check time to ensure fair scheduling across all services
- **FR-010**: System MUST include custom headers in requests when specified in service configuration
- **FR-011**: System MUST send POST payloads when method is POST and payload is configured
- **FR-012**: System MUST record the response latency (time from request to first response byte) for each health check attempt
- **FR-013**: System MUST validate response status code matches expected status code
- **FR-014**: System MUST validate response body contains expected text when text validation is configured, searching within the first 100KB of response body only
- **FR-014a**: System MUST validate response headers match expected header values when header validation is configured (e.g., Location header for redirects)
- **FR-015**: System MUST record health checks as FAILED in CSV and JSON data when: network error occurs, timeout exceeded (exceeds configured timeout threshold), unexpected status code received, expected text not found, or expected header value mismatch (single failure marks service DOWN in data layer for accurate historical tracking)
- **FR-015a**: System MUST require 2 consecutive check cycle failures before displaying a service as DOWN on the HTML status page to reduce noise from transient network issues for end users
- **FR-015b**: System MUST record health checks as DEGRADED when response succeeds (passes all validations) but latency exceeds warning_threshold (default 2 seconds)
- **FR-016**: System MUST record failure reason (connection timeout, DNS failure, HTTP error code, text mismatch, header mismatch, etc.) for failed checks
- **FR-017**: System MUST support configurable timeout values per service (default 5 seconds if not specified); requests exceeding timeout are terminated and marked as FAILED
- **FR-017a**: System MUST support configurable warning_threshold values per service (default 2 seconds if not specified); successful responses exceeding warning_threshold are marked as DEGRADED

#### Data Storage & History

- **FR-018**: System MUST persist historical health check results in CSV format with columns: timestamp (ISO 8601 format), service_name, status (PASS/DEGRADED/FAIL in uppercase), latency_ms (integer milliseconds), http_status_code, failure_reason (empty string if passed), correlation_id (for log traceability)
- **FR-019**: System MUST support extensible storage backends beyond CSV for future scalability (architecture must allow backend swapping)
- **FR-020**: System MUST append new check results to historical data without requiring full data reload
- **FR-020a**: System MUST exit with non-zero exit code if CSV file cannot be written due to permissions, disk space, or other I/O errors

#### Status Page Generation

- **FR-021**: System MUST generate a static HTML page compliant with GOV.UK Design System showing current service status only (no historical data embedded)
- **FR-022**: System MUST generate a JSON file containing only current service status data (no historical data). JSON structure is an array of service objects with attributes: name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason. Historical data accessed via CSV file directly.
- **FR-023**: System MUST display services on the HTML status page in priority order: failing services first, then degraded services, then healthy services, in a single flat list
- **FR-024**: System MUST display all tags associated with each service as visible labels on the status page
- **FR-024a**: System MUST display services without tags in a separate "Untagged Services" section at the bottom of the status page (after all tagged services)
- **FR-025**: System MUST use GOV.UK Design System tag components to render service category tags
- **FR-026**: System MUST indicate the time of the last status check for each service
- **FR-027**: System MUST provide clear visual indicators distinguishing between healthy (passing validations), degraded (passing validations but slow), failed (failing validations or timeout), and pending (no health check data yet) service states
- **FR-027a**: System MUST display services with no historical data yet (newly added, never checked) with "Unknown" or "Pending" status and "No data yet" message until first check completes
- **FR-028**: System MUST update static HTML and JSON files after each health check cycle completes
- **FR-028a**: System MUST exit with non-zero exit code if HTML or JSON file generation fails due to I/O errors (disk full, permissions, etc.), treating generation failures as fatal operational errors
- **FR-029**: HTML page MUST automatically refresh status information at 60-second intervals (browser-based refresh)
- **FR-029a**: HTML page MUST meet WCAG 2.2 AAA accessibility standards including: enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text), comprehensive ARIA labels and landmarks, keyboard navigation support, screen reader compatibility, clear focus indicators, and no reliance on color alone for conveying information

#### Service Operation

- **FR-030**: System MUST operate as a background service that generates static assets without requiring runtime web server requests
- **FR-031**: System MUST support extensible health check probe types beyond HTTP(S), with HTTP(S) polling as the initial implementation
- **FR-032**: System MUST gracefully handle shutdown during restart (to apply configuration changes) by completing in-flight health checks before terminating, preventing data loss. Configuration changes require manual service restart to take effect.

#### Observability & Logging

- **FR-033**: System MUST emit structured JSON logs with fields: timestamp (ISO 8601), level (INFO/ERROR/DEBUG), service_name, correlation_id, event_type (e.g., "health_check_complete", "validation_failed"), message, and context object containing relevant data (latency_ms, http_status_code, etc.)
- **FR-034**: System MUST support configurable logging verbosity controlled by DEBUG environment variable with standard log levels (info, error, debug, etc.). Debug level logs full HTTP request/response headers and bodies in the context object for troubleshooting without automatic redaction.
- **FR-034a**: System MUST emit clear security warnings in logs and documentation when debug-level logging is enabled, indicating that sensitive data (API keys, tokens, passwords, PII) will be logged
- **FR-035**: System MUST emit metrics telemetry including: total checks executed, checks passed/failed, latency percentiles (p50, p95, p99), and services up/down counts
- **FR-035a**: System MUST buffer metrics in memory (with configurable size limit) when telemetry system is unavailable, flushing when connection recovers
- **FR-035b**: System MUST drop oldest buffered metrics when buffer limit is reached to prevent unbounded memory growth
- **FR-036**: System MUST use consistent correlation IDs across logs and CSV records for a single health check execution to enable request tracing and linking logs to historical data

### Key Entities

- **Ping/Service**: Represents a public service or infrastructure component being monitored. Attributes include name, protocol (HTTP/HTTPS), method (GET/HEAD/POST), resource URL, tags array, expected validation criteria (status code, optional text), optional custom headers, optional POST payload, current health status, last check time, and last latency measurement.
- **Health Check Result**: Represents the outcome of a single monitoring probe execution. Attributes include target service name, timestamp, method used, result status (pass/degraded/fail), response latency, HTTP status code received, expected status code, text validation result (if configured), and failure reason (if failed). Degraded status indicates successful validation with latency exceeding warning_threshold but within timeout.
- **Tag**: Represents a category label displayed with each service for visual identification. Attributes include tag name. Tags enable flexible multi-dimensional categorization (e.g., by department, function, infrastructure layer) without requiring hierarchical grouping or filtering UI.
- **Expected Validation**: Represents criteria for determining service health. Attributes include expected HTTP status code, optional expected response body text, and optional expected response headers (e.g., Location for redirect validation). A service passes validation only when all configured criteria are met.
- **Configuration**: Represents the complete monitoring setup defined in YAML. Attributes include array of ping definitions under `pings` key, global settings (check intervals, timeouts), and tag definitions for display organization.
- **Historical Record**: Represents time-series data for service health stored in CSV. Attributes include timestamp (ISO 8601), service_name, status (PASS/DEGRADED/FAIL), latency_ms (integer milliseconds), http_status_code, failure_reason (empty if passed), and correlation_id for linking to structured logs.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify current operational status of any monitored service within 3 seconds of accessing status.gov.uk
- **SC-002**: System monitors and reports status for at least 50 public services concurrently without performance degradation
- **SC-003**: Status page loads in under 2 seconds on standard government network connections
- **SC-004**: 95% of health checks complete within their configured timeout period under normal conditions
- **SC-005**: Status information updates reflect actual service state within 2 minutes of a service failure or recovery
- **SC-006**: Static HTML and JSON current status data remain synchronized (both show same current health state) at all times; JSON contains only current status, historical data accessed separately via CSV
- **SC-007**: Status page meets WCAG 2.2 AAA accessibility standards for screen reader compatibility, keyboard navigation, and enhanced accessibility requirements
- **SC-008**: Historical data enables identification of service uptime percentage over rolling 24-hour, 7-day, and 30-day periods
- **SC-009**: Tag labels displayed on each service enable users to visually identify related service failures by category (e.g., department, infrastructure layer) without requiring navigation or filtering
- **SC-010**: API consumers can retrieve current status data for all services via JSON file; historical performance data accessed separately via CSV file

## Configuration Structure

The YAML configuration file defines all monitored services and global settings. Based on the provided draft configuration, the structure includes:

### Core Configuration Elements

```yaml
# Global settings (optional, with defaults)
settings:
  check_interval: 60        # Default interval between checks (seconds)
  warning_threshold: 2      # Latency threshold for DEGRADED state (seconds)
  timeout: 5                # HTTP timeout threshold for FAILED state (seconds)
  page_refresh: 60          # Browser auto-refresh interval (seconds)
  max_retries: 3            # Failed check retry attempts before marking as down
  worker_pool_size: 0       # Concurrent health check workers (0 = auto: 2x CPU cores)
  history_file: "history.csv"     # CSV file path for historical data
  output_dir: "./output"    # Directory for generated HTML/JSON

# Environment variables (runtime configuration):
# DEBUG=info|error|debug           # Logging verbosity level (default: info)
#                                  # debug level logs full HTTP req/res for troubleshooting
# METRICS_BUFFER_SIZE=1000         # Max metrics to buffer when telemetry unavailable

# Service definitions
pings:
  - name: "Service Name"             # Required: Display name
    protocol: HTTP | HTTPS           # Required: Protocol
    method: GET | HEAD | POST        # Required: HTTP method
    resource: "https://url"          # Required: Full URL
    tags:                            # Optional: Array of category tags
      - "department name"            # Services without tags shown in "Untagged Services"
      - "service type"
      - "infrastructure layer"
    expected:                        # Required: Validation criteria
      status: 200                    # Required: Expected HTTP status code
      text: "substring"              # Optional: Expected response body text
      headers:                       # Optional: Expected response headers
        location: "http://..."       # e.g., validate redirect Location header
    headers:                         # Optional: Custom request headers
      - name: "Header-Name"
        value: "header value"
    payload:                         # Optional: POST request body (JSON)
      key: "value"
    interval: 60                     # Optional: Override default check interval
    warning_threshold: 2             # Optional: Override default warning threshold
    timeout: 5                       # Optional: Override default timeout
```

### Example from Draft Configuration

The draft config.yaml demonstrates service validation patterns:
1. HTTP GET with status and text validation
2. HTTPS HEAD with status-only validation
3. HTTP POST with custom headers and payload
4. HTTP redirect validation (301) with expected Location header

All services use tag-based categorization (e.g., "health", "driving licences", "roads", "ministry of foo") enabling flexible multi-dimensional organization on the status page.

## Assumptions

- GOV.UK Design System components (notification banner, warning text, tables, summary lists, tags) will provide a foundation for display; additional customization may be required to achieve WCAG 2.2 AAA compliance (enhanced contrast ratios, comprehensive ARIA labels)
- CSV file storage is acceptable for initial deployment with file rotation or archival handled manually
- Status page will be deployed to gov.uk infrastructure with standard web hosting capabilities
- Services being monitored expose HTTP(S) endpoints suitable for polling without rate limiting concerns
- YAML configuration will be managed manually (edited by administrators) rather than through a web UI
- Browser-based auto-refresh using meta refresh tag or JavaScript is acceptable for status updates (60-second interval)
- Initial deployment will monitor fewer than 100 services (allowing simple file-based storage and single-process monitoring)
- Tag labels displayed on a flat list provide sufficient visual categorization without requiring grouping, filtering, or hierarchical organization UI
- Response text validation uses simple substring matching (not regex or complex pattern matching) within first 100KB of response body
- POST payloads are valid JSON objects
- Custom headers do not require dynamic value generation (static values configured in YAML are sufficient)
- Health check results use three-state model (pass/degraded/fail) where degraded indicates successful validation with high latency (exceeds warning_threshold but within timeout)
- Services can tolerate health check requests at 60-second intervals without rate limiting or blocking
- Configuration changes require manual service restart to take effect; system completes in-flight health checks gracefully during shutdown to prevent data loss (no hot-reload capability)
- Deployment environments (systemd, Kubernetes, etc.) expect fail-fast behavior and will surface non-zero exit codes appropriately
- Orchestration platforms (systemd, Kubernetes) properly capture and persist stderr logs, making them accessible via platform-native tools (journalctl, kubectl logs) for troubleshooting
- Configuration validation errors are deployment-time issues requiring administrator intervention before service can start
- Structured JSON logging format with timestamp, level, service_name, correlation_id, event_type, message, and context fields enables integration with log aggregation systems (ELK, Splunk, CloudWatch)
- Metrics telemetry uses standard observability protocols (e.g., Prometheus, StatsD, or similar) for integration with existing monitoring infrastructure
- Metrics buffer size defaults to 1000 entries if not configured, providing resilience during telemetry outages while limiting memory impact
- Logging defaults to info level; debug level is available via DEBUG environment variable for troubleshooting but disabled by default to prevent performance impact and potential PII exposure

## Out of Scope

- Real-time bidirectional communication (WebSockets, Server-Sent Events) for instant status updates
- User authentication or personalized status views
- Alert notifications (email, SMS, webhooks) when services fail
- Complex health check protocols beyond HTTP(S) (database queries, custom protocol checks, synthetic transactions)
- Historical data visualization (charts, graphs, trend lines)
- Service incident management workflow (incident creation, updates, resolution tracking)
- Multi-region or distributed monitoring (checks from multiple geographic locations)
- Service dependency mapping and impact analysis automation
- YAML configuration validation UI or configuration management interface
- Integration with existing government service monitoring systems
- Custom dashboard creation or widget embedding

## Dependencies

- GOV.UK Design System and Frontend Toolkit availability and documentation
- GOV.UK infrastructure hosting capability for static content
- Network accessibility to monitored service endpoints from the monitoring host
- File system write permissions for CSV history storage and HTML/JSON generation

## Risks

- **Service Overload**: Frequent polling of service endpoints could contribute to load on monitored services
  - *Mitigation*: Configure reasonable check intervals (e.g., 60+ seconds) and implement exponential backoff for failed checks

- **Single Point of Failure**: If monitoring service itself fails, status page becomes stale
  - *Mitigation*: Implement monitoring service health check and fallback messaging on status page indicating last successful update

- **CSV File Growth**: Historical data in CSV format will grow unbounded over time
  - *Mitigation*: Implement file rotation, archival, or migration to database when file size exceeds threshold

- **Static Asset Staleness**: If generation process fails, status page shows outdated information
  - *Mitigation*: Include timestamp on status page and prominent warning if data is older than expected threshold

- **False Positives**: Network issues between monitor and service could incorrectly report service as down
  - *Mitigation*: Require multiple consecutive failures before marking service as down, document monitoring location

- **Accessibility Compliance**: Status visualization might not meet WCAG 2.2 AAA accessibility standards (more stringent than typical government requirements)
  - *Mitigation*: Use GOV.UK Design System components as specified, conduct comprehensive WCAG 2.2 AAA accessibility testing including automated scanning and manual testing with assistive technologies before launch
