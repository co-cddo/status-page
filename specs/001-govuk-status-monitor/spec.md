# Feature Specification: GOV.UK Public Services Status Monitor

**Feature Branch**: `001-govuk-status-monitor`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "Build an application that will resemble downdetector (use perplexity to research this), I have also provided screenshots of it attached. The purpose of the application is to provide a new service that will be hosted on status.gov.uk that will show the health of public services and related underlying infrastructre within the supplychain. The probes that are run for the healthchecks will be extendible but we'll start with timed HTTP(s) polling (i.e. record the latency from request to response). configuration will be managed by a yaml file. The display will highlight failing services first, the yaml file will contain a hiearchy for everything else, the html display will respect this. it will record a history in a CSV file, though this storage backend will be extended, in the future, it will also generate a static html page that is compliant with the gov.uk design system using the frontend design toolkit (research this with perplexity, websearch, webfetch). the main application is just running as a backend service that generates static assets in order to deliver performance. in addition to the static html, it will also make the same data available in a json file for APIs to poll."

## Clarifications

### Session 2025-10-21

- Q: How should the system handle HTTP redirects (301, 302, 307) - automatically follow them, treat as failures, or validate them? → A: The probe should be configured with the expected status code (e.g., 301) and validate the Location header matches the expected redirect URL. The system does not automatically follow redirects; instead it validates redirect responses when explicitly configured with expected status and Location header.

### Session 2025-10-22

