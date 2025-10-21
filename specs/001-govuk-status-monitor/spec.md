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

**Independent Test**: Can be tested by querying the JSON API or reading the CSV file to access historical performance metrics. Delivers value by enabling automated trend analysis and reliability assessment.

**Acceptance Scenarios**:

1. **Given** services have been monitored over time, **When** I access the JSON API, **Then** I can retrieve historical health check results for analysis
2. **Given** historical data exists in CSV format, **When** I read the CSV file, **Then** I can identify when outages occurred, their duration, and latency patterns
3. **Given** I am consuming historical data, **When** I parse the records, **Then** I can calculate uptime percentages over different time periods (hours, days, weeks)

---

### User Story 4 - Consume Service Status via API (Priority: P3)

As a developer or automated system, I need to access current service status data in machine-readable format, so I can integrate status information into other applications and monitoring dashboards.

**Why this priority**: API access enables automation and integration but depends on the core monitoring functionality (P1) being operational first.

**Independent Test**: Can be tested by making an HTTP request to the JSON endpoint and receiving structured status data. Delivers value by enabling programmatic access.

**Acceptance Scenarios**:

1. **Given** the status monitor is running, **When** I request the JSON data endpoint, **Then** I receive current status for all monitored services in structured format
2. **Given** I am consuming the API, **When** I parse the JSON response, **Then** I can identify service names, current status, latency metrics, and last check time
3. **Given** the HTML page is updated, **When** the JSON file is generated, **Then** both contain identical status information

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

- What happens when a service check times out or fails to connect (network error, DNS failure, etc.)?
- How does the system handle services that are configured but not yet reachable?
- What happens when the YAML configuration file contains invalid syntax or missing required fields? (Answer: System fails to start, outputs detailed validation errors to stderr/logs, exits with non-zero code)
- How does the system behave when storage (CSV file) cannot be written due to permissions or disk space issues? (Answer: Process fails with non-zero exit code - storage failures are critical operational errors)
- What happens when services respond very slowly (e.g., 30+ seconds) but eventually complete?
- How does the system handle simultaneous monitoring of many services (e.g., 100+) with different check intervals?
- What happens when a previously monitored service is removed from the configuration?
- How does the system present status when no historical data exists yet for a service?
- What happens if the static HTML/JSON generation fails mid-process?
- How does the page display when accessed via assistive technologies (screen readers)?
- What happens when expected status code doesn't match actual response (e.g., expecting 200, receiving 500)?
- What happens when expected response text is not found in the response body?
- How does the system handle POST requests that fail due to invalid payload format?
- What happens when custom headers are required but not properly formatted in the configuration?
- How does the system behave when a service has no tags defined? (Answer: Allow but display in "Untagged" section - shown separately at bottom of page with "Untagged Services" heading)
- What happens when multiple services share the exact same name? (Answer: Configuration validation fails at startup - duplicate names are validation errors, system refuses to start)
- What happens when response body is too large to search for expected text efficiently? (Answer: Read first 100KB only - text validation searches within first 100KB, ignoring remainder)
- What happens when expected Location header doesn't match actual redirect location?
- How does verbose debug logging handle sensitive data in request/response bodies (e.g., API keys, tokens)?
- What happens when metrics telemetry system is unavailable or unreachable? (Answer: Buffer metrics in memory with size limit - queue until telemetry recovers, drop oldest when buffer full)
- What happens when configuration file is modified while the service is running (given FR-032 supports config reloads)?
- How are validation errors communicated in orchestration environments (Kubernetes, systemd) where stderr may not be visible?

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

#### Health Check Execution

