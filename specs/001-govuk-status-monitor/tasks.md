# Tasks: GOV.UK Public Services Status Monitor

**Input**: Design documents from `/specs/001-govuk-status-monitor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Comprehensive test tasks included per Constitution Principle III (TDD) and spec.md FR-040a requirement for "npm test MUST execute all test suites...80% coverage"

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US7)
- Exact file paths included in descriptions

## Path Conventions
- Single Node.js application: `src/`, `tests/`, `_includes/`, `_data/`, `pages/` at repository root
- TypeScript files use `.ts` extension, run via tsx (no compilation)
- Nunjucks templates use `.njk` extension
- Tests follow TDD - written first, must fail before implementation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure: src/{orchestrator,health-checks,storage,config,metrics,logging,inlining,types}/, _includes/{layouts,components,macros}/, _data/, pages/, tests/{unit,integration,e2e,accessibility,performance,contract}/, .github/workflows/
- [ ] T002 Initialize Node.js 22+ project with package.json: dependencies (@11ty/eleventy@^3.0.0, @x-govuk/govuk-eleventy-plugin@^4.0.0, js-yaml, ajv, uuid, prom-client), devDependencies (tsx@^4.7.0, typescript@^5.8.0, vitest@^2.0.0, playwright), scripts (build, test, lint)
- [ ] T003 [P] Configure TypeScript in tsconfig.json: module=NodeNext, target=ESNext, strict=true, noEmit=true, verbatimModuleSyntax=true, erasableSyntaxOnly=true per research.md Node.js 22 native TypeScript support
- [ ] T004 [P] Configure ESLint and Prettier: .eslintrc.json with TypeScript parser, .prettierrc.json with 2-space indent, trailing commas
- [ ] T005 [P] Create .gitignore: node_modules/, _site/, dist/, output/, *.log, .env, history.csv, _data/health.json
- [ ] T006 [P] Configure Vitest in vitest.config.ts: coverage 80% minimum (branch and line), native ESM, TypeScript integration per research.md
- [ ] T007 [P] Configure Playwright in playwright.config.ts: browsers (chromium, firefox), axe-core for accessibility tests, timeouts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create TypeScript type definitions in src/types/config.ts: Configuration, GlobalSettings, ServiceDefinition, ExpectedValidation, CustomHeader interfaces per data-model.md
- [ ] T009 [P] Create TypeScript type definitions in src/types/health-check.ts: HealthCheckResult, ServiceStatus enums, HealthCheckConfig interfaces per data-model.md
- [ ] T010 [P] Create TypeScript type definitions in src/types/worker-message.ts: WorkerMessage, WorkerResult, WorkerError interfaces for worker thread communication
- [ ] T011 Create JSON Schema definition in src/config/schema.ts: Ajv schema validating config.yaml structure (required fields, service names unique, valid protocols/methods, tag validation, timeout constraints) per FR-001, FR-007
- [ ] T012 Implement YAML configuration loader in src/config/loader.ts: load config.yaml using js-yaml, parse to Configuration type, handle file not found error per FR-001
- [ ] T013 Implement configuration validator in src/config/validator.ts: validate parsed config against JSON Schema using Ajv, validate service names unique, validate service name/tag format (ASCII, max 100 chars), detailed error reporting to stderr per FR-007, FR-007a
- [ ] T014 [P] Implement correlation ID generator in src/logging/correlation.ts: generate UUID v4 using uuid package per FR-036
- [ ] T015 [P] Implement structured logger in src/logging/logger.ts: Pino logger with JSON format, correlation ID support, log levels (info/error/debug controlled by DEBUG env var), redaction for sensitive fields per FR-033, FR-034
- [ ] T016 [P] Implement Prometheus metrics setup in src/metrics/prometheus.ts: prom-client registry, health_checks_total counter {service_name, status}, health_check_latency_seconds histogram {service_name}, services_failing gauge, expose /metrics endpoint on port 9090 (PROMETHEUS_PORT env var) per FR-035
- [ ] T017 [P] Implement metrics buffer in src/metrics/buffer.ts: in-memory buffer (METRICS_BUFFER_SIZE env var, default 1000), queue metrics when Prometheus unavailable, drop oldest when full per FR-035a, FR-035b
- [ ] T018 Create Eleventy configuration in eleventy.config.js: import @x-govuk/govuk-eleventy-plugin, configure GOV.UK branding (no Crown logo, "GOV.UK service status" title), input/output directories, Nunjucks template engine per plan.md, research.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3A: User Story 7 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US7 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T019-T025

### Contract Tests for US7

- [ ] T019a [P] [US7] Write contract test for test workflow output in tests/contract/test-workflow.test.ts: validate workflow runs on PR (non-config changes), executes all test suites (unit, e2e, accessibility, coverage, performance), blocks merge on failure, verify workflow YAML structure matches GitHub Actions schema (test MUST fail before T019 implementation)
- [ ] T020a [P] [US7] Write contract test for smoke test workflow output in tests/contract/smoke-test-workflow.test.ts: validate workflow runs on config.yaml PR changes, posts Markdown comment with formatted results table (service, status, latency, HTTP code, failure reason columns), includes summary and warning sections, verify workflow permissions (contents:read, pull-requests:write), test comment posting failure handling (test MUST fail before T020 implementation)
- [ ] T021a [P] [US7] Write contract test for deploy workflow output in tests/contract/deploy-workflow.test.ts: validate workflow runs on schedule (every 5 minutes) and manual dispatch, restores CSV from cache/GitHub Pages/creates new, generates status.json and index.html, deploys to GitHub Pages artifact, verify artifact structure (index.html, status.json, history.csv at root), test failure scenarios (cache limit, network error, CSV corruption) (test MUST fail before T021 implementation)

### Integration Tests for US7

- [ ] T022a [US7] Write integration test for conditional workflow logic in tests/integration/workflow-conditions.test.ts: simulate PR with both config.yaml and code changes, verify application tests run first, smoke tests run only if app tests pass, verify fail-fast behavior (test MUST fail before T022 implementation)

### E2E Tests for US7

- [ ] T025a [US7] Write E2E test for deployed status page in tests/e2e/deployment.spec.ts: use Playwright to access deployed GitHub Pages URL, verify page loads within 2 seconds, verify self-contained HTML (no external requests), verify status.json accessible, verify history.csv accessible, test from multiple geographic locations if possible (test MUST fail before T025 implementation)

**Checkpoint**: All US7 tests written and FAILING - ready for US7 implementation (T019-T025)

---

## Phase 3: User Story 7 - Automated Status Page Deployment (Priority: P1) 🎯 MVP INFRASTRUCTURE

**Goal**: Establish automated deployment pipeline that keeps status page current without manual intervention

**Why P1 Infrastructure**: While listed as User Story 7 in spec, deployment automation is foundational for all other stories to function in production. Without this, no status updates reach users.

**Independent Test**: Verify scheduled workflow runs, executes health checks, generates HTML/JSON/CSV, and deploys to GitHub Pages successfully

### Implementation for User Story 7

- [ ] T019 [P] [US7] Create GitHub Actions workflow .github/workflows/test.yml: trigger on PR (all files except config.yaml), run npm test (unit, e2e, accessibility, coverage, performance suites), block merge if fails per FR-040, FR-040a, FR-041
- [ ] T020 [P] [US7] Create GitHub Actions workflow .github/workflows/smoke-test.yml: trigger on PR (config.yaml changes), workflow permissions contents:read pull-requests:write, validate config.yaml syntax/schema, execute health checks for all services, post formatted Markdown comment with results (service status, latency, HTTP codes), fail if comment cannot be posted, allow merge with warning if all services fail per FR-038, FR-038a, FR-038b
- [ ] T021 [P] [US7] Create GitHub Actions workflow .github/workflows/deploy.yml: schedule cron "*/5 * * * *" (every 5 minutes), manual dispatch support, restore CSV from GitHub Actions cache (primary), fetch CSV from GitHub Pages if cache miss, create new CSV if both fail (first run), execute health checks, append results to CSV, save CSV to Actions cache (fail immediately if cache limit), generate static HTML/JSON, deploy to GitHub Pages using actions/upload-pages-artifact and actions/deploy-pages, include CSV in deployment, retain artifacts on mid-execution failure per FR-042, FR-042a, FR-020b, FR-020c, FR-020d, FR-020e
- [ ] T022 [US7] Update test workflow with conditional logic: if PR changes both config.yaml and code, run application tests first (fail fast), only run smoke tests if application tests pass per FR-039a
- [ ] T023 [US7] Configure workflow explicit permissions: research GitHub Actions security best practices for open source repositories, apply principle of least privilege, never use default permissions per FR-037a
- [ ] T024 [US7] Configure main branch protection in .github/settings: require PR approval, require all CI tests pass before merge (application tests or smoke tests depending on change type) per FR-041
- [ ] T025 [US7] Create deployment documentation in docs/deployment.md: GitHub Pages setup using gh CLI, workflow permissions, CSV fallback chain, manual rotation guidance, cache limit troubleshooting per FR-043

**Checkpoint**: At this point, deployment pipeline is fully functional - any implemented user stories will automatically deploy

---

## Phase 4A: User Story 1 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US1 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T026-T044

### Unit Tests for US1

- [ ] T026a [P] [US1] Write unit test for HTTP health check in tests/unit/health-checks/http-check.test.ts: test GET/HEAD/POST methods, custom headers, POST payloads, AbortSignal.timeout() for timeouts, status code validation (expected vs actual), response text validation (search first 100KB, case-sensitive substring), response header validation (case-insensitive name, case-sensitive value, Location for redirects), return HealthCheckResult with all fields, test network errors (DNS failure, connection refused), test timeout scenarios (test MUST fail before T026 implementation)
- [ ] T027a [P] [US1] Write unit test for response validation in tests/unit/health-checks/validation.test.ts: test validateStatusCode (match expected), test validateResponseText (substring in first 100KB, case-sensitive), test validateResponseHeaders (Location header for redirect, case-insensitive name matching), test validation failures (status mismatch, text not found, header mismatch), verify return values (boolean or validation result objects) (test MUST fail before T027 implementation)
- [ ] T028a [P] [US1] Write unit test for retry logic in tests/unit/health-checks/retry-logic.test.ts: test retry for network errors only (connection refused, DNS failure, timeout), verify max 3 immediate retries (no delays, no exponential backoff), verify retries don't count toward consecutive failure threshold, verify NO retry for status/text/header validation failures, test retry exhaustion (all 3 retries fail), verify final result after retries (test MUST fail before T028 implementation)
- [ ] T029a [US1] Write unit test for health check worker in tests/unit/health-checks/worker.test.ts: test worker thread receives WorkerMessage via postMessage, test worker executes http-check with retry-logic, test status determination (FAIL: validation failed or timeout, DEGRADED: passed but latency > warning_threshold, PASS: passed and latency <= warning_threshold), test Prometheus metrics emission, test WorkerResult return with correlation ID, test worker error handling and structured errors (test MUST fail before T029 implementation)
- [ ] T030a [P] [US1] Write unit test for CSV writer in tests/unit/storage/csv-writer.test.ts: test append HealthCheckResult to history.csv, verify columns (timestamp ISO 8601, service_name, status PASS/DEGRADED/FAIL, latency_ms integer, http_status_code, failure_reason empty if passed, correlation_id), test file creation if not exists, test append without duplicate headers, test exit with non-zero on write failure (permissions, disk space), verify atomic writes (test MUST fail before T030 implementation)
- [ ] T031a [P] [US1] Write unit test for CSV reader in tests/unit/storage/csv-reader.test.ts: test read history.csv, test format validation (headers present, parse sample rows), test consecutive failure derivation (count consecutive FAIL statuses per service from recent records), test handling of corrupted CSV (log error, emit alert, return validation errors), verify fallback to next tier on corruption, test empty CSV file handling (test MUST fail before T031 implementation)
- [ ] T032a [P] [US1] Write unit test for JSON writer in tests/unit/storage/json-writer.test.ts: test write _data/health.json from HealthCheckResult array, test mapping to ServiceStatusAPI format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), test sorting (FAIL → DEGRADED → PASS → PENDING), test null values for PENDING services (latency_ms, last_check_time, http_status_code all null), test exit with non-zero on write failure, verify JSON structure matches OpenAPI schema (test MUST fail before T032 implementation)
- [ ] T033a [US1] Write unit test for worker pool manager in tests/unit/orchestrator/worker-pool.test.ts: test worker pool creation (size = 2x CPU cores, configurable via worker_pool_size setting), test worker lifecycle management (auto-restart on failure), test distribute health checks across workers, test correlation ID tracking per task, test task-level timeouts, test graceful shutdown (30s max wait for in-flight checks, force termination after), test structured error handling with graceful degradation (test MUST fail before T033 implementation)
- [ ] T034a [US1] Write unit test for scheduler in tests/unit/orchestrator/scheduler.test.ts: test setInterval for health check cycles (default 60s, per-service override), test priority queue by next check time, test worker pool trigger for each cycle, test wait for first cycle completion before generating initial HTML (all services PENDING during first cycle), test HTML/JSON regeneration after every cycle completion regardless of status changes, test cycle timing accuracy (test MUST fail before T034 implementation)
- [ ] T035a [US1] Write unit test for 11ty runner in tests/unit/orchestrator/eleventy-runner.test.ts: test invoke 11ty CLI (npx @11ty/eleventy) as subprocess, test capture stdout/stderr, test handle subprocess failure (log error, retain previous HTML, emit alert, continue health checks), test retry generation on next cycle after failure, verify subprocess exit codes (test MUST fail before T035 implementation)

### Integration Tests for US1

- [ ] T033b [US1] Write integration test for worker pool integration in tests/integration/worker-pool-integration.test.ts: test real worker threads execution with actual HTTP requests to test endpoints (httpbin.org or local test server), verify workers execute in parallel, verify correlation IDs propagate through logs, verify worker failures handled gracefully with pool auto-restart, test under load (10+ concurrent health checks) (test MUST fail before T033 implementation)
- [ ] T034b [US1] Write integration test for scheduler integration in tests/integration/scheduler-integration.test.ts: test scheduler triggers worker pool at configured intervals, verify first cycle completion before HTML generation, verify HTML regeneration after each cycle, test cycle interruption and recovery, verify timing accuracy over multiple cycles (test MUST fail before T034 implementation)
- [ ] T044b [US1] Write integration test for full health check cycle in tests/integration/end-to-end-cycle.test.ts: test complete pipeline (health check → CSV append → _data/health.json write → 11ty CLI invocation → HTML generation → asset inlining), use real config.yaml with test services, verify CSV format and consecutive failure tracking, verify JSON format matches OpenAPI schema, verify generated HTML is self-contained (no external requests), verify output/ directory structure, test cycle under various scenarios (all pass, some fail, some degraded, first run PENDING) (test MUST fail before T044 implementation)

### Contract Tests for US1

- [ ] T032b [P] [US1] Write contract test for _data/health.json schema in tests/contract/health-json.test.ts: validate generated _data/health.json against ServiceStatusAPI schema from OpenAPI spec, verify array structure, verify required fields (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), verify enum values for status (PENDING, PASS, DEGRADED, FAIL), verify sorting order (FAIL first), verify null handling for PENDING services (test MUST fail before T032 implementation)
- [ ] T030b [P] [US1] Write contract test for CSV format in tests/contract/history-csv.test.ts: validate history.csv format (columns: timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id), verify timestamp is ISO 8601, verify status is PASS/DEGRADED/FAIL uppercase, verify latency_ms is integer, verify correlation_id is UUID v4, test parsing and type validation (test MUST fail before T030 implementation)

### E2E Tests for US1

- [ ] T039a [US1] Write E2E test for status page display in tests/e2e/status-page.spec.ts: use Playwright to load generated status page (from _site/ or output/), verify service list displays all configured services, verify failing services appear first, verify DEGRADED services appear second, verify PASS services appear third, verify PENDING services appear last, verify each service shows (name, status indicator, last check time, latency, HTTP status code, failure reason if failed), verify page generation timestamp visible and distinct from service check times, verify meta refresh tag present (`<meta http-equiv="refresh" content="60">`), verify page title "GOV.UK service status" (test MUST fail before T039 implementation)
- [ ] T044c [US1] Write E2E test for self-contained HTML in tests/e2e/self-contained-html.spec.ts: use Playwright to load output/index.html, verify page loads with zero external network requests (monitor network tab), verify all CSS inlined in `<style>` tags, verify all JavaScript inlined in `<script>` tags, verify all images base64-encoded as data URIs, verify GOV.UK Design System assets inlined (CSS, JS, images from plugin), verify file size < 5MB, verify page still functional after disabling network (test MUST fail before T044 implementation)

### Accessibility Tests for US1

- [ ] T039b [US1] Write accessibility test for status page WCAG 2.2 AAA in tests/accessibility/wcag-aaa.spec.ts: use Playwright with axe-core integration, run automated accessibility scan on generated status page, verify WCAG 2.2 AAA compliance (no violations), test enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text), test comprehensive ARIA labels and landmarks, test keyboard navigation support (tab through all interactive elements), verify clear focus indicators (3:1 contrast per GDS), verify no reliance on color alone for status indication, verify screen reader compatibility (test with virtual screen reader if possible), verify all non-text content has text alternatives (test MUST fail before T039 implementation)

### Performance Tests for US1

- [ ] T044d [US1] Write performance test for page load in tests/performance/page-load.spec.ts: use Playwright to measure page load time, verify First Contentful Paint (FCP) < 1.8s, verify Largest Contentful Paint (LCP) < 2.5s, verify Time to Interactive (TTI) < 3.5s, verify Cumulative Layout Shift (CLS) < 0.1, verify Total Blocking Time (TBT) < 300ms, test on simulated 3G connection (Playwright network throttling), verify total page weight < 500KB uncompressed, verify compressed HTML < 14KB (if using compression) (test MUST fail before T044 implementation)

**Checkpoint**: All US1 tests written and FAILING - ready for US1 implementation (T026-T044)

---

## Phase 4: User Story 1 - View Current Service Status (Priority: P1) 🎯 MVP

**Goal**: Enable users to quickly see which public services are operational and which are experiencing issues

**Independent Test**: Access status page, view list of services with health status, see failing services first, view check time and latency

### Implementation for User Story 1

- [ ] T026 [P] [US1] Implement HTTP health check logic in src/health-checks/http-check.ts: use native Node.js 22+ fetch() API, support GET/HEAD/POST methods, custom headers, POST payloads, AbortSignal.timeout() for timeouts, validate status code, search first 100KB of body for expected text, validate response headers (Location for redirects), return HealthCheckResult per FR-008, FR-010, FR-011, FR-013, FR-014, FR-014a, FR-017
- [ ] T027 [P] [US1] Implement response validation in src/health-checks/validation.ts: validate status code matches expected, search response body for expected text (case-sensitive substring, first 100KB), validate response headers (case-insensitive name, case-sensitive value), return validation results per FR-013, FR-014, FR-014a
- [ ] T028 [P] [US1] Implement retry logic in src/health-checks/retry-logic.ts: retry network errors only (connection refused, DNS failure, timeout), max 3 immediate retries (no delays), retries don't count toward consecutive failure threshold, don't retry status/text/header validation failures per FR-017b
- [ ] T029 [US1] Implement health check worker in src/health-checks/worker.ts: worker thread using worker_threads module, receive WorkerMessage via postMessage, execute http-check with retry-logic, determine status (FAIL: validation failed or timeout, DEGRADED: passed but latency > warning_threshold, PASS: passed and latency <= warning_threshold), emit Prometheus metrics, return WorkerResult with correlation ID per FR-009a, FR-015, FR-015b
- [ ] T030 [P] [US1] Implement CSV writer in src/storage/csv-writer.ts: append HealthCheckResult to history.csv, columns: timestamp (ISO 8601), service_name, status (PASS/DEGRADED/FAIL), latency_ms (integer), http_status_code, failure_reason (empty if passed), correlation_id, exit with non-zero if write fails per FR-018, FR-020, FR-020a
- [ ] T031 [P] [US1] Implement CSV reader in src/storage/csv-reader.ts: read history.csv, validate format (headers, parse sample rows), derive consecutive failure count from consecutive FAIL statuses per service, return validation errors, handle corrupted CSV (log error, emit alert, fallback to next tier) per FR-015a, FR-020e
- [ ] T032 [P] [US1] Implement JSON data writer in src/storage/json-writer.ts: write _data/health.json from HealthCheckResult array, map to ServiceStatusAPI format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), sort FAIL → DEGRADED → PASS → PENDING, null values for PENDING services, exit with non-zero if write fails per FR-022, FR-028a
- [ ] T033 [US1] Implement worker pool manager in src/orchestrator/worker-pool.ts: create worker pool sized to CPU cores (2x cores, configurable via worker_pool_size setting), manage worker lifecycle (auto-restart on failure), distribute health checks across workers, track correlation IDs, implement task-level timeouts (graceful shutdown: 30s max wait for in-flight checks), structured error handling per FR-009a, FR-032
- [ ] T034 [US1] Implement scheduler in src/orchestrator/scheduler.ts: setInterval for health check cycles (default 60s, per-service override), priority queue by next check time, trigger worker pool for each cycle, wait for first cycle completion before generating initial HTML (all services PENDING), regenerate HTML/JSON after every cycle completion regardless of status changes per FR-009, FR-028
- [ ] T035 [US1] Implement 11ty runner in src/orchestrator/eleventy-runner.ts: invoke 11ty CLI (npx @11ty/eleventy) as subprocess after each health check cycle, capture stdout/stderr, handle failure (log error, retain previous HTML, emit alert, continue health checks), retry generation on next cycle per FR-030
- [ ] T036 [P] [US1] Create GOV.UK base layout in _includes/layouts/base.njk: extend @x-govuk/govuk-eleventy-plugin base layout, page title "GOV.UK service status", meta refresh tag `<meta http-equiv="refresh" content="60">`, no Crown logo/official branding per FR-021, FR-029
- [ ] T037 [P] [US1] Create service status component in _includes/components/service-status.njk: display service name, status indicator (healthy/degraded/failed/pending), last check time, latency, HTTP status code, failure reason if failed, using GOV.UK Design System components per FR-027, FR-027a
- [ ] T038 [P] [US1] Create status indicator macro in _includes/macros/status-indicator.njk: visual indicators for PASS (green), DEGRADED (yellow), FAIL (red), PENDING (grey), using GOV.UK tag components per FR-027
- [ ] T039 [US1] Create main status page template in pages/index.njk: load _data/health.json, display page generation timestamp, failing services first, then degraded, then healthy, then pending, flat list (no grouping), show last update time, accessible to screen readers (WCAG 2.2 AAA) per FR-021, FR-023, FR-026, FR-029a, FR-029b
- [ ] T040 [US1] Create main orchestrator entry point in src/index.ts: load and validate config.yaml (exit if invalid), initialize logger with correlation ID, start Prometheus metrics server, initialize worker pool, start scheduler for health check cycles, handle graceful shutdown (SIGTERM/SIGINT), run via tsx per FR-030, FR-032
- [ ] T041 [US1] Implement post-build asset inlining script in src/inlining/post-build.ts: custom Node.js script using native Node.js 22+ features, read generated HTML from _site/, inline CSS into `<style>` tags, inline JavaScript into `<script>` tags, base64 encode images as data URIs, write self-contained HTML to output/, fail with non-zero if inlining fails per FR-021
- [ ] T042 [P] [US1] Implement CSS inliner in src/inlining/css-inliner.ts: read CSS files, inline into `<style>` tags in HTML head, handle GOV.UK Design System CSS from plugin per FR-021
- [ ] T043 [P] [US1] Implement JavaScript inliner in src/inlining/js-inliner.ts: read JavaScript files, inline into `<script>` tags before closing `</body>`, handle GOV.UK Design System JS from plugin per FR-021
- [ ] T044 [P] [US1] Implement image inliner in src/inlining/image-inliner.ts: read image files (PNG, JPG, SVG, ICO), base64 encode as data URIs, replace `<img src>` and CSS `url()` references, handle GOV.UK Design System images from plugin per FR-021

**Checkpoint**: At this point, User Story 1 is fully functional - users can view current service status on auto-updating HTML page

---

## Phase 5A: User Story 2 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US2 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T045-T047

### Unit Tests for US2

- [ ] T045a [P] [US2] Write unit test for status tags component in tests/unit/components/status-tags.test.ts: test govukTag macro rendering for each service tag, verify multiple tags rendered per service, verify tag HTML structure matches GOV.UK Design System, test empty tags array handling, verify tag text content and CSS classes (test MUST fail before T045 implementation)

### E2E Tests for US2

- [ ] T046a [US2] Write E2E test for tag display in tests/e2e/service-tags.spec.ts: use Playwright to load status page with tagged services, verify tags displayed as labels next to each service name, verify multiple tags visible per service, verify tag styling matches GOV.UK Design System (govuk-tag class), verify untagged services grouped in separate "Untagged Services" section at bottom of page, verify section heading present, verify tagged and untagged services both display correctly (test MUST fail before T046 implementation)
- [ ] T047a [US2] Write E2E test for JSON API tags in tests/e2e/tags-json-api.spec.ts: fetch status.json, verify each service object includes tags array, verify tags array empty for untagged services, verify tags array populated for tagged services, verify tags match config.yaml values (test MUST fail before T047 implementation)

**Checkpoint**: All US2 tests written and FAILING - ready for US2 implementation (T045-T047)

---

## Phase 5: User Story 2 - Identify Service Categories via Tags (Priority: P2)

**Goal**: Enable users to understand service categorization through visible tag labels

**Independent Test**: View status page, see tags displayed as labels next to each service, identify related services by tag, see untagged services in separate section

### Implementation for User Story 2

- [ ] T045 [P] [US2] Create status tags component in _includes/components/status-tags.njk: render GOV.UK tag components for each service tag, use govukTag macro from Design System, display multiple tags per service per FR-024, FR-025
- [ ] T046 [US2] Update status page template in pages/index.njk: add status-tags component to each service display, group services (failing → degraded → healthy → untagged section at bottom), untagged section heading "Untagged Services" per FR-024a
- [ ] T047 [US2] Update JSON writer in src/storage/json-writer.ts: include tags array in ServiceStatusAPI output, empty array for services without tags per FR-022

**Checkpoint**: At this point, User Stories 1 AND 2 work - users see categorized services with visual tag labels

---

## Phase 6A: User Story 5 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US5 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T048-T049

### E2E Tests for US5

- [ ] T048a [US5] Write E2E test for meta refresh behavior in tests/e2e/auto-refresh.spec.ts: use Playwright to load status page, verify meta refresh tag content matches settings.page_refresh from config.yaml (default 60s), verify page automatically refreshes after configured interval (wait 61s, check for page reload event), verify updated status displays after refresh (simulate status change, wait for refresh, verify new status visible), verify refresh works without JavaScript enabled (test MUST fail before T048 implementation)
- [ ] T049a [US5] Write E2E test for last update display in tests/e2e/last-update-display.spec.ts: use Playwright to load status page, verify prominent last update time displayed, verify page generation timestamp visible and distinct from individual service check times, verify "time since last check" shown for each service, verify timestamps in user-friendly format (relative time or ISO 8601 with local conversion) (test MUST fail before T049 implementation)

**Checkpoint**: All US5 tests written and FAILING - ready for US5 implementation (T048-T049)

---

## Phase 6: User Story 5 - Automatic Status Updates (Priority: P2)

**Goal**: Enable page to refresh automatically without manual reload during incident monitoring

**Independent Test**: Open status page, observe automatic refresh after 60 seconds, see updated status without manual reload, see last update time

**Note**: Most implementation already complete in US1 (meta refresh tag) - this phase adds visibility features

### Implementation for User Story 5

- [ ] T048 [US5] Update base layout in _includes/layouts/base.njk: ensure meta refresh tag content matches settings.page_refresh from config.yaml (default 60s) per FR-029
- [ ] T049 [US5] Update status page template in pages/index.njk: add prominent last update time display, show time since last check for each service, visual indication when page was generated (distinct from service check times) per FR-029b

**Checkpoint**: User Stories 1, 2, AND 5 work - users see auto-updating categorized service status

---

## Phase 7A: User Story 3 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US3 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T050-T052

### Unit Tests for US3

- [ ] T050a [P] [US3] Write unit test for GitHub Actions cache manager in tests/unit/storage/cache-manager.test.ts: test restore CSV from Actions cache (primary tier), test fetch from GitHub Pages if cache miss (secondary tier), test create new CSV only if both tiers fail (tertiary tier - first run scenario), test CSV format validation on restore (verify headers, parse sample rows), test handling of corrupted CSV (log error, emit alert, fall through to next tier), test fail immediately on cache limit error (non-recoverable), test fail immediately on network error fetching from GitHub Pages (non-recoverable), verify three-tier fallback chain logic (test MUST fail before T050 implementation)

### Integration Tests for US3

- [ ] T050b [US3] Write integration test for CSV persistence chain in tests/integration/csv-persistence.test.ts: simulate GitHub Actions workflow environment, test full CSV fallback chain with mocked cache/GitHub Pages responses, verify cache tier attempted first, verify GitHub Pages tier attempted on cache miss, verify new CSV created if both fail, test cache limit scenario (workflow should fail), test network error scenario (workflow should fail), test corrupted CSV scenario (falls through to next tier), verify CSV append after restore, verify updated CSV saved to cache (test MUST fail before T050 implementation)
- [ ] T052a [US3] Write integration test for historical data access in tests/integration/historical-data-access.test.ts: write sample health check results to CSV, read CSV file, calculate uptime percentages over different time periods (last 24 hours, last 7 days, last 30 days), identify outage patterns (consecutive failures, duration), verify CSV format allows uptime calculation per SC-008, test with realistic data volumes (1000+ records) (test MUST fail before T052 implementation)

### Contract Tests for US3

- [ ] T050c [P] [US3] Write contract test for CSV format compliance in tests/contract/csv-format.test.ts: validate history.csv structure matches documented format (timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id), verify no extra or missing columns, verify data types (timestamp ISO 8601, latency_ms integer, correlation_id UUID v4), verify status enum (PASS/DEGRADED/FAIL uppercase only), test parsing with multiple CSV libraries for compatibility (test MUST fail before T050 implementation)

**Checkpoint**: All US3 tests written and FAILING - ready for US3 implementation (T050-T052)

---

## Phase 7: User Story 3 - Access Historical Service Performance (Priority: P3)

**Goal**: Enable programmatic access to historical performance data for trend analysis

**Independent Test**: Read history.csv file, access historical health check results, calculate uptime percentages, identify outage patterns

### Implementation for User Story 3

- [ ] T050 [P] [US3] Implement GitHub Actions cache manager in src/storage/cache-manager.ts: restore CSV from Actions cache (primary), fetch from GitHub Pages if cache miss, validate restored CSV format, log errors and fall through to next tier if corrupted, create new CSV only if both tiers fail (first run), fail immediately on cache limit or network errors per FR-020b, FR-020c, FR-020d, FR-020e
- [ ] T051 [US3] Update deploy workflow in .github/workflows/deploy.yml: use cache-manager to restore CSV at workflow start, append new results, save to cache, include in GitHub Pages deployment per FR-020b
- [ ] T052 [US3] Create CSV documentation in docs/historical-data.md: CSV format specification, uptime calculation examples, manual rotation guidance, cache limit troubleshooting per SC-008

**Checkpoint**: User Stories 1, 2, 3, AND 5 work - historical data persists and is accessible

---

## Phase 8A: User Story 4 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US4 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T053-T055

### Contract Tests for US4

- [ ] T053a [P] [US4] Write contract test for status.json API schema in tests/contract/status-api.test.ts: load contracts/status-api.openapi.yaml, validate generated output/status.json against OpenAPI schema, verify array structure, verify ServiceStatus object properties (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason all present), verify enum constraints (status: PENDING|PASS|DEGRADED|FAIL), verify nullable constraints (latency_ms, last_check_time, http_status_code nullable for PENDING), verify required vs optional fields, test with various service states (passing, degraded, failing, pending) (test MUST fail before T053 implementation)

### E2E Tests for US4

- [ ] T054a [US4] Write E2E test for JSON API accessibility in tests/e2e/json-api.spec.ts: use Playwright fetch or curl to request /status.json, verify HTTP 200 response, verify Content-Type application/json, verify response is valid JSON (parseable), verify JSON structure matches OpenAPI schema, verify data identical to HTML page content (cross-check service names, statuses), verify API accessible from deployed GitHub Pages URL (test MUST fail before T054 implementation)
- [ ] T055a [US4] Write E2E test for API documentation in tests/e2e/api-docs.spec.ts: verify docs/api.md exists and references contracts/status-api.openapi.yaml, verify usage examples include curl and JavaScript fetch, verify all status values explained (PENDING, PASS, DEGRADED, FAIL), verify historical data in CSV note included, verify examples use correct endpoint paths (/status.json, /history.csv) (test MUST fail before T055 implementation)

**Checkpoint**: All US4 tests written and FAILING - ready for US4 implementation (T053-T055)

---

## Phase 8: User Story 4 - Consume Service Status via API (Priority: P3)

**Goal**: Enable developers to integrate status information programmatically via JSON API

**Independent Test**: Make HTTP request to /status.json, receive structured JSON, parse service status data, verify identical to HTML page content

### Implementation for User Story 4

- [ ] T053 [US4] Create static JSON generation in src/storage/json-writer.ts: write status.json to output/status.json (in addition to _data/health.json), identical ServiceStatusAPI format, flat structure at root, deployed to GitHub Pages per FR-022
- [ ] T054 [US4] Update 11ty config in eleventy.config.js: copy status.json to _site/status.json during build, ensure it's included in deployment artifact per FR-022
- [ ] T055 [US4] Create API documentation in docs/api.md: reference contracts/status-api.openapi.yaml, usage examples with curl and JavaScript fetch, explain status values, note historical data in CSV per contracts/README.md

**Checkpoint**: User Stories 1, 2, 3, 4, AND 5 work - JSON API provides programmatic access

---

## Phase 9A: User Story 6 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US6 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T056-T058

### Integration Tests for US6

- [ ] T056a [US6] Write integration test for smoke test PR comment in tests/integration/smoke-test-comment.test.ts: simulate PR with config.yaml changes, trigger smoke test workflow (or mock workflow execution), verify formatted Markdown comment generated, verify table structure (service name, status, latency, HTTP code, failure reason columns), verify summary section present (X passing, Y degraded, Z failing), verify prominent warning included if all services fail ("may indicate outages, network issues, or config problems"), test comment posting failure scenario (workflow should fail with non-zero exit) (test MUST fail before T056 implementation)

### E2E Tests for US6

- [ ] T057a [US6] Write E2E test for smoke test workflow execution in tests/e2e/config-validation.spec.ts: create test PR modifying only config.yaml, trigger smoke test workflow via GitHub API (or simulate), verify application tests skipped (not executed), verify smoke test executes health checks for all configured services, verify workflow completes successfully and posts comment, verify main branch protection requires passing tests, create second test PR with both config.yaml and code changes, verify application tests run first, verify smoke tests run only if app tests pass (test MUST fail before T057 implementation)

**Checkpoint**: All US6 tests written and FAILING - ready for US6 implementation (T056-T058)

---

## Phase 9: User Story 6 - Configuration Change Validation via CI (Priority: P2)

**Goal**: Provide automated validation and feedback for configuration changes before merge

**Independent Test**: Create PR with config.yaml changes, see smoke test execute, view formatted comment with health check results

**Note**: Most implementation already complete in US7 (smoke test workflow) - this phase adds refinements

### Implementation for User Story 6

- [ ] T056 [US6] Enhance smoke test workflow in .github/workflows/smoke-test.yml: format PR comment as Markdown table with service name, status, latency, HTTP code, failure reason columns, add summary section (X passing, Y degraded, Z failing), add prominent warning if all services fail ("may indicate outages, network issues, or config problems") per FR-038, FR-038b
- [ ] T057 [US6] Update smoke test workflow: add skip logic - if PR only changes config.yaml, skip application tests, run smoke test only per FR-039
- [ ] T058 [US6] Create configuration documentation in docs/configuration.md: config.yaml structure, validation rules, service definition examples, expected validation criteria, custom headers and payloads, tag format, smoke test process per FR-001 through FR-007

**Checkpoint**: All user stories (1-6) functional - configuration changes validated before merge

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T059 [P] Create main README.md: project overview, quick start, features, architecture diagram, links to documentation, license information per plan.md
- [ ] T060 [P] Create MIT LICENSE file: standard MIT license text with Crown (GDS) copyright per plan.md
- [ ] T061 [P] Update package.json scripts: add "build", "start", "dev", "test", "lint", "lint:fix", "type-check", "validate-config" commands per quickstart.md
- [ ] T062 [P] Create example config.yaml in repository root: 2-3 example services demonstrating GET, HEAD, POST methods, status validation, text validation, header validation, redirect validation, tags per configuration structure from spec.md
- [ ] T063 [P] Add structured logging to all modules: include correlation IDs in all log statements, DEBUG env var controls verbosity, security warnings for debug mode, use child loggers per context per FR-033, FR-034, FR-034a
- [ ] T064 [P] Add error handling to all modules: structured error objects, detailed error messages, appropriate exit codes (non-zero for failures), stderr output for validation errors per FR-007, FR-020a, FR-028a
- [ ] T065 [P] Validate quickstart.md: verify all commands work, test development workflow, validate prerequisites, test troubleshooting steps per quickstart.md content
- [ ] T066 Code review and refactoring: remove code duplication, improve type safety, optimize performance, ensure consistent naming conventions
- [ ] T067 Security hardening: validate no secrets in code, review workflow permissions, implement input validation for all external data, add rate limiting considerations to docs
- [ ] T068 [P] Performance optimization: benchmark health check cycle time, HTML generation time, memory usage, set aggressive thresholds, document in performance tests per FR-040a
- [ ] T069 [P] Accessibility validation: run axe-core tests via Playwright, verify WCAG 2.2 AAA compliance (color contrast 7:1 normal text, 4.5:1 large text), test with screen readers (NVDA, VoiceOver, JAWS), verify keyboard navigation, check focus indicators per FR-029a
- [ ] T070 Final integration testing: end-to-end test full health check → CSV → 11ty → inlining → deployment cycle, verify CSV fallback chain, test graceful shutdown, validate all error paths
- [ ] T071 [P] Establish performance baseline in tests/performance/baseline.md: run health checks against 5 sample services (response times: 100ms, 500ms, 1s, 2s, 5s), measure cycle time/memory/HTML generation, set thresholds at 80% of baseline (e.g., baseline 10s → threshold 8s) per spec.md FR-040a and Finding A1 remediation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 7 - Deployment (Phase 3)**: Depends on Foundational - Must complete before other stories are useful in production
- **User Story 1 - View Status (Phase 4)**: Depends on Foundational AND US7 - Core functionality
- **User Story 2 - Tags (Phase 5)**: Depends on US1 - Enhances status display
- **User Story 5 - Auto-refresh (Phase 6)**: Depends on US1 - Enhances UX
- **User Story 3 - Historical Data (Phase 7)**: Depends on US1 - Adds data persistence
- **User Story 4 - JSON API (Phase 8)**: Depends on US1 - Adds programmatic access
- **User Story 6 - Config Validation (Phase 9)**: Depends on US7 - Enhances CI/CD
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Critical Path (TDD-Compliant)

1. Setup (Phase 1) → Foundational (Phase 2) → **MVP Path:**
2. US7 Tests (Phase 3A) → US7 Deployment (Phase 3) → Tests PASS ✅
3. US1 Tests (Phase 4A) → US1 View Status (Phase 4) → Tests PASS ✅ = **MVP COMPLETE**
4. Add US2 Tags: Tests (5A) → Impl (5) → Tests PASS ✅
5. Add US5 Auto-refresh: Tests (6A) → Impl (6) → Tests PASS ✅
6. Add US3 Historical: Tests (7A) → Impl (7) → Tests PASS ✅
7. Add US4 JSON API: Tests (8A) → Impl (8) → Tests PASS ✅
8. Add US6 Config Validation: Tests (9A) → Impl (9) → Tests PASS ✅
9. Polish (Phase 10) → production ready

**TDD Workflow**: Each user story follows: Write tests → Tests FAIL ❌ → Implement → Tests PASS ✅

### Within Each User Story

- **TDD Requirement**: Tests MUST be written first and MUST fail before implementation
- Test phase (NA) before implementation phase (N)
- Foundation tasks (types, config, logging) before business logic
- HTTP health checks before worker pool
- Storage writers before orchestrator
- Orchestrator components before 11ty templates
- Templates before asset inlining
- Verify all tests pass before moving to next user story

### Parallel Opportunities

**Setup Phase:**
- T003 (tsconfig), T004 (linting), T005 (gitignore), T006 (vitest), T007 (playwright) can run in parallel

**Foundational Phase:**
- T009, T010 (type definitions) in parallel
- T014, T015, T016, T017 (logging, metrics) in parallel
- T012, T013 (config validation) sequentially

**User Story 1:**
- T026, T027, T028 (health check components) in parallel
- T030, T031, T032 (storage components) in parallel
- T036, T037, T038 (Nunjucks components) in parallel
- T042, T043, T044 (asset inliners) in parallel

**User Story 7:**
- T019, T020, T021 (GitHub workflows) in parallel

**Across User Stories:**
- After US1 complete, US2, US3, US4, US5, US6 can proceed in parallel if team capacity allows

---

## Implementation Strategy

### MVP First (User Stories 7 + 1 Only) - TDD-Compliant

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T018) - CRITICAL
3. **TDD: US7 Deployment**
   - Phase 3A: Write US7 tests (T019a-T025a) → Tests FAIL ❌
   - Phase 3: Implement US7 (T019-T025) → Tests PASS ✅
4. **TDD: US1 View Status**
   - Phase 4A: Write US1 tests (T026a-T044d) → Tests FAIL ❌
   - Phase 4: Implement US1 (T026-T044) → Tests PASS ✅
5. Phase 10: T071 (baseline), T070 (integration test)
6. **STOP and VALIDATE**: All tests passing, 80%+ coverage achieved
7. Deploy to GitHub Pages, verify status page accessible

**This is the MINIMUM VIABLE PRODUCT** - users can view current service status with full test coverage

**MVP = 71 tasks** (Setup + Foundation + US7 Tests + US7 + US1 Tests + US1 + baseline/integration)

### Incremental Delivery (TDD at Each Step)

1. **MVP**: Setup + Foundational + US7 (Tests + Impl) + US1 (Tests + Impl) → Deploy ✅
2. **Add US2 Tags**: Write tests (5A) → FAIL ❌ → Implement (5) → PASS ✅ → Deploy
3. **Add US5 Auto-refresh**: Write tests (6A) → FAIL ❌ → Implement (6) → PASS ✅ → Deploy
4. **Add US3 Historical**: Write tests (7A) → FAIL ❌ → Implement (7) → PASS ✅ → Deploy
5. **Add US4 JSON API**: Write tests (8A) → FAIL ❌ → Implement (8) → PASS ✅ → Deploy
6. **Add US6 Config Validation**: Write tests (9A) → FAIL ❌ → Implement (9) → PASS ✅ → Deploy
7. **Polish** (Phase 10) → Production ready with 100% constitution compliance

**Each increment follows TDD**: Write tests first → Verify failure → Implement → Verify success → Deploy

### Parallel Team Strategy (TDD-Compliant)

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T018)
2. **Team follows TDD for US7**:
   - Write US7 tests together (T019a-T025a) → All fail ✅
   - Implement US7 together (T019-T025) → All pass ✅
3. **Team follows TDD for US1**:
   - Write US1 tests together (T026a-T044d) → All fail ✅
   - Implement US1 together (T026-T044) → All pass ✅
4. **Once MVP complete, parallelize remaining stories** (each follows TDD):
   - Developer A: US2 Tests (5A) → Impl (5) → Tests pass ✅
   - Developer B: US3 Tests (7A) → Impl (7) → Tests pass ✅
   - Developer C: US4 Tests (8A) → Impl (8) → Tests pass ✅
   - Developer D: US5 Tests (6A) → Impl (6) + US6 Tests (9A) → Impl (9) → Tests pass ✅
5. **Team completes Polish together** (T059-T071)

**Key Principle**: Never proceed to implementation without failing tests first

---

## Parallel Examples

### Phase 1 (Setup) Parallelization

```bash
# All configuration files can be created in parallel:
Task T003: Configure tsconfig.json
Task T004: Configure ESLint and Prettier
Task T005: Create .gitignore
Task T006: Configure Vitest
Task T007: Configure Playwright
```

### Phase 2 (Foundational) Parallelization

```bash
# Type definitions in parallel:
Task T009: Create config.ts types
Task T010: Create health-check.ts types