- Q: What happens when a PR includes both config.yaml changes and application code changes? → A: Run application tests first, fail fast. Only proceed to smoke tests if application tests pass. This ensures code quality is validated before spending CI resources on config validation.
- Q: What happens when the smoke test workflow cannot post a comment to the PR (permissions issue, API failure)? → A: Fail the entire workflow - treat comment posting as critical for merge approval. If smoke test results cannot be communicated to PR reviewers, the workflow must fail to ensure visibility of configuration impact before merge.
- Q: What happens when the scheduled deployment workflow fails mid-execution (after health checks but before deployment)? → A: Log the error and mark the workflow run as failed, but retain generated artifacts for manual recovery. Emit alerts for monitoring. This ensures operators are notified while preserving completed work for debugging or manual deployment.
- Q: What happens when GitHub Pages is not yet enabled on the repository when deployment workflow runs? → A: Attempt deployment without checking - let GitHub API return error if Pages not enabled. GitHub Pages should be enabled during development phase using gh CLI commands locally as a one-time setup step. Workflow logic should not check or auto-configure this prerequisite.
- Q: What happens when all monitored services fail during the smoke test on a config.yaml PR - should the PR be blocked? → A: Allow PR to pass but include prominent warning in comment. Smoke test validates configuration correctness, not service availability. Widespread failures may indicate legitimate outages, network issues from runners, or config issues requiring author judgment.
- Q: How should GitHub Actions workflow permissions be configured for security in this open source repository? → A: Workflow permissions MUST be defined explicitly using principle of least privilege. Research security best practices for open source GitHub Actions workflows using Perplexity/Context7 before implementation. Never use default permissive permissions; specify exact scopes needed per workflow (e.g., contents: read, pull-requests: write for smoke test comments).
- Q: What should the npm test command execute and how should it behave on failures? → A: npm test MUST run all test suites in order: unit tests, end-to-end tests, accessibility tests, coverage validation, and performance tests. Command MUST exit with non-zero exit code if any test suite fails. This ensures comprehensive validation in CI and local development.
- Q: How should the CSV historical data file persist across scheduled workflow runs in GitHub Actions? → A: CSV file MUST be appended to (not overwritten). Use GitHub Actions cache to retrieve CSV from previous execution, append new health check results, and include updated CSV in GitHub Pages publish. Fallback chain: (1) restore from Actions cache, (2) if cache miss, fetch last published CSV from GitHub Pages, (3) if that fails/empty, assume first run and create new CSV. This ensures historical data continuity without external storage dependencies.
- Q: What happens when GitHub Actions cache limit is reached for CSV file? → A: Fail the workflow immediately - treat cache limit as fatal error requiring manual intervention. Operators must rotate/archive CSV data before workflow can succeed. This fail-fast approach ensures cache issues are addressed promptly rather than silently degrading service.
- Q: What happens when fetching the last CSV from GitHub Pages fails due to network error? → A: Fail the workflow immediately - treat network error as fatal requiring manual intervention. Network errors indicate infrastructure issues that should be resolved before continuing. Fail-fast prevents silently creating new CSV and losing historical data continuity.
- Q: What happens when the restored CSV file is corrupted or has invalid format? → A: Validate CSV on restore (check headers, parse sample rows). If corrupted, log error, emit monitoring alert, and fall through to next fallback tier. Cache corruption is transient and recoverable by moving to next tier, unlike network/infrastructure errors which require manual intervention.
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
- Q: Should additional security controls be implemented for debug logging beyond documentation warnings (e.g., production environment restrictions, audit logging, automatic PII redaction)? → A: No additional controls needed - current approach with documentation warnings is sufficient given the absence of secrets in code/build presently. Operators remain responsible for log access controls and appropriate debug mode usage.
- Q: What directory structure should be used for generated static assets (HTML, JSON, CSV) in the output directory for GitHub Pages deployment? → A: Flat structure - index.html, status.json, and history.csv all in output root directory, deployed to GitHub Pages root. This follows static site conventions and provides clean URLs (status.gov.uk/ for the page, status.gov.uk/status.json and status.gov.uk/history.csv for data access).
- Q: Which HTTP client library should be used for performing health check requests (GET/HEAD/POST with custom headers, timeouts, and redirect validation)? → A: Native Node.js fetch() API (built-in to Node.js 22+). This provides zero-dependency HTTP client functionality with modern promise-based interface, supports all required features (custom headers, POST payloads, timeout via AbortController, redirect control), and reduces supply chain risk in open source government project.
- Q: Which template engine should be used for generating static HTML pages compliant with GOV.UK Design System? → A: Nunjucks - officially recommended template engine by GOV.UK Design System/Frontend. Provides Jinja2-like syntax, excellent GOV.UK-specific documentation and examples from GDS, supports layouts/partials/macros for maintainability, and ensures compatibility with GOV.UK components.
- Q: Which YAML parser library should be used for reading and validating the configuration file (with detailed error reporting for syntax errors, missing fields, invalid values)? → A: js-yaml - most established and widely-used YAML parser in Node.js ecosystem. Provides comprehensive error reporting for validation, supports schema validation, well-maintained with strong security track record.
- Q: Which test frameworks should be used for the comprehensive test suite (unit, e2e, accessibility, coverage, performance tests executed via npm test)? → A: Vitest for unit tests (faster execution, native ESM support, excellent TypeScript integration) + Playwright for e2e and accessibility tests (comprehensive a11y testing with axe-core integration, cross-browser support, modern web testing standard). This provides best-in-class tooling for each test type with cohesive TypeScript/ESM support.
- Q: How should GOV.UK Design System assets (CSS, JavaScript, images) be included in the generated HTML file? → A: Self-contained single file - all dependencies MUST be inlined including base64-encoded images, inlined CSS, and inlined JavaScript. The generated index.html must require only one HTTP request with zero external dependencies, ensuring maximum reliability and performance.
- Q: Should HTML asset inlining be part of the template generation phase or a post-build processing step, and which tool should be used? → A: Post-build processing step - Nunjucks generates standard HTML with external references, then a separate post-processing step inlines all assets. For tool choice: Custom Node.js/TypeScript script using native Node.js 22+ features (file operations, DOM parsing) is recommended for maximum auditability, zero additional dependencies, and full control over GOV.UK asset handling in security-critical government context. Alternative: inline-source npm package provides proven turnkey solution with moderate dependencies if custom script maintenance burden is prohibitive.
- Q: What mechanism should be used for automatic HTML page refresh (meta refresh tag, JavaScript fetch/polling, or JavaScript page reload)? → A: Meta refresh tag - use `<meta http-equiv="refresh" content="60">` for simplicity, broad compatibility, and accessibility. This approach works without JavaScript and ensures status updates for all users including those with JavaScript disabled.
- Q: Which metrics telemetry protocol/system should be used for operational monitoring? → A: Prometheus - industry-standard pull-based metrics system with excellent Node.js client library support, wide adoption in government/enterprise environments, and strong integration with monitoring infrastructure (Grafana, AlertManager).
- Q: Which GitHub Action should be used for deploying generated assets to GitHub Pages? → A: actions/deploy-pages - official GitHub-maintained action providing reliable deployment with proper artifact handling and status reporting.
- Q: Should CSV file rotation be automated or manual, and at what threshold? → A: Manual rotation only - operators must manually archive/rotate CSV files before GitHub Actions cache limits are reached. No automated rotation implemented. System fails when cache limit reached, forcing manual intervention.
- Q: What application packaging/deployment format should be used (executable, npm package, Docker container, serverless)? → A: Raw code execution for initial implementation - application runs as Node.js/TypeScript code without packaging. GitHub Pages serves as production hosting. Future iterations may deploy as serverless backend publishing to CDN, but this is out of scope for initial release.
- Q: Which specific GOV.UK Design System npm package should be used and what version pinning strategy? → A: Use 11ty GOV.UK plugin which handles GOV.UK Design System dependencies. Use current version at time of implementation. Dependabot will create pull requests to keep dependencies up to date.
- Q: How should concurrent health checks be implemented (async/await, worker_threads, cluster, concurrency limiter)? → A: worker_threads module - provides true parallelism for I/O-bound HTTP health checks while respecting CPU core limits defined in worker pool sizing.
- Q: Where should the configuration file be located (fixed path, environment variable, command-line argument)? → A: Fixed path ./config.yaml relative to application root. No environment variable or command-line override supported.
- Q: How should consecutive failure state (for 2-failure HTML display threshold) be tracked across check cycles? → A: Persisted to disk/CSV - failure count tracked in historical data storage, survives service restarts, enables accurate consecutive failure detection across workflow runs.
- Q: What GitHub Pages deployment source should be used (artifact, gh-pages branch, docs/ folder)? → A: Deploy from artifact - modern recommended approach using actions/upload-pages-artifact and actions/deploy-pages for reliable deployment with proper versioning and rollback capability.
- Q: What minimum test coverage percentage is required and which coverage types? → A: 80% minimum for both branch coverage AND line coverage. Coverage validation executed as part of npm test suite; test run fails if either metric falls below 80%.
- Q: What specific thresholds should performance tests validate (execution time, memory, HTML generation)? → A: Placeholder values established from initial benchmark runs during development: measure baseline performance for health check cycle execution time, memory usage, and HTML generation time, then set aggressive initial thresholds. Review and adjust thresholds frequently as implementation evolves rather than pre-defining arbitrary limits.
- Q: How should Prometheus metrics endpoint be configured (port, path, authentication)? → A: Port 9090 (default, configurable via PROMETHEUS_PORT environment variable), path /metrics (fixed), no authentication required. Standard Prometheus scrape endpoint configuration.
- Q: What format should correlation IDs use for request tracing? → A: UUID (v4) - provides globally unique identifiers for tracing health check executions across logs and CSV records without collision risk.
- Q: What validation rules apply to service names in configuration (character restrictions, length limits)? → A: Maximum 100 characters, ASCII characters only (no Unicode/emoji). Enforced during YAML configuration validation at startup.
- Q: What page title and branding should the status page use? → A: Page title: "GOV.UK service status". Follow GOV.UK Design System guidance for services not yet on gov.uk domain (11ty plugin has configuration parameter for this distinction). No Crown logo or official GOV.UK branding until hosted on gov.uk domain.
- Q: How should YAML configuration be validated (programmatic validation vs formal schema)? → A: Formal JSON Schema validation - define JSON Schema for config.yaml structure, use schema validation library (e.g., Ajv) to validate parsed YAML against schema, providing detailed validation error messages for operators.
- Q: What is the application architecture - 11ty project with health checks added, or Node.js app using 11ty as library? → A: Hybrid orchestrator approach - Node.js/TypeScript process (entry point: src/index.ts run via tsx) orchestrates periodic health checks using setInterval, writes results to _data/health.json, then invokes 11ty CLI (npx @11ty/eleventy) as subprocess to regenerate static assets. This separates runtime health checking (Node.js) from build-time HTML generation (11ty), using each tool for its intended purpose.
- Q: What TypeScript compilation workflow should be used? → A: tsx (no compilation) - run TypeScript directly using tsx for both development and production. No tsc compilation step needed. Application executed as: npx tsx src/index.ts
- Q: What npm commands should developers use? → A: npm run build - single command that runs health check orchestrator which internally triggers 11ty builds. No separate dev/start commands for initial implementation.
- Q: What is the application entry point? → A: src/index.ts - Node.js orchestrator script that: (1) performs health checks on interval, (2) writes results to _data/health.json, (3) invokes 11ty CLI to regenerate HTML/JSON from updated data
- Q: What happens before first health check completes on initial startup? → A: Wait for first cycle - system waits for first complete health check cycle before generating initial HTML/JSON files. All services show "Pending" status during first cycle. This ensures initial page deployment contains actual health data rather than empty state.
- Q: How should retry logic work for failed health checks (max_retries: 3 in config)? → A: Immediate retries for network errors only - retry up to 3 times immediately (no delays, no exponential backoff) for network errors (connection refused, DNS failure, timeout). Retries do NOT count toward "2 consecutive failures" threshold for HTML display. All other failures (status code mismatch, text validation failure) are not retried.
- Q: When exactly is static HTML regenerated? → A: After every health check cycle completion - HTML/JSON files regenerated after each complete health check cycle regardless of whether any service status changed. This ensures consistent update frequency and timestamps.
- Q: What Prometheus metrics labels should be included for health check monitoring? → A: Use service_name, status, and low-cardinality static tags as labels. Expose: (1) health_checks_total counter with labels {service_name, status}, (2) health_check_latency_seconds histogram with label {service_name}, (3) services_failing gauge with no per-service labels (aggregate count). Do NOT include dynamic/high-cardinality service tags as Prometheus labels to prevent cardinality explosion. Keep Prometheus labels bounded and known.
- Q: What validation rules apply to service tags in configuration? → A: ASCII characters only, lowercase normalized, maximum 100 characters per tag. Tag names validated during JSON Schema validation at startup. Tags must be static strings (no dynamic values). System fails to start if tag validation fails.
- Q: How long should system wait for in-flight health checks during graceful shutdown? → A: Maximum 30 seconds - system waits up to 30 seconds for in-flight health checks to complete during graceful shutdown, then forces termination. This prevents indefinite hangs while allowing reasonable completion time for slow checks.
- Q: How is custom domain (status.gov.uk) configured? → A: Future configuration out of scope - status.gov.uk is the intended production domain name but DNS/CNAME configuration not part of initial implementation. GitHub Pages will serve from default github.io domain initially. Custom domain setup documented separately for future production deployment.
- Q: What data structure and protocol should worker threads use for health check results? → A: Message passing with typed interfaces - use postMessage/on('message') (not SharedArrayBuffer). Define TypeScript interfaces for WorkerMessage with type discriminators (result/error/progress). Results include: correlationId (UUID v4), serviceName, status, latency, httpStatusCode, failureReason, timestamp. Workers are long-lived in pool. Implement correlation ID tracking, task-level timeouts, worker lifecycle management (auto-restart on failure), and structured error handling with graceful degradation.
- Q: What files are included in GitHub Pages deployment artifact? → A: index.html (self-contained status page), status.json (current status API), history.csv (historical data), favicon.ico (if present), robots.txt (if present). All files placed in flat structure in artifact root, deployed to GitHub Pages root for clean URLs.
- Q: What is the 11ty project structure for GOV.UK plugin? → A: Standard 11ty structure - eleventy.config.js (or .js) in root for configuration, _includes/ directory for layouts/partials/macros, _data/ directory for data files (health.json written here by orchestrator), src/ or root for content files. GOV.UK plugin provides layouts via plugin - no custom layout files needed initially. Output directory configurable (default _site/ or dist/). Configuration imports and registers @x-govuk/govuk-eleventy-plugin.
- Q: How is consecutive failure count stored in CSV for "2 consecutive failures" tracking? → A: Derived from consecutive FAIL statuses in CSV - no separate column needed. On HTML generation, system reads recent CSV records per service and counts consecutive FAIL statuses. If count >= 2, service displayed as DOWN on HTML page. This keeps CSV structure simple while enabling stateful tracking across restarts.