- **FR-008**: System MUST perform HTTP(S) health checks against configured service endpoints using the specified method (GET, HEAD, or POST)
- **FR-009**: System MUST execute health checks at configurable intervals (default 60 seconds if not specified per-service)
- **FR-010**: System MUST include custom headers in requests when specified in service configuration
- **FR-011**: System MUST send POST payloads when method is POST and payload is configured
- **FR-012**: System MUST record the response latency (time from request to first response byte) for each health check attempt
- **FR-013**: System MUST validate response status code matches expected status code
- **FR-014**: System MUST validate response body contains expected text when text validation is configured, searching within the first 100KB of response body only
- **FR-014a**: System MUST validate response headers match expected header values when header validation is configured (e.g., Location header for redirects)
- **FR-015**: System MUST record health checks as FAILED when: network error occurs, timeout exceeded, unexpected status code received, expected text not found, or expected header value mismatch
- **FR-016**: System MUST record failure reason (connection timeout, DNS failure, HTTP error code, text mismatch, etc.) for failed checks
- **FR-017**: System MUST support configurable timeout values per service (default 30 seconds if not specified)

#### Data Storage & History

- **FR-018**: System MUST persist historical health check results in CSV format with: timestamp, service name, status (pass/fail), latency, and failure reason
- **FR-019**: System MUST support extensible storage backends beyond CSV for future scalability (architecture must allow backend swapping)
- **FR-020**: System MUST append new check results to historical data without requiring full data reload
- **FR-020a**: System MUST exit with non-zero exit code if CSV file cannot be written due to permissions, disk space, or other I/O errors

#### Status Page Generation

- **FR-021**: System MUST generate a static HTML page compliant with GOV.UK Design System showing current service status only (no historical data embedded)
- **FR-022**: System MUST generate a JSON file containing both current service status and historical performance data for programmatic access
- **FR-023**: System MUST display failing services at the top of the HTML status page, before healthy services, in a single flat list
- **FR-024**: System MUST display all tags associated with each service as visible labels on the status page
- **FR-024a**: System MUST display services without tags in a separate "Untagged Services" section at the bottom of the status page (after all tagged services)
- **FR-025**: System MUST use GOV.UK Design System tag components to render service category tags
- **FR-026**: System MUST indicate the time of the last status check for each service
- **FR-027**: System MUST provide clear visual indicators distinguishing between healthy (passing validations) and failed (failing validations) service states
- **FR-028**: System MUST update static HTML and JSON files after each health check cycle completes
- **FR-029**: HTML page MUST automatically refresh status information at 60-second intervals (browser-based refresh)

#### Service Operation

- **FR-030**: System MUST operate as a background service that generates static assets without requiring runtime web server requests
- **FR-031**: System MUST support extensible health check probe types beyond HTTP(S), with HTTP(S) polling as the initial implementation
- **FR-032**: System MUST gracefully handle configuration reloads without dropping in-flight health checks

#### Observability & Logging

- **FR-033**: System MUST emit structured logs for each health check execution including: timestamp, service name, result (pass/fail), latency, HTTP status code, and correlation ID
- **FR-034**: System MUST support verbose debug logging mode (controlled by environment variable) that logs full HTTP request/response headers and bodies for troubleshooting
- **FR-035**: System MUST emit metrics telemetry including: total checks executed, checks passed/failed, latency percentiles (p50, p95, p99), and services up/down counts
- **FR-035a**: System MUST buffer metrics in memory (with configurable size limit) when telemetry system is unavailable, flushing when connection recovers
- **FR-035b**: System MUST drop oldest buffered metrics when buffer limit is reached to prevent unbounded memory growth
- **FR-036**: System MUST use consistent correlation IDs across logs for a single health check execution to enable request tracing

### Key Entities