# Logging and metrics in parallel:
Task T014: Create correlation.ts
Task T015: Create logger.ts
Task T016: Create prometheus.ts
Task T017: Create buffer.ts
```

### User Story 1 Parallelization

```bash
# Health check components:
Task T026: Implement http-check.ts
Task T027: Implement validation.ts
Task T028: Implement retry-logic.ts

# Storage components:
Task T030: Implement csv-writer.ts
Task T031: Implement csv-reader.ts
Task T032: Implement json-writer.ts

# Nunjucks components:
Task T036: Create base.njk layout
Task T037: Create service-status.njk
Task T038: Create status-indicator.njk

# Asset inliners:
Task T042: Implement css-inliner.ts
Task T043: Implement js-inliner.ts
Task T044: Implement image-inliner.ts
```

---

## Total Task Summary

- **Total Tasks**: 109 (70 implementation + 38 tests + 1 baseline)
- **Phase 1 (Setup)**: 7 tasks
- **Phase 2 (Foundational)**: 11 tasks (BLOCKS all user stories)
- **Phase 3A (US7 Tests - TDD)**: 5 tasks (write first, must fail)
- **Phase 3 (US7 Deployment - P1)**: 7 tasks (infrastructure)
- **Phase 4A (US1 Tests - TDD)**: 19 tasks (write first, must fail)
- **Phase 4 (US1 View Status - P1)**: 19 tasks (MVP)
- **Phase 5A (US2 Tests - TDD)**: 3 tasks (write first, must fail)
- **Phase 5 (US2 Tags - P2)**: 3 tasks
- **Phase 6A (US5 Tests - TDD)**: 2 tasks (write first, must fail)
- **Phase 6 (US5 Auto-refresh - P2)**: 2 tasks
- **Phase 7A (US3 Tests - TDD)**: 4 tasks (write first, must fail)
- **Phase 7 (US3 Historical - P3)**: 3 tasks
- **Phase 8A (US4 Tests - TDD)**: 3 tasks (write first, must fail)
- **Phase 8 (US4 JSON API - P3)**: 3 tasks
- **Phase 9A (US6 Tests - TDD)**: 2 tasks (write first, must fail)
- **Phase 9 (US6 Config Validation - P2)**: 3 tasks
- **Phase 10 (Polish)**: 13 tasks (includes T071 baseline)

**MVP Scope**: Phases 1-4A+4 = 71 tasks (65% of total)
- Setup (7) + Foundational (11) + US7 Tests (5) + US7 Impl (7) + US1 Tests (19) + US1 Impl (19) + Baseline (1) + Integration (1) + Polish (1) = 71 tasks

**Test Coverage**: 38 test tasks (95% of 40 user story implementation tasks)
- Unit tests: 15 | Integration tests: 8 | E2E tests: 9 | Contract tests: 5 | Accessibility tests: 1 | Performance tests: 1

**Parallel Opportunities**: 47 tasks marked [P] can run in parallel within their phases
- Original 27 implementation tasks + 20 parallel test tasks

**TDD Workflow**: All test phases (3A, 4A, 5A, 6A, 7A, 8A, 9A) MUST complete and FAIL before corresponding implementation phases

**Independent Test Criteria**: Each user story phase includes checkpoint describing how to verify that story works independently

---

## Notes

- **[P] marker**: Tasks that operate on different files with no inter-task dependencies
- **[Story] label**: Maps task to specific user story (US1-US7) for traceability
- **TDD Compliance**: 38 test tasks added per Constitution Principle III (NON-NEGOTIABLE) and spec.md FR-040a requirement
- **Test-first workflow**: All test phases (3A-9A) MUST be written first and MUST fail before implementation
- **Test types**: Unit (15), Integration (8), E2E (9), Contract (5), Accessibility (1), Performance (1) = 38 total
- **80% coverage target**: Achievable with comprehensive test suite per FR-040a requirement
- **Commit strategy**: Commit after completing each task or logical group of parallel tasks
- **Checkpoints**: Stop at phase checkpoints to validate user story works independently before proceeding
- **File paths**: All paths are exact and follow plan.md project structure
- **MVP focus**: Phases 1-4A+4 deliver core value with full test coverage (view current service status with automated deployment)
- **Constitution compliance (8/8 = 100%)**:
  - ✅ **Test-Driven Development** via 38 test tasks across all user stories (Constitution Principle III)
  - ✅ GDS Design System via @x-govuk/govuk-eleventy-plugin
  - ✅ Accessibility-First via WCAG 2.2 AAA validation in T039b, T069
  - ✅ Progressive Enhancement via meta refresh (no JavaScript required)
  - ✅ Performance Budgets via benchmarking in T044d, T068, T071
  - ✅ Component Quality via formal JSON Schema validation (T011-T013)
  - ✅ User Research via 13 measurable success criteria (SC-001 to SC-013)
  - ✅ Research-Driven Decisions via research.md with Context7/WebSearch/WebFetch citations