## Development Process Guidance

### Research & Documentation Tools

During planning and implementation phases, development teams are **strongly encouraged** to leverage:

- **Context7 MCP Integration**: For retrieving up-to-date documentation, API references, and code examples for dependencies including:
  - GOV.UK Design System and Frontend Toolkit
  - Node.js and TypeScript ecosystem libraries
  - Testing frameworks (Jest, Playwright, etc.)
  - GitHub Actions workflow syntax and best practices

- **Perplexity Research**: For exploring:
  - Current best practices in status page design and implementation patterns
  - GOV.UK Design System component usage examples and accessibility patterns
  - HTTP health check implementation strategies and edge case handling
  - CSV vs. database storage tradeoffs for time-series health data
  - GitHub Pages deployment configurations and limitations
  - WCAG 2.2 AAA compliance techniques and testing approaches
  - **GitHub Actions security best practices for open source repositories** (principle of least privilege, workflow permissions, secret handling)

These tools provide current, accurate technical information that reduces implementation risk and ensures alignment with latest standards and best practices. Teams should use these resources proactively rather than relying solely on prior knowledge or outdated documentation.

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

### User Story 6 - Configuration Change Validation via CI (Priority: P2)

As a service operator or administrator, I need automated validation and feedback when proposing configuration changes, so I can understand the impact of my changes before merging them to production.

**Why this priority**: Configuration changes directly affect which services are monitored and how they're validated. Automated smoke testing prevents misconfigurations from reaching production while providing visibility into how changes affect service health checks.

**Independent Test**: Can be tested by creating a PR that modifies config.yaml and verifying the smoke test workflow runs and posts formatted results as a comment. Delivers value by catching configuration errors early and showing health check outcomes before merge.

**Acceptance Scenarios**:

1. **Given** I create a PR that modifies config.yaml, **When** CI runs, **Then** a smoke test executes all configured health checks and posts results in a formatted Markdown comment
2. **Given** the smoke test completes, **When** I view the PR comment, **Then** I see each service's health status, latency, HTTP status code, and any failure reasons
3. **Given** my PR only changes config.yaml, **When** CI runs, **Then** application tests are skipped and only the smoke test executes
4. **Given** my PR changes both config.yaml and application code, **When** CI runs, **Then** application tests execute first; smoke tests only run if application tests pass (fail-fast on code quality)
5. **Given** the CI workflow completes, **When** tests pass, **Then** I can merge the PR (main branch protection requires passing tests)

---

### User Story 7 - Automated Status Page Deployment (Priority: P1)

As a service operator, I need the status page to automatically update on a regular schedule, so users always see current service health information without manual intervention.

**Why this priority**: Automatic deployment is the core operational mechanism that keeps the status page current. Without this, the monitoring system cannot fulfill its primary purpose of providing up-to-date service status.

**Independent Test**: Can be tested by verifying the scheduled workflow runs every 5 minutes, executes health checks, generates HTML/JSON assets, and deploys them to GitHub Pages. Delivers immediate value by automating the entire monitoring and publishing pipeline.

**Acceptance Scenarios**:

1. **Given** the scheduled workflow is configured, **When** 5 minutes elapse, **Then** the workflow automatically triggers and executes all health checks
2. **Given** health checks complete, **When** the workflow continues, **Then** static HTML and JSON files are generated with current status data
3. **Given** assets are generated, **When** deployment executes, **Then** new files are published to GitHub Pages within 30 seconds
4. **Given** I need to trigger an immediate update, **When** I manually dispatch the workflow, **Then** it runs immediately without waiting for the next scheduled interval
5. **Given** the deployment completes, **When** I access status.gov.uk, **Then** I see the page generation timestamp showing the time of the most recent deployment

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
- What happens when Prometheus metrics endpoint cannot be scraped or is unavailable? (Answer: Buffer metrics in memory with size limit (default 1000 entries) - queue until Prometheus scraper recovers, drop oldest when buffer full to prevent unbounded memory growth)
- What happens when configuration file is modified while the service is running (given FR-032 supports config reloads)? (Answer: Manual restart required - config changes only take effect after service restart. System completes in-flight checks gracefully before shutdown to prevent data loss)
- How are validation errors communicated in orchestration environments (Kubernetes, systemd) where stderr may not be visible? (Answer: stderr only - orchestration platforms capture stderr logs. Operators use platform-native tools (journalctl, kubectl logs) to view errors. Non-zero exit code triggers restart/failure state for monitoring)
- What happens when a PR includes both config.yaml changes and application code changes? (Answer: Run application tests first, fail fast. Only proceed to smoke tests if application tests pass. This ensures code quality is validated before spending CI resources on config validation)
- What happens when the smoke test workflow cannot post a comment to the PR (permissions issue, API failure)? (Answer: Fail the entire workflow - comment posting is critical for merge approval. If smoke test results cannot be communicated to PR reviewers, workflow must fail to ensure visibility of configuration impact)
- What happens when the scheduled deployment workflow fails mid-execution (after health checks but before deployment)? (Answer: Log the error and mark workflow run as failed, but retain generated artifacts for manual recovery. Emit alerts for monitoring. This ensures operators are notified while preserving completed work for debugging or manual deployment)
- What happens when GitHub Pages is not yet enabled on the repository when deployment workflow runs? (Answer: Attempt deployment without checking - let GitHub API return error if Pages not enabled. GitHub Pages should be enabled during development phase using gh CLI locally as one-time setup. Workflow should not check or auto-configure this prerequisite)
- What happens when all monitored services fail during the smoke test on a config.yaml PR - should the PR be blocked? (Answer: Allow PR to pass but include prominent warning in comment. Smoke test validates configuration correctness, not service availability. Widespread failures may indicate legitimate outages, network issues from runners, or config issues requiring author judgment)
- How should GitHub Actions workflow permissions be configured for security? (Answer: Explicitly define permissions using principle of least privilege. Research security best practices for open source workflows before implementation. Never use default permissive permissions; specify exact required scopes per workflow)
- What test suites should npm test execute? (Answer: Run all test suites in order - unit, e2e, accessibility, coverage validation, performance. Exit with non-zero code if any suite fails)
- What happens when only one test suite fails (e.g., accessibility) but others pass? (Answer: npm test MUST exit with non-zero code, failing the entire test run. All test suites must pass for npm test to succeed. This ensures no quality dimension is compromised)
- How should CSV historical data persist across scheduled workflow runs? (Answer: Append to CSV using three-tier fallback: (1) restore from GitHub Actions cache, (2) fetch from last GitHub Pages publish if cache miss, (3) create new CSV if both fail. Updated CSV included in each Pages publish)
- What happens when GitHub Actions cache limit is reached for CSV file? (Answer: Fail workflow immediately - treat as fatal error requiring manual intervention. Operators must rotate/archive CSV before workflow can succeed. Fail-fast ensures cache issues addressed promptly)
- What happens when fetching the last CSV from GitHub Pages fails due to network error? (Answer: Fail workflow immediately - treat network error as fatal requiring manual intervention. Network errors indicate infrastructure issues that must be resolved. Fail-fast prevents silently creating new CSV and losing historical data continuity)
- What happens when the restored CSV file is corrupted or has invalid format? (Answer: Validate CSV on restore (check headers, parse sample rows). If corrupted, log error, emit alert, fall through to next fallback tier. Cache corruption is transient and recoverable by moving to next tier, unlike infrastructure errors requiring manual intervention)
- How does the system handle GOV.UK Design System asset inlining (CSS, JS, images) when generating the self-contained HTML file? (Answer: Two-phase process - 11ty with GOV.UK plugin generates standard HTML with external references, then post-build script inlines all assets (CSS in `<style>` tags, JavaScript in `<script>` tags, images as base64 data URIs). If asset loading, base64 encoding, or inlining fails during post-build phase, treat as fatal error and fail with non-zero exit code to prevent deploying incomplete/broken HTML)
- What happens when service name exceeds 100 characters or contains non-ASCII characters? (Answer: Configuration validation fails at startup - service name length and character restrictions enforced during JSON Schema validation, system refuses to start with detailed error message)
- What happens when configuration file is not found at ./config.yaml? (Answer: Fail startup with clear error message indicating config file missing at expected fixed path, exit with non-zero code)
- What happens when correlation ID generation fails (UUID library unavailable or error)? (Answer: Fail health check execution - treat correlation ID generation failure as fatal error, log error message, mark check as failed to ensure traceability is never compromised)
- What happens when test coverage falls below 80% for branch or line coverage? (Answer: npm test exits with non-zero code failing the test run - coverage validation treats below-threshold coverage as test failure, preventing merge in CI)
- What happens when tag names contain non-ASCII characters or exceed 100 character limit? (Answer: Configuration validation fails at startup - tag validation enforced during JSON Schema validation, system refuses to start with detailed error message identifying invalid tags)
- What happens when worker thread fails or crashes during health check execution? (Answer: Worker lifecycle management auto-restarts failed worker, pending tasks for that worker are rejected and logged with correlation IDs, main thread continues operation with remaining healthy workers in pool)
- What happens when 11ty CLI subprocess invocation fails during HTML generation? (Answer: Log detailed error with stderr output, mark generation cycle as failed, retain previous HTML version if available, emit monitoring alert, continue health check cycles - next cycle will retry 11ty generation)
- What happens when graceful shutdown 30-second timeout expires with in-flight health checks still running? (Answer: Force immediate termination - log warning about interrupted checks with correlation IDs, exit with non-zero code, incomplete checks recorded as failures in next startup cycle)
- What happens when health check retry exhausts max_retries for network error? (Answer: Mark check as FAILED after all retries exhausted, record failure reason indicating retries attempted, count as single failure for "2 consecutive failures" threshold, emit monitoring alert)
- What happens when deployment artifact size exceeds GitHub Pages limits? (Answer: Artifact upload fails - workflow fails with clear error message, operators must optimize/reduce asset sizes or investigate bloat, prevents deploying oversized artifacts)

## Requirements

### Functional Requirements

#### Configuration & Setup

- **FR-001**: System MUST read service configuration from a YAML file located at fixed path ./config.yaml (relative to application root) with a `pings` section containing an array of service definitions. YAML configuration MUST be validated against a formal JSON Schema using a schema validation library (e.g., Ajv) to provide detailed validation error messages.
- **FR-002**: Each service definition MUST include: name, protocol (HTTP/HTTPS), method (GET/HEAD/POST), and resource (URL)
- **FR-002a**: Each service definition MAY optionally include tags array; services without tags are displayed in "Untagged Services" section. Tags MUST be validated: ASCII characters only, lowercase normalized, maximum 100 characters per tag, static strings (no dynamic values).
- **FR-003**: Each service definition MUST specify expected validation criteria including status code
- **FR-004**: Each service definition MAY optionally specify expected response text for content validation
- **FR-004a**: Each service definition MAY optionally specify expected response headers for validation (e.g., Location header for redirect validation)
- **FR-005**: System MUST support custom HTTP headers per service (name-value pairs) in outgoing requests
- **FR-006**: System MUST support POST request payloads (JSON format) for services requiring data submission
- **FR-007**: System MUST validate YAML configuration on startup and fail to start if validation errors are detected, outputting all specific errors (invalid syntax, missing required fields, invalid values, duplicate service names) to stderr and logs, then exiting with non-zero exit code. Service names MUST be validated: maximum 100 characters, ASCII characters only (no Unicode/emoji).
- **FR-007a**: System MUST enforce unique service names - duplicate service names are configuration validation errors
- **FR-007b**: System MUST exclude removed services (no longer in configuration) from HTML and JSON status output immediately on next generation cycle after restart; historical CSV data for removed services MUST be preserved indefinitely; no new health checks performed for removed services

#### Health Check Execution

- **FR-008**: System MUST perform HTTP(S) health checks against configured service endpoints using the specified method (GET, HEAD, or POST)
- **FR-009**: System MUST execute health checks at configurable intervals (default 60 seconds if not specified per-service)
- **FR-009a**: System MUST use worker_threads module to implement worker pool (sized to available CPU cores, e.g., 2x cores) for executing health checks concurrently with true parallelism, with priority queue scheduling based on next check time to ensure fair scheduling across all services. Worker threads communicate via message passing (postMessage/on('message')) using typed TypeScript interfaces with correlation IDs (UUID v4). Workers are long-lived with lifecycle management (auto-restart on failure) and structured error handling.
- **FR-010**: System MUST include custom headers in requests when specified in service configuration
- **FR-011**: System MUST send POST payloads when method is POST and payload is configured
- **FR-012**: System MUST record the response latency (time from request to first response byte) for each health check attempt
- **FR-013**: System MUST validate response status code matches expected status code
- **FR-014**: System MUST validate response body contains expected text when text validation is configured, searching within the first 100KB of response body only
- **FR-014a**: System MUST validate response headers match expected header values when header validation is configured (e.g., Location header for redirects)
- **FR-015**: System MUST record health checks as FAILED in CSV and JSON data when: network error occurs, timeout exceeded (exceeds configured timeout threshold), unexpected status code received, expected text not found, or expected header value mismatch (single failure marks service DOWN in data layer for accurate historical tracking)
- **FR-015a**: System MUST require 2 consecutive check cycle failures before displaying a service as DOWN on the HTML status page to reduce noise from transient network issues for end users. Consecutive failure count derived from recent CSV records per service (no separate column needed) - system counts consecutive FAIL statuses in CSV during HTML generation. If count >= 2, service displayed as DOWN.
- **FR-015b**: System MUST record health checks as DEGRADED when response succeeds (passes all validations) but latency exceeds warning_threshold (default 2 seconds)
- **FR-016**: System MUST record failure reason (connection timeout, DNS failure, HTTP error code, text mismatch, header mismatch, etc.) for failed checks
- **FR-017**: System MUST support configurable timeout values per service (default 5 seconds if not specified); requests exceeding timeout are terminated and marked as FAILED
- **FR-017a**: System MUST support configurable warning_threshold values per service (default 2 seconds if not specified); successful responses exceeding warning_threshold are marked as DEGRADED
- **FR-017b**: System MUST support configurable retry logic (max_retries, default 3): retry failed health checks immediately (no delays, no exponential backoff) for network errors only (connection refused, DNS failure, timeout). Retries do NOT count toward "2 consecutive failures" threshold for HTML display. Non-network failures (status code mismatch, text validation failure, header mismatch) are NOT retried.