- **Ping/Service**: Represents a public service or infrastructure component being monitored. Attributes include name, protocol (HTTP/HTTPS), method (GET/HEAD/POST), resource URL, tags array, expected validation criteria (status code, optional text), optional custom headers, optional POST payload, current health status, last check time, and last latency measurement.
- **Health Check Result**: Represents the outcome of a single monitoring probe execution. Attributes include target service name, timestamp, method used, result status (pass/fail), response latency, HTTP status code received, expected status code, text validation result (if configured), and failure reason (if failed).
- **Tag**: Represents a category label displayed with each service for visual identification. Attributes include tag name. Tags enable flexible multi-dimensional categorization (e.g., by department, function, infrastructure layer) without requiring hierarchical grouping or filtering UI.
- **Expected Validation**: Represents criteria for determining service health. Attributes include expected HTTP status code, optional expected response body text, and optional expected response headers (e.g., Location for redirect validation). A service passes validation only when all configured criteria are met.
- **Configuration**: Represents the complete monitoring setup defined in YAML. Attributes include array of ping definitions under `pings` key, global settings (check intervals, timeouts), and tag definitions for display organization.
- **Historical Record**: Represents time-series data for service health stored in CSV. Attributes include service name, timestamp, pass/fail status, latency measurement, failure reason, and validation details.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify current operational status of any monitored service within 3 seconds of accessing status.gov.uk
- **SC-002**: System monitors and reports status for at least 50 public services concurrently without performance degradation
- **SC-003**: Status page loads in under 2 seconds on standard government network connections
- **SC-004**: 95% of health checks complete within their configured timeout period under normal conditions
- **SC-005**: Status information updates reflect actual service state within 2 minutes of a service failure or recovery
- **SC-006**: Static HTML and JSON current status data remain synchronized (both show same current health state) at all times; JSON additionally includes historical data not present in HTML
- **SC-007**: Status page meets WCAG 2.1 AA accessibility standards for screen reader compatibility and keyboard navigation
- **SC-008**: Historical data enables identification of service uptime percentage over rolling 24-hour, 7-day, and 30-day periods
- **SC-009**: Tag labels displayed on each service enable users to visually identify related service failures by category (e.g., department, infrastructure layer) without requiring navigation or filtering
- **SC-010**: API consumers can retrieve both current status and historical performance data for all services via a single JSON file request

## Configuration Structure

The YAML configuration file defines all monitored services and global settings. Based on the provided draft configuration, the structure includes:

### Core Configuration Elements

```yaml
# Global settings (optional, with defaults)
settings:
  check_interval: 60        # Default interval between checks (seconds)
  timeout: 30               # Default HTTP timeout (seconds)
  page_refresh: 60          # Browser auto-refresh interval (seconds)
  max_retries: 3            # Failed check retry attempts before marking as down
  history_file: "history.csv"     # CSV file path for historical data
  output_dir: "./output"    # Directory for generated HTML/JSON

# Environment variables (runtime configuration):
# DEBUG_VERBOSE=true|false         # Enable verbose debug logging (full HTTP req/res)
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
    timeout: 30                      # Optional: Override default timeout
```

### Example from Draft Configuration

The draft config.yaml demonstrates service validation patterns:
1. HTTP GET with status and text validation
2. HTTPS HEAD with status-only validation
3. HTTP POST with custom headers and payload
4. HTTP redirect validation (301) with expected Location header

All services use tag-based categorization (e.g., "health", "driving licences", "roads", "ministry of foo") enabling flexible multi-dimensional organization on the status page.

## Assumptions

- GOV.UK Design System components (notification banner, warning text, tables, summary lists, tags) will be sufficient to display status information effectively
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
- Health check results are binary (pass/fail) - no "degraded" or "warning" states in initial implementation
- Services can tolerate health check requests at 60-second intervals without rate limiting or blocking
- Configuration changes require service restart (no hot-reload in initial implementation; FR-032 allows graceful reload without dropping checks)
- Deployment environments (systemd, Kubernetes, etc.) expect fail-fast behavior and will surface non-zero exit codes appropriately
- Configuration validation errors are deployment-time issues requiring administrator intervention before service can start
- Structured logging format (JSON or similar) is acceptable for operational integration with log aggregation systems
- Metrics telemetry uses standard observability protocols (e.g., Prometheus, StatsD, or similar) for integration with existing monitoring infrastructure
- Metrics buffer size defaults to 1000 entries if not configured, providing resilience during telemetry outages while limiting memory impact
- Verbose debug logging is disabled by default to prevent performance impact and potential PII exposure

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

- **Accessibility Compliance**: Status visualization might not meet GOV.UK accessibility standards
  - *Mitigation*: Use GOV.UK Design System components as specified, conduct accessibility testing before launch