#### Data Storage & History

- **FR-018**: System MUST persist historical health check results in CSV format with mandatory header row containing column names: timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id. Data rows follow with values: timestamp (ISO 8601 format), service_name, status (PASS/DEGRADED/FAIL in uppercase), latency_ms (integer milliseconds), http_status_code, failure_reason (empty string if passed), correlation_id (UUID v4 for log traceability)
- **FR-019**: System uses CSV storage as the initial implementation. Extensible storage backend architecture (database, cloud storage) is **OUT OF SCOPE** for initial release and deferred to future iterations. CSV implementation MUST be contained within storage module (src/storage/) to facilitate future backend swapping without affecting orchestrator or health check logic.
- **FR-020**: System MUST append new check results to historical data without requiring full data reload
- **FR-020a**: System MUST exit with non-zero exit code if CSV file cannot be written due to permissions, disk space, or other I/O errors
- **FR-020b**: In GitHub Actions deployment workflow, system MUST restore CSV historical data using three-tier fallback approach: (1) restore from GitHub Actions cache (primary), (2) fetch last published CSV file from GitHub Pages if cache miss, (3) create new CSV file only if tier 2 returns 404/file not found (first run scenario). Updated CSV with appended results MUST be saved to Actions cache and included in GitHub Pages deployment.
- **FR-020c**: When GitHub Actions cache limit is reached during CSV save operation, workflow MUST fail immediately with non-zero exit code and clear error message indicating cache limit exceeded. Operators must manually rotate or archive CSV data before workflow can succeed. Workflow does not attempt automatic rotation or fallback to continue without caching.
- **FR-020d**: When fetching the last published CSV from GitHub Pages fails due to network errors (tier 2 fallback), workflow MUST fail immediately with non-zero exit code rather than falling through to tier 3 (create new CSV). Network errors indicate infrastructure issues requiring resolution before workflow continues, preventing silent loss of historical data continuity.
- **FR-020e**: System MUST validate restored CSV file format before use: verify correct headers (timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id), parse sample rows to ensure data integrity. If validation fails (corrupted or invalid format), system MUST log detailed error message, emit monitoring alert, and fall through to next fallback tier. CSV corruption is treated as recoverable (unlike network/cache limit errors) by attempting next tier in fallback chain.

#### Status Page Generation

- **FR-021**: System MUST generate a static HTML page compliant with GOV.UK Design System showing current service status only (no historical data embedded). Page title MUST be "GOV.UK service status". HTML MUST follow GOV.UK Design System guidance for services not yet hosted on gov.uk domain (configured via 11ty GOV.UK plugin parameter); no Crown logo or official GOV.UK branding until hosted on gov.uk domain. HTML generation occurs in two phases: (1) 11ty with GOV.UK plugin generates standard HTML with external asset references (plugin handles GOV.UK Design System dependencies), (2) Post-build processing step inlines all dependencies. The final HTML file MUST be completely self-contained with: CSS styles embedded in `<style>` tags, JavaScript embedded in `<script>` tags, and images (including GOV.UK Design System assets) encoded as base64 data URIs. Post-build inlining implemented via custom Node.js/TypeScript script using native Node.js 22+ features (recommended for zero dependencies and maximum auditability) or inline-source npm package (alternative if maintenance burden prohibitive). The generated index.html MUST require only a single HTTP request with zero external dependencies.
- **FR-022**: System MUST generate a JSON file containing only current service status data (no historical data). JSON structure is an array of service objects with attributes: name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason. Historical data accessed via CSV file directly.
- **FR-023**: System MUST display services on the HTML status page in priority order: failing services first, then degraded services, then healthy services, in a single flat list
- **FR-024**: System MUST display all tags associated with each service as visible labels on the status page
- **FR-024a**: System MUST display services without tags in a separate "Untagged Services" section at the bottom of the status page (after all tagged services)
- **FR-025**: System MUST use GOV.UK Design System tag components to render service category tags
- **FR-026**: System MUST indicate the time of the last status check for each service
- **FR-027**: System MUST provide clear visual indicators distinguishing between healthy (passing validations), degraded (passing validations but slow), failed (failing validations or timeout), and pending (no health check data yet) service states
- **FR-027a**: System MUST display services with no historical data yet (newly added, never checked) with "Unknown" or "Pending" status and "No data yet" message until first check completes
- **FR-028**: System MUST regenerate static HTML and JSON files after each complete health check cycle regardless of whether any service status changed. This ensures consistent update frequency and page generation timestamps. Initial startup waits for first complete health check cycle before generating first HTML/JSON (all services show "Pending" during first cycle).
- **FR-028a**: System MUST exit with non-zero exit code if HTML or JSON file generation fails due to I/O errors (disk full, permissions, etc.), treating generation failures as fatal operational errors
- **FR-029**: HTML page MUST automatically refresh status information at 60-second intervals using meta refresh tag (`<meta http-equiv="refresh" content="60">`). This approach ensures compatibility without JavaScript and provides accessible updates for all users including those with JavaScript disabled.
- **FR-029a**: HTML page MUST meet WCAG 2.2 AAA accessibility standards including: enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text), comprehensive ARIA labels and landmarks, keyboard navigation support, screen reader compatibility, clear focus indicators, and no reliance on color alone for conveying information
- **FR-029b**: HTML page MUST display the page generation timestamp in dual format for accessibility and clarity: relative time for quick comprehension ("2 minutes ago", "1 hour ago") AND absolute ISO 8601 timestamp for precision ("2025-10-22T14:30:00Z"). Implementation MUST use semantic HTML `<time datetime="[ISO 8601]">[relative time]</time>` element. Display format example: "Page last updated: 2 minutes ago (2025-10-22T14:30:00Z)". Relative time updates automatically on meta refresh. Timestamp MUST be distinct from individual service check times and prominently placed at top of page per FR-029b user data freshness verification requirement.
- **FR-029c**: HTML page MUST include Content Security Policy (CSP) via meta tag to prevent XSS and injection attacks per constitution.md Principle VI. CSP directives MUST be configured for self-contained HTML architecture: default-src 'none', style-src 'unsafe-inline' (required for inlined CSS), script-src 'unsafe-inline' (required for inlined JavaScript from GOV.UK Design System), img-src data: (required for base64-encoded images), base-uri 'self', form-action 'none' (status page has no forms). GitHub Pages static hosting prevents custom HTTP CSP headers; meta tag implementation is required. Document 'unsafe-inline' usage rationale in security documentation.

#### Service Operation

- **FR-030**: System MUST operate as a background service that generates static assets without requiring runtime web server requests. Architecture: Hybrid orchestrator - Node.js/TypeScript entry point (src/index.ts run via tsx) orchestrates periodic health checks using setInterval, writes results to _data/health.json, then invokes 11ty CLI (npx @11ty/eleventy) as subprocess to regenerate static assets. This separates runtime health checking (Node.js) from build-time HTML generation (11ty). No TypeScript compilation (uses tsx). Single pnpm run build command per constitution.md Principle VI dependency management requirements.
- **FR-031**: System uses HTTP(S) health checks as the initial implementation. Extensible probe types (TCP, ICMP ping, DNS, database queries, custom protocols) are **OUT OF SCOPE** for initial release and deferred to future iterations. HTTP(S) implementation MUST be contained within health-checks module (src/health-checks/) to facilitate future probe type additions without affecting orchestrator or storage logic.
- **FR-032**: System MUST gracefully handle shutdown during restart (to apply configuration changes) by waiting maximum 30 seconds for in-flight health checks to complete before forcing termination, preventing data loss. Configuration changes require manual service restart to take effect.

#### Observability & Logging

- **FR-033**: System MUST emit structured JSON logs with fields: timestamp (ISO 8601), level (INFO/ERROR/DEBUG), service_name, correlation_id, event_type (e.g., "health_check_complete", "validation_failed"), message, and context object containing relevant data (latency_ms, http_status_code, etc.)
- **FR-034**: System MUST support configurable logging verbosity controlled by DEBUG environment variable with standard log levels (info, error, debug, etc.). Debug level logs full HTTP request/response headers and bodies in the context object for troubleshooting without automatic redaction.
- **FR-034a**: System MUST emit clear security warnings in logs and documentation when debug-level logging is enabled, indicating that sensitive data (API keys, tokens, passwords, PII) will be logged. No additional security controls (environment restrictions, audit logging, automatic redaction) are required beyond documentation warnings given current deployment context without secrets; operators remain responsible for log access controls and appropriate debug mode usage
- **FR-035**: System MUST emit metrics telemetry using Prometheus format/protocol. Metrics exposed via pull-based model using prom-client npm library for Node.js integration. Metrics endpoint MUST be exposed on port 9090 (default, configurable via PROMETHEUS_PORT environment variable) at path /metrics with no authentication required. Required metrics: (1) health_checks_total counter with labels {service_name, status}, (2) health_check_latency_seconds histogram with label {service_name}, (3) services_failing gauge (aggregate count, no per-service labels). Use service_name and status as labels; do NOT include dynamic/high-cardinality service tags as Prometheus labels to prevent cardinality explosion. Keep labels bounded and known.
- **FR-035a**: System MUST buffer metrics in memory (with configurable size limit, default 1000 entries) when Prometheus scraping is unavailable or metrics endpoint unreachable, flushing when connection recovers
- **FR-035b**: System MUST drop oldest buffered metrics when buffer limit is reached to prevent unbounded memory growth
- **FR-036**: System MUST use consistent correlation IDs (UUID v4 format) across logs and CSV records for a single health check execution to enable request tracing and linking logs to historical data

#### CI/CD & Deployment

- **FR-037**: Project MUST use GitHub Actions for continuous integration and deployment workflows
- **FR-037a**: All GitHub Actions workflow files MUST explicitly define permissions using principle of least privilege (never rely on default permissions). Security best practices for open source repositories MUST be researched (using Perplexity/Context7) and applied before finalizing workflow permissions. Example: smoke test workflows require `contents: read` and `pull-requests: write` only.
- **FR-038**: When config.yaml is modified in a pull request, CI MUST run a smoke test workflow that: validates complete configuration syntax and schema, executes full health checks against all configured services, captures check results (pass/degraded/fail status, latency, HTTP codes), and posts results as a formatted Markdown comment on the PR showing consequences of the configuration change
- **FR-038a**: Smoke test workflow MUST fail with non-zero exit code if PR comment cannot be posted (due to permissions, API failures, or other errors), treating comment visibility as critical for merge approval
- **FR-038b**: When all monitored services fail during smoke test execution, workflow MUST still pass (allow PR merge) but include a prominent warning section in the PR comment. Warning section formatting MUST use: `## ⚠️ WARNING: All Services Failed` as Markdown H2 heading at top of comment (before results table), followed by bold introductory sentence `**All configured services failed health checks during this smoke test.**`, followed by bulleted list explaining possible causes (legitimate service outages, GitHub Actions runner network issues, configuration errors in this PR), followed by bold recommendation `**Review the failure reasons below carefully before merging this PR.**`. Warning section MUST maintain accessible formatting (proper heading hierarchy, sufficient contrast for emoji, semantic HTML when rendered by GitHub).
- **FR-039**: Application test suite execution MUST be skipped when the only file changes in a commit/PR are to config.yaml (smoke test runs instead)
- **FR-039a**: When a PR includes both config.yaml changes AND application code changes, CI MUST run application tests first; only if application tests pass should smoke tests execute (fail-fast on code quality before config validation)
- **FR-040**: Application test suite MUST run on changes to any files other than config.yaml, including execution of full health check functionality (service check failures in responses are acceptable and should not fail the test suite)
- **FR-040a**: The `pnpm test` command MUST execute all test suites in sequential order: unit tests, end-to-end (e2e) tests, accessibility (a11y) tests, code coverage validation, and performance tests. The command MUST exit with non-zero exit code if any individual test suite fails, ensuring comprehensive quality validation in both CI and local development environments. Code coverage validation MUST enforce 80% minimum threshold for BOTH branch coverage AND line coverage; test run fails if either metric falls below 80%. Performance tests MUST validate against Constitution Principle V performance budgets: First Contentful Paint (FCP) < 1.8s, Largest Contentful Paint (LCP) < 2.5s, Time to Interactive (TTI) < 3.5s, Cumulative Layout Shift (CLS) < 0.1, Total Blocking Time (TBT) < 300ms, measured on simulated 3G connection (1.6 Mbps down, 768 Kbps up, 300ms RTT). Additional benchmarked thresholds for health check cycle execution time and memory usage established during Phase 1 implementation using 80%-of-baseline formula (allowing 20% headroom for statistical variance and measurement noise while detecting regressions exceeding 1.25x baseline, i.e., threshold at 80% catches slowdowns beyond 125%).
- **FR-041**: Main branch MUST be protected requiring all CI tests (application tests or smoke tests depending on change type) to pass before merging
- **FR-042**: A scheduled GitHub Actions workflow MUST run every 5 minutes (and support manual dispatch) from the main branch that: executes full health check cycle against all configured services, generates static HTML and JSON output files, and deploys generated assets to GitHub Pages using artifact-based deployment (actions/upload-pages-artifact + actions/deploy-pages) for reliable deployment with proper versioning, artifact handling, and status reporting
- **FR-042a**: When scheduled deployment workflow fails mid-execution (after health checks complete but before deployment succeeds), workflow MUST log error details, mark the run as failed, retain generated artifacts (HTML/JSON/CSV files) as workflow artifacts for manual recovery, and emit monitoring alerts to notify operators
- **FR-043**: GitHub Pages MUST be enabled and configured during initial project setup using GitHub CLI (gh) commands run locally by developers; deployment workflow does not check or auto-configure GitHub Pages (workflow fails if Pages not enabled)

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
- **SC-003**: Status page loads in under 2 seconds on 3G network connections (1.6 Mbps download, 768 Kbps upload, 300ms RTT latency) representing median UK mobile user per constitution.md Principle V testing requirements
- **SC-004**: 95% of health checks complete within their configured timeout period under normal conditions
- **SC-005**: Status information updates reflect actual service state within 2 minutes of a service failure or recovery
- **SC-006**: Static HTML and JSON current status data remain synchronized (both show same current health state) at all times; JSON contains only current status, historical data accessed separately via CSV
- **SC-007**: Status page meets WCAG 2.2 AAA accessibility standards for screen reader compatibility, keyboard navigation, and enhanced accessibility requirements
- **SC-008**: Historical data enables identification of service uptime percentage over rolling 24-hour, 7-day, and 30-day periods
- **SC-009**: Tag labels displayed on each service enable users to visually identify related service failures by category (e.g., department, infrastructure layer) without requiring navigation or filtering
- **SC-010**: API consumers can retrieve current status data for all services via JSON file; historical performance data accessed via CSV file (both published to GitHub Pages)
- **SC-011**: GitHub Pages deployment automatically updates within 30 seconds of scheduled workflow completion, ensuring status page reflects latest health check results
- **SC-012**: Pull requests modifying config.yaml receive automated smoke test feedback comments showing health check results for all configured services before merge
- **SC-013**: CSV historical data persists across workflow runs using GitHub Actions cache with GitHub Pages as fallback, maintaining continuity without external storage dependencies

## Configuration Structure

The YAML configuration file (located at fixed path ./config.yaml relative to application root) defines all monitored services and global settings. Configuration is validated against a formal JSON Schema at startup. Based on the provided draft configuration, the structure includes:

### Core Configuration Elements

```yaml
# Global settings (optional, with defaults)
settings:
  check_interval: 60        # Default interval between checks (seconds)
  warning_threshold: 2      # Latency threshold for DEGRADED state (seconds)
  timeout: 5                # HTTP timeout threshold for FAILED state (seconds)
  page_refresh: 60          # Browser auto-refresh interval (seconds)
  max_retries: 3            # Immediate retries for network errors only (no delays)
                            # Retries do NOT count toward "2 consecutive failures"
  worker_pool_size: 0       # Concurrent health check workers (0 = auto: 2x CPU cores)
  history_file: "history.csv"     # CSV file path for historical data
  output_dir: "./output"    # Directory for generated HTML/JSON

# Output Directory Structure:
# Generated static assets use flat structure in output directory:
# - index.html (status page at root, accessible at status.gov.uk/)
# - status.json (current status API at root, accessible at status.gov.uk/status.json)
# - history.csv (historical data at root, accessible at status.gov.uk/history.csv)
# All files deployed to GitHub Pages root for clean URLs without subdirectories.

# GitHub Actions Workflow Context:
# In scheduled deployment workflow, CSV persistence uses three-tier fallback:
# 1. Restore from GitHub Actions cache (primary)
# 2. Fetch last published CSV from GitHub Pages (if cache miss)
# 3. Create new CSV (if both fail - first run scenario)
# Updated CSV with new health check results is:
# - Saved to GitHub Actions cache for next run
# - Published to GitHub Pages alongside HTML/JSON for public access and fallback

# Environment variables (runtime configuration):
# DEBUG=info|error|debug           # Logging verbosity level (default: info)
#                                  # debug level logs full HTTP req/res for troubleshooting
# PROMETHEUS_PORT=9090             # Prometheus metrics endpoint port (default: 9090)
# METRICS_BUFFER_SIZE=1000         # Max metrics to buffer when telemetry unavailable

# Service definitions
pings:
  - name: "Service Name"             # Required: Display name (max 100 chars, ASCII only)
    protocol: HTTP | HTTPS           # Required: Protocol
    method: GET | HEAD | POST        # Required: HTTP method
    resource: "https://url"          # Required: Full URL
    tags:                            # Optional: Array of category tags
      - "department name"            # ASCII only, lowercase normalized, max 100 chars
      - "service type"               # Services without tags shown in "Untagged Services"
      - "infrastructure layer"       # Static strings (no dynamic values)
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
- 11ty GOV.UK plugin handles GOV.UK Design System dependencies and provides configuration for services not yet on gov.uk domain (no Crown logo/official branding)
- GOV.UK Design System assets (CSS, JavaScript, images, fonts) are available at build time for post-build inlining via 11ty plugin and npm packages
- Generated HTML file with all inlined assets (base64 images, CSS, JavaScript) will remain under reasonable size limits (e.g., < 5MB) to ensure fast loading despite single-file approach
- Hybrid orchestrator architecture: Node.js/TypeScript entry point (src/index.ts run via tsx) performs health checks, writes results to _data/health.json, invokes 11ty CLI as subprocess
- 11ty with GOV.UK plugin used for HTML generation with standard project structure: eleventy.config.js in root, _includes/ for layouts, _data/ for data files, configurable output directory
- Post-build asset inlining implemented as custom Node.js/TypeScript script (recommended) using native Node.js 22+ features for zero dependencies and maximum auditability, or inline-source package (alternative) if custom script maintenance is prohibitive
- Three-phase generation: (1) health checks write _data/health.json, (2) 11ty generates HTML with external references, (3) post-build script inlines all assets
- Configuration file located at fixed path ./config.yaml relative to application root; no environment variable or command-line override
- YAML configuration validated using formal JSON Schema with schema validation library (e.g., Ajv) for detailed error reporting
- Worker_threads module provides true parallelism for concurrent health check execution using message passing (not SharedArrayBuffer) with typed TypeScript interfaces
- Consecutive failure count derived from consecutive FAIL statuses in recent CSV records (no separate column); counted during HTML generation
- Initial startup waits for first complete health check cycle before generating initial HTML (all services show "Pending" during first cycle)
- Health check retries: immediate (no delays) for network errors only; retries do NOT count toward "2 consecutive failures" threshold
- HTML regenerated after every health check cycle completion regardless of status changes
- Prometheus metrics use service_name and status labels only (no high-cardinality tag labels)
- Service tags: ASCII only, lowercase normalized, max 100 characters, static strings
- Graceful shutdown: maximum 30-second wait for in-flight health checks before forced termination
- No TypeScript compilation - tsx runs TypeScript directly in development and production
- Single npm run build command - orchestrator handles health checks and 11ty invocations
- GitHub Pages deployment artifact includes: index.html, status.json, history.csv, favicon.ico (if present), robots.txt (if present)
- Custom domain (status.gov.uk) configuration deferred - initial deployment uses github.io domain
- Dependabot automatically creates pull requests to keep npm dependencies (including 11ty plugin) up to date
- js-yaml library provides YAML parsing with comprehensive error reporting and schema validation support for configuration file processing
- Vitest provides unit testing with fast execution, native ESM support, and excellent TypeScript integration
- Playwright provides e2e and accessibility testing with axe-core integration for WCAG 2.2 AAA compliance validation
- Native Node.js fetch() API (built-in to Node.js 22+) provides all HTTP client functionality required for health checks (custom headers, POST payloads, timeout control via AbortController, redirect validation), eliminating need for external HTTP client libraries
- CSV file storage is acceptable for initial deployment with file rotation or archival handled manually
- Status page will be deployed to GitHub Pages with generated static assets accessible via custom domain (status.gov.uk)
- GitHub Pages is enabled and configured as a one-time setup step during project initialization using GitHub CLI (gh) commands run locally by developers before first workflow execution
- GitHub Actions scheduled workflows (cron) provide sufficient reliability for 5-minute check intervals
- GitHub Actions runners have network access to all monitored service endpoints
- Services being monitored expose HTTP(S) endpoints suitable for polling without rate limiting concerns
- YAML configuration will be managed manually (edited by administrators) rather than through a web UI
- Browser-based auto-refresh using meta refresh tag (`<meta http-equiv="refresh" content="60">`) is used for status updates (60-second interval), providing broad compatibility including users with JavaScript disabled
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
- Prometheus metrics telemetry using prom-client npm library provides pull-based metrics exposure on port 9090 (configurable via PROMETHEUS_PORT environment variable) at path /metrics with no authentication, compatible with existing government monitoring infrastructure (Grafana, AlertManager)
- Metrics buffer size defaults to 1000 entries if not configured, providing resilience during Prometheus scraping outages while limiting memory impact
- Correlation IDs use UUID v4 format for globally unique request tracing across logs and CSV records
- Logging defaults to info level; debug level is available via DEBUG environment variable for troubleshooting but disabled by default to prevent performance impact and potential PII exposure
- Repository is open source and requires security-conscious GitHub Actions workflow configuration using explicit least-privilege permissions (researched via Perplexity/Context7 before implementation)
- All test suites (unit, e2e, accessibility, coverage, performance) are maintained and executed via single `npm test` command that fails fast on any suite failure
- Code coverage thresholds enforced at 80% minimum for both branch coverage and line coverage
- Performance test thresholds are placeholders established from initial benchmark runs (health check cycle time, memory usage, HTML generation time) with aggressive initial values adjusted frequently during development
- Service names validated: maximum 100 characters, ASCII characters only (no Unicode/emoji)
- GitHub Actions cache provides reliable storage for CSV historical data between workflow runs (with automatic eviction policies after cache limits or time windows)
- CSV file rotation is manual-only (no automation implemented); operators manually archive/rotate CSV files before GitHub Actions cache limits are reached; system fails when cache limit reached to force manual intervention
- GitHub Pages publishes CSV file alongside HTML/JSON, making it accessible for cache restoration fallback
- CSV historical data continuity is maintained across workflow runs without requiring external persistent storage services
- GitHub Pages deployment uses artifact-based deployment (actions/upload-pages-artifact + actions/deploy-pages) providing reliable artifact handling, versioning, and status reporting
- Application runs as raw Node.js/TypeScript code without packaging (no executable, npm package, Docker container, or serverless deployment); GitHub Pages serves as production hosting; future serverless backend publishing to CDN is out of scope for initial release
- Extensible architecture requirements (FR-019 storage backends, FR-031 probe types) are deferred to post-MVP iterations; initial implementation uses CSV storage and HTTP(S) probes with modular code organization to ease future extension

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
- Automated CSV file rotation or archival (manual operator intervention required)
- Application packaging formats (executable binaries, npm packages, Docker containers, serverless deployments)
- Alternative hosting beyond GitHub Pages (CDN, dedicated servers, cloud hosting platforms)
- JavaScript-based status page refresh mechanisms (using meta refresh tag only)
- Extensible storage backend architecture (CSV only in initial release; database/cloud storage deferred)
- Extensible probe type architecture (HTTP(S) only in initial release; TCP/ICMP/DNS/database probes deferred)
- Plugin system or module registration for third-party extensions

## Dependencies

- Node.js v22+ runtime environment
- tsx for running TypeScript directly without compilation (npm package)
- GOV.UK Design System and Frontend Toolkit availability and documentation
- 11ty (Eleventy) static site generator v3+ (npm package)
- 11ty GOV.UK plugin (npm package) for HTML generation handling GOV.UK Design System dependencies and providing configuration for services not on gov.uk domain
- GOV.UK Design System assets (CSS, JavaScript, images, fonts) available via 11ty plugin and npm packages for post-build inlining
- js-yaml library for YAML configuration parsing (npm package)
- Ajv or similar JSON Schema validation library for YAML schema validation (npm package)
- uuid library for generating UUID v4 correlation IDs (npm package)
- prom-client library for Prometheus metrics telemetry (npm package)
- Vitest testing framework for unit tests (npm package)
- Playwright testing framework for e2e and accessibility tests (npm package)
- Dependabot for automated dependency update pull requests
- GitHub Actions availability for CI/CD workflows and scheduled task execution
- actions/upload-pages-artifact and actions/deploy-pages GitHub Actions for artifact-based GitHub Pages deployment
- GitHub Actions cache availability for CSV historical data persistence between workflow runs
- GitHub Pages hosting capability for static content delivery (including CSV files)
- GitHub CLI (gh) for automated repository configuration
- Network accessibility to monitored service endpoints from GitHub Actions runners and monitoring host
- Network accessibility to GitHub Pages published content from GitHub Actions runners (for CSV fallback retrieval)
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

- **GitHub Actions Reliability**: Scheduled workflows may experience delays or failures due to platform issues, causing status page staleness
  - *Mitigation*: Display page generation timestamp prominently; implement alerting for workflow failures; support manual workflow dispatch for immediate updates

- **GitHub Actions Rate Limits**: Frequent scheduled runs (every 5 minutes) may encounter GitHub Actions usage limits or runner availability constraints
  - *Mitigation*: Monitor workflow execution metrics; optimize check concurrency; consider fallback to longer intervals if limits approached

- **GitHub Pages Deployment Delays**: Static asset deployment to GitHub Pages may experience propagation delays affecting content freshness
  - *Mitigation*: Set expectation of 30-second deployment window in success criteria; include generation timestamp on page; monitor deployment completion times

- **Network Connectivity from Runners**: GitHub Actions runners may have different network paths to monitored services compared to production monitoring host, causing inconsistent results
  - *Mitigation*: Document that smoke tests run from GitHub infrastructure; validate runner network access during setup; consider dedicated monitoring host for production checks if needed

- **GitHub Actions Security in Open Source**: Open source repository workflows are publicly visible and could be exploited if permissions are not properly restricted
  - *Mitigation*: Research and apply security best practices (via Perplexity/Context7) before implementation; explicitly define all workflow permissions using principle of least privilege; never rely on default permissive permissions; review GitHub's security hardening guides for Actions

- **Test Suite Maintenance**: Comprehensive test coverage (unit, e2e, a11y, coverage, performance) requires ongoing maintenance and can slow development if test execution time grows
  - *Mitigation*: Monitor test execution times; parallelize test suites where possible; ensure `npm test` provides clear failure messages for each suite to enable quick diagnosis; consider test suite optimization as technical debt item if execution exceeds 10 minutes

- **CSV Historical Data Loss**: GitHub Actions cache has size limits (10GB per repository) and time-based eviction (caches not accessed within 7 days are removed), risking historical data loss if cache evicted between workflow runs
  - *Mitigation*: Implement three-tier fallback (cache → GitHub Pages → new file); schedule workflows frequently (5-minute intervals) to prevent cache eviction; publish CSV to GitHub Pages on every deployment as durable backup; monitor CSV file size and implement rotation before approaching cache limits; accept that cache eviction during extended outages may result in data gaps

- **CSV Data Corruption**: Corrupted CSV file from cache or GitHub Pages could break historical data continuity
  - *Mitigation*: Implement CSV validation on restore (verify headers, parse sample rows); if corrupted, log detailed error, emit monitoring alert, and fall through to next fallback tier; CSV corruption is treated as recoverable by attempting remaining tiers (unlike network/cache errors which fail immediately); worst case scenario is creating new CSV (losing historical data but maintaining service availability)

- **Self-Contained HTML File Size**: Inlining all GOV.UK Design System assets (CSS, JavaScript, base64-encoded images/fonts) creates a larger single HTML file that may impact load times or exceed browser/CDN size limits
  - *Mitigation*: Monitor generated HTML file size during development; optimize/minify CSS and JavaScript before inlining; compress base64-encoded images; consider removing unused GOV.UK Design System components; set target file size limit (< 5MB) and fail build if exceeded; validate SC-003 (page loads in under 2 seconds) remains achievable with self-contained approach
