# Tasks: GOV.UK Public Services Status Monitor

**Input**: Design documents from `/specs/001-govuk-status-monitor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Comprehensive test tasks included per Constitution Principle III (TDD) and spec.md FR-040a requirement for "pnpm test MUST execute all test suites...80% coverage"

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

## Phase 0: Architecture Decisions (Research Output)

**Purpose**: Document major technical decisions with research citations per constitution.md Principle VIII

**⚠️ PREREQUISITE**: Must complete before Phase 1 Setup

- [X] T000a Create ADR directory and template: create docs/adr/ directory, create docs/adr/template.md following MADR format (Title, Status, Context, Decision, Consequences, References), document ADR naming convention (####-title-with-dashes.md with leading zeros), create docs/adr/README.md explaining ADR process and index of decisions
- [X] T000b [P] Document ADR-0001 Worker Threads for Concurrency: create docs/adr/0001-worker-threads-for-health-checks.md documenting decision to use Node.js worker_threads module (FR-009a) instead of alternatives (async/await, cluster module, child processes, external job queue), cite Context7 documentation for worker_threads API, cite research.md findings on I/O-bound vs CPU-bound workload analysis, document consequences (true parallelism, message passing overhead, TypeScript support via tsx), justify 2x CPU core pool sizing
- [X] T000c [P] Document ADR-0002 Eleventy for Static Site Generation: create docs/adr/0002-eleventy-static-site-generator.md documenting decision to use 11ty v3+ (FR-030) instead of alternatives (Next.js SSG, Gatsby, Hugo, Jekyll), cite Context7 documentation for @x-govuk/govuk-eleventy-plugin showing official GDS support, cite research.md findings on GOV.UK Design System integration, document consequences (Nunjucks templates, _data/ directory convention, plugin architecture), justify hybrid orchestrator approach (Node.js + 11ty subprocess)
- [X] T000d [P] Document ADR-0003 Post-Build Asset Inlining: create docs/adr/0003-post-build-asset-inlining.md documenting decision to use custom Node.js script for asset inlining (FR-021) instead of alternatives (build-time bundling, inline-source npm package, eleventy-plugin-inline), cite research.md findings on self-contained HTML requirements and GitHub Pages constraints, document consequences (zero external dependencies post-build, single HTTP request, < 5MB file size target, auditability for government context), justify custom script vs npm package tradeoff
- [X] T000e [P] Document ADR-0004 GitHub Actions Cache for CSV Persistence: create docs/adr/0004-github-actions-cache-csv-storage.md documenting decision to use GitHub Actions cache as primary CSV storage (FR-020b) with GitHub Pages as fallback instead of alternatives (external object storage S3/GCS, GitHub repository commits, artifacts only), cite GitHub Actions documentation for cache limits and eviction policies, document three-tier fallback strategy (cache → Pages → new file), consequences (10GB limit, 7-day eviction, manual rotation required), justify avoiding external dependencies for MVP
- [X] T000f [P] Document ADR-0005 CSV Format for Consecutive Failure Tracking: create docs/adr/0005-csv-consecutive-failure-derivation.md documenting decision to derive consecutive failure count from CSV records (FR-015a) instead of alternatives (separate state column, in-memory counter, Redis/database state), cite data-model.md findings on stateless HTML generation, document consequences (no separate column needed, stateful tracking across restarts, read performance for HTML generation), justify simplicity and auditability for government transparency requirements
- [X] T000g [P] Document ADR-0006 Prometheus Metrics Cardinality Management: create docs/adr/0006-prometheus-cardinality-limits.md documenting decision to use bounded labels (service_name, status only) for Prometheus metrics (FR-035) instead of including dynamic service tags as labels, cite Prometheus best practices documentation on cardinality explosion, cite research.md findings on metric scraping performance, document consequences (limited dimensionality, prevents cardinality explosion with 50+ services × multiple tags, requires external joins for tag-based analysis), justify operational reliability over query flexibility for MVP

**Checkpoint**: ADRs complete with research citations (6 total) - provides audit trail for future maintainers per constitution.md Principle VIII

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure: src/{orchestrator,health-checks,storage,config,metrics,logging,inlining,types}/, _includes/{layouts,components,macros}/, _data/, pages/, tests/{unit,integration,e2e,accessibility,performance,contract}/, .github/workflows/
- [X] T002 Initialize Node.js 22+ project: run `pnpm init` to create package.json, then install dependencies using `pnpm add @11ty/eleventy@^3.0.0 @x-govuk/govuk-eleventy-plugin@^4.0.0 js-yaml ajv uuid prom-client pino` for production and `pnpm add -D tsx@^4.7.0 typescript@^5.8.0 vitest@^2.0.0 @playwright/test @axe-core/playwright eslint prettier` for development (per constitution.md Principle VI: NEVER edit package.json directly to install dependencies, ALWAYS use pnpm commands), configure scripts section in package.json manually (build, test, lint) as this is permitted metadata editing
- [X] T003 [P] Configure TypeScript in tsconfig.json: module=NodeNext, target=ESNext, strict=true, noEmit=true, verbatimModuleSyntaxdexed, erasableSyntaxOnly=true per research.md Node.js 22 native TypeScript support
- [X] T004 [P] Configure ESLint and Prettier: .eslintrc.json with TypeScript parser, .prettierrc.json with 2-space indent, trailing commas
- [X] T005 [P] Create .gitignore: node_modules/, _site/, dist/, output/, *.log, .env, history.csv, _data/health.json
- [X] T006 [P] Configure Vitest in vitest.config.ts: coverage 80% minimum (branch and line), native ESM, TypeScript integration per research.md
- [X] T007 [P] Configure Playwright in playwright.config.ts: browsers (chromium, firefox), axe-core for accessibility tests, timeouts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create TypeScript type definitions in src/types/config.ts: Configuration, GlobalSettings, ServiceDefinition, ExpectedValidation, CustomHeader interfaces per data-model.md
- [X] T009 [P] Create TypeScript type definitions in src/types/health-check.ts: HealthCheckResult, ServiceStatus enums, HealthCheckConfig interfaces per data-model.md
- [X] T010 [P] Create TypeScript type definitions in src/types/worker-message.ts: WorkerMessage, WorkerResult, WorkerError interfaces for worker thread communication
- [X] T011 Create JSON Schema definition in src/config/schema.ts: Ajv schema validating config.yaml structure (required fields, service names unique, valid protocols/methods, tag validation, timeout constraints) per FR-001, FR-002, FR-002a, FR-003, FR-007
- [X] T012 Implement YAML configuration loader in src/config/loader.ts: load config.yaml using js-yaml, parse to Configuration type, handle file not found error per FR-001
- [X] T013 Implement configuration validator in src/config/validator.ts: validate parsed config against JSON Schema using Ajv, validate service names unique, validate service name/tag format (ASCII, max 100 chars), ensure removed services are excluded from checks, detailed error reporting to stderr per FR-007, FR-007a, FR-007b
- [X] T014 [P] Implement correlation ID generator in src/logging/correlation.ts: generate UUID v4 using uuid package per FR-036
- [X] T015 [P] Implement structured logger in src/logging/logger.ts: Pino logger with JSON format, correlation ID support, log levels (info/error/debug controlled by DEBUG env var), redaction for sensitive fields per FR-033, FR-034. When DEBUG=debug, emit startup warning to stderr and logs: "WARNING: Debug logging enabled. Sensitive data (API keys, tokens, passwords, PII) will be logged. Use only in secure environments with appropriate log access controls." per FR-034a security warning requirement
- [X] T016 [P] Implement Prometheus metrics setup in src/metrics/prometheus.ts: prom-client registry, health_checks_total counter {service_name, status}, health_check_latency_seconds histogram {service_name}, services_failing gauge per FR-035
- [X] T016a [P] Implement Prometheus HTTP server in src/metrics/server.ts: create HTTP server listening on port 9090 (PROMETHEUS_PORT env var), serve /metrics endpoint using prom-client registry from T016, handle graceful shutdown, log startup/shutdown events per FR-035 requirement to "expose /metrics endpoint"
- [X] T017 [P] Implement metrics buffer in src/metrics/buffer.ts: in-memory buffer (METRICS_BUFFER_SIZE env var, default 1000), queue metrics when Prometheus unavailable, drop oldest when full per FR-035a, FR-035b
- [X] T018 Create Eleventy configuration in eleventy.config.js: import @x-govuk/govuk-eleventy-plugin, configure GOV.UK branding (no Crown logo, "GOV.UK service status" title), input/output directories, Nunjucks template engine per plan.md, research.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3A: User Story 6 & 7 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US6/US7 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T019-T025

### Contract Tests for US6 (Configuration Validation)

- [X] T018a [P] [US6] Write contract test for smoke test workflow in tests/contract/smoke-test-workflow.test.ts: validate workflow triggers on config.yaml changes only, verify workflow permissions (contents:read, pull-requests:write), test config validation execution, test health check execution for all services, verify Markdown comment format with results table (service, status, latency, HTTP code, failure reason), test comment posting failure handling (workflow must fail), test widespread failure warning message, verify workflow YAML structure matches GitHub Actions schema (test MUST fail before T020 implementation)
- [X] T018b [P] [US6] Write integration test for smoke test comment formatting in tests/integration/smoke-test-comment.test.ts: test Markdown table generation from health check results, verify summary statistics (passed/failed/degraded counts), test warning section for widespread failures, verify comment updates on subsequent runs, test large result set formatting (50+ services) (test MUST fail before T020 implementation)

### Contract Tests for US7

- [X] T019a [P] [US7] Write contract test for test workflow output in tests/contract/test-workflow.test.ts: validate workflow runs on PR (non-config changes), executes all test suites (unit, e2e, accessibility, coverage, performance), blocks merge on failure, verify workflow YAML structure matches GitHub Actions schema (test MUST fail before T019 implementation)
- [ ] T020a [P] [US7] Write contract test for smoke test workflow output in tests/contract/smoke-test-workflow.test.ts: validate workflow runs on config.yaml PR changes, posts Markdown comment with formatted results table (service, status, latency, HTTP code, failure reason columns), includes summary and warning sections, verify workflow permissions (contents:read, pull-requests:write), test comment posting failure handling (test MUST fail before T020 implementation)
- [X] T021a [P] [US7] Write contract test for deploy workflow output in tests/contract/deploy-workflow.test.ts: validate workflow runs on schedule (every 5 minutes) and manual dispatch, restores CSV from cache/GitHub Pages/creates new, generates status.json and index.html, deploys to GitHub Pages artifact, verify artifact structure (index.html, status.json, history.csv at root), test failure scenarios (cache limit, network error, CSV corruption) (test MUST fail before T021 implementation)

### Integration Tests for US7

- [X] T022a [US7] Write integration test for conditional workflow logic in tests/integration/workflow-conditions.test.ts: simulate PR with both config.yaml and code changes, verify application tests run first, smoke tests run only if app tests pass, verify fail-fast behavior (test MUST fail before T022 implementation)

### Integration Tests for Workflow Security (US7)

- [X] T023a [P] [US7] Write integration test for workflow permissions in tests/integration/workflow-permissions.test.ts: parse all workflow YAML files in .github/workflows/, verify each workflow has explicit "permissions:" section defined, verify no workflows rely on default permissions, verify least-privilege principle applied (e.g., test.yml has only contents:read, smoke-test.yml has contents:read + pull-requests:write, deploy.yml has contents:read + pages:write + id-token:write), test that workflows without explicit permissions fail validation, verify permissions match FR-037a security requirements (test MUST fail before T023 implementation)

### E2E Tests for US7

- [X] T025a [US7] Write E2E test for deployed status page in tests/e2e/deployment.spec.ts: use Playwright to access deployed GitHub Pages URL, verify page loads within 2 seconds, verify self-contained HTML (no external requests), verify status.json accessible, verify history.csv accessible, test from multiple geographic locations if possible (test MUST fail before T025 implementation)

**Checkpoint**: All US7 tests written and FAILING - ready for US7 implementation (T019-T025)

---

## Phase 3: User Story 7 - Automated Status Page Deployment (Priority: P1) 🎯 MVP INFRASTRUCTURE

**Goal**: Establish automated deployment pipeline that keeps status page current without manual intervention

**Why P1 Infrastructure**: While listed as User Story 7 in spec, deployment automation is foundational for all other stories to function in production. Without this, no status updates reach users.

**Independent Test**: Verify scheduled workflow runs, executes health checks, generates HTML/JSON/CSV, and deploys to GitHub Pages successfully

### Implementation for User Story 7

- [X] T019 [P] [US7] Create GitHub Actions workflow .github/workflows/test.yml: trigger on PR (all files except config.yaml), run pnpm test (unit, e2e, accessibility, coverage, performance suites), block merge if fails per FR-037, FR-040, FR-040a, FR-041
- [X] T020 [P] [US7] Create GitHub Actions workflow .github/workflows/smoke-test.yml: trigger on PR (config.yaml changes), workflow permissions contents:read pull-requests:write, validate config.yaml syntax/schema, execute health checks for all services, post formatted Markdown comment with results table (service name, status, latency, HTTP status code, failure reason columns), if all services fail include warning section at top using EXACT format from FR-038b (`## ⚠️ WARNING: All Services Failed` as Markdown H2 heading at top of comment before results table, followed by bold introductory sentence `**All configured services failed health checks during this smoke test.**`, followed by bulleted list explaining possible causes per FR-038b, followed by bold recommendation `**Review the failure reasons below carefully before merging this PR.**`, maintaining accessible formatting per FR-038b requirements), fail workflow if comment posting fails per FR-038a, allow merge (pass workflow) even if all services fail per FR-038b
- [X] T021 [P] [US7] Create GitHub Actions workflow .github/workflows/deploy.yml: schedule cron "*/5 * * * *" (every 5 minutes), manual dispatch support, restore CSV from GitHub Actions cache (primary), fetch CSV from GitHub Pages if cache miss, create new CSV if both fail (first run), execute health checks, append results to CSV, save CSV to Actions cache (fail immediately if cache limit), generate static HTML/JSON, deploy to GitHub Pages using actions/upload-pages-artifact and actions/deploy-pages, include CSV in deployment, retain artifacts on mid-execution failure per FR-042, FR-042a, FR-020b, FR-020c, FR-020d, FR-020e (depends on T025a - Pages must be enabled first)
- [X] T022 [US7] Update test workflow with conditional logic: if PR changes both config.yaml and code, run application tests first (fail fast), only run smoke tests if application tests pass per FR-039, FR-039a
- [X] T023 [US7] Configure workflow explicit permissions: research GitHub Actions security best practices for open source repositories using Perplexity/Context7/WebSearch (search terms: "GitHub Actions security best practices open source 2025", "principle of least privilege GitHub workflows", "workflow permissions security hardening"), document research findings in docs/security.md with citations (sources consulted, key findings, permission decisions, rationale per FR-037a requirements), apply principle of least privilege to all workflows, never use default permissions, verify each workflow has explicit permissions block matching required scopes
- [X] T024 [US7] Configure main branch protection in .github/settings: require PR approval, require all CI tests pass before merge (application tests or smoke tests depending on change type) per FR-041 (COMPLETED via gh CLI: required_status_checks=[test, Run All Tests], required_reviews=1, linear_history=true, force_push_blocked=true)
- [X] T024a [US7] Configure Lighthouse CI in test workflow .github/workflows/test.yml: add lighthouserc.json config at repo root defining performance budget (performance score ≥ 90, FCP < 1.8s, LCP < 2.5s, TTI < 3.5s per constitution.md Principle V), add Lighthouse CI action step after test execution (uses treosh/lighthouse-ci-action@v9), run Lighthouse against PR preview or local build, upload results to temporary public storage or GitHub Actions artifacts, post Lighthouse score as PR comment showing performance metrics and score, fail workflow if performance score < 90 blocking merge per constitution.md Principle V enforcement requirement, configure desktop and mobile audits
- [X] T025a [US7] Enable GitHub Pages using gh CLI: execute `gh api repos/:owner/:repo/pages -X POST -f source[branch]=main -f source[path]=/` to enable Pages, verify enabled status with `gh api repos/:owner/:repo/pages`, configure custom domain if available (optional, deferred for initial release), test Pages serving by accessing https://{owner}.github.io/{repo}/, document commands executed in docs/deployment.md per FR-043 requirement for "one-time setup step using gh CLI" (CONFIRMED COMPLETE BY USER)
- [X] T025b [US7] Document deployment workflow in docs/deployment.md: workflow permissions explanation (contents:read, pages:write, id-token:write for artifact deployment), CSV three-tier fallback chain (Actions cache → GitHub Pages → new file), manual CSV rotation guidance (when to rotate, how to archive, cache limit monitoring), cache limit troubleshooting steps (gh cache list, gh cache delete), deployment failure recovery procedures (manual artifact download, local regeneration, manual gh CLI deployment)
- [X] T025c [P] [US7] Create Dependabot configuration in .github/dependabot.yml: enable npm ecosystem (package-ecosystem: "npm"), schedule daily checks (interval: "daily"), target main branch, configure version updates strategy, group updates by dependency type (separate PRs for dependencies vs devDependencies using grouped updates), set commit message prefix ("chore(deps):"), enable automatic rebase, assign to team members or use auto-merge for patch/minor updates after CI passes per spec.md assumption "Dependabot automatically creates pull requests to keep npm dependencies up to date"

**Checkpoint**: At this point, deployment pipeline is fully functional - any implemented user stories will automatically deploy

---

## Phase 4A: User Story 1 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US1 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T026-T044

### Unit Tests for US1

- [x] T026a [P] [US1] Write unit test for HTTP health check in tests/unit/health-checks/http-check.test.ts: test GET/HEAD/POST methods, custom headers, POST payloads, AbortSignal.timeout() for timeouts, status code validation (expected vs actual), response text validation (search first 100KB, case-sensitive substring), response header validation (case-insensitive name, case-sensitive value, Location for redirects), return HealthCheckResult with all fields, test network errors (DNS failure, connection refused), test timeout scenarios (test MUST fail before T026 implementation)
- [x] T027a [P] [US1] Write unit test for response validation in tests/unit/health-checks/validation.test.ts: test validateStatusCode (match expected), test validateResponseText (substring in first 100KB, case-sensitive), test validateResponseHeaders (Location header for redirect, case-insensitive name matching), test validation failures (status mismatch, text not found, header mismatch), verify return values (boolean or validation result objects) (test MUST fail before T027 implementation)
- [x] T028a [P] [US1] Write unit test for retry logic in tests/unit/health-checks/retry-logic.test.ts: test retry for network errors only (connection refused, DNS failure, timeout), verify max 3 immediate retries (no delays, no exponential backoff), verify retries don't count toward consecutive failure threshold, verify NO retry for status/text/header validation failures, test retry exhaustion (all 3 retries fail), verify final result after retries (test MUST fail before T028 implementation)
- [x] T029a [US1] Write unit test for health check worker in tests/unit/health-checks/worker.test.ts: test worker thread receives WorkerMessage via postMessage, test worker executes http-check with retry-logic, test status determination (FAIL: validation failed or timeout, DEGRADED: passed but latency > warning_threshold, PASS: passed and latency <= warning_threshold), test Prometheus metrics emission, test WorkerResult return with correlation ID, test worker error handling and structured errors (test MUST fail before T029 implementation)
### CSV Writer Test Suite (T030a/b/c/d - comprehensive coverage across test types)

- [x] T030a [P] [US1] Write unit test for CSV writer in tests/unit/storage/csv-writer.test.ts: test append HealthCheckResult to history.csv, verify columns (timestamp ISO 8601, service_name, status PASS/DEGRADED/FAIL, latency_ms integer, http_status_code, failure_reason empty if passed, correlation_id), test file creation if not exists, test append without duplicate headers, test exit with non-zero on write failure (permissions, disk space), verify atomic writes, test RFC 4180 escaping (commas, quotes, newlines per FR-018) (test MUST fail before T030 implementation)
- [X] T030c [P] [US1] Write unit test for GitHub Actions cache scenarios in tests/unit/storage/cache-failure.test.ts: test cache limit exceeded (expect immediate workflow failure per FR-020c), test network error fetching CSV from GitHub Pages (expect immediate workflow failure per FR-020d), test cache miss fallback to GitHub Pages (successful retrieval), test corrupted CSV validation and fallback to next tier (log error, emit alert, try next tier per FR-020e), verify three-tier fallback chain (Actions cache → Pages → new file), test first-run scenario (both cache and Pages return 404, create new CSV) (test MUST fail before implementing cache-manager.ts)
- [ ] T030d [P] [US1] Write integration test for CSV continuity across workflow runs in tests/integration/csv-continuity.test.ts: simulate multiple workflow runs (3+ cycles), verify CSV appends without data loss between runs, test cache restoration preserves historical data, verify no duplicate records, test timestamp ordering (newest last), validate SC-013 success criterion "CSV historical data persists across workflow runs using GitHub Actions cache with GitHub Pages as fallback" (test MUST fail before full cache-manager.ts implementation)
- [x] T031a [P] [US1] Write unit test for CSV reader in tests/unit/storage/csv-reader.test.ts: test read history.csv, test format validation (headers present, parse sample rows), test consecutive failure derivation (count consecutive FAIL statuses per service from recent records), test handling of corrupted CSV (log error, emit alert, return validation errors), verify fallback to next tier on corruption, test empty CSV file handling (test MUST fail before T031 implementation)
- [x] T032a [P] [US1] Write unit test for JSON writer in tests/unit/storage/json-writer.test.ts: test write _data/health.json from HealthCheckResult array, test mapping to ServiceStatusAPI format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), test sorting (FAIL → DEGRADED → PASS → PENDING), test null values for PENDING services (latency_ms, last_check_time, http_status_code all null), test exit with non-zero on write failure, verify JSON structure matches OpenAPI schema (test MUST fail before T032 implementation)
- [ ] T033a [US1] Write unit test for worker pool manager in tests/unit/orchestrator/pool-manager.test.ts: test worker pool creation (size = 2x CPU cores for I/O-bound operations, configurable via worker_pool_size setting), test worker lifecycle management (auto-restart on failure), test distribute health checks across workers, test correlation ID tracking per task, test task-level timeouts, test graceful shutdown (30s max wait for in-flight checks, force termination after), test structured error handling with graceful degradation (INCOMPLETE: Contains 11 test.skip() violations of Constitution Principle IX - must remove all skipped tests)
- [ ] T034a [US1] Write unit test for scheduler in tests/unit/orchestrator/scheduler.test.ts: test setInterval for health check cycles (default 60s, per-service override), test priority queue by next check time, test worker pool trigger for each cycle, test wait for first cycle completion before generating initial HTML (all services PENDING during first cycle), test HTML/JSON regeneration after every cycle completion regardless of status changes, test cycle timing accuracy (INCOMPLETE: Contains test.skip() violations of Constitution Principle IX - must remove all skipped tests)
- [X] T035a [US1] Write unit test for 11ty runner in tests/unit/orchestrator/eleventy-runner.test.ts: test invoke 11ty CLI (npx @11ty/eleventy) as subprocess, test capture stdout/stderr, test handle subprocess failure (log error, retain previous HTML, emit alert, continue health checks), test retry generation on next cycle after failure, verify subprocess exit codes (test MUST fail before T035 implementation)

### Integration Tests for US1

- [ ] T033b [US1] Write integration test for worker pool integration in tests/integration/worker-pool-integration.test.ts: test real worker threads execution with mock HTTP servers (MUST use MSW or similar per Constitution Principle X - no external services), verify workers execute in parallel, verify correlation IDs propagate through logs, verify worker failures handled gracefully with pool auto-restart, test under load (10+ concurrent health checks) (INCOMPLETE: Currently uses real HTTP requests, violates Constitution Principle X - must implement mock services)
- [ ] T034b [US1] Write integration test for scheduler integration in tests/integration/scheduler-integration.test.ts: test scheduler triggers worker pool at configured intervals, verify first cycle completion before HTML generation, verify HTML regeneration after each cycle, test cycle interruption and recovery, verify timing accuracy over multiple cycles (INCOMPLETE: Contains 2 test.skip() violations of Constitution Principle IX - must remove all skipped tests)
- [ ] T044b [US1] Write integration test for full health check cycle in tests/integration/end-to-end-cycle.test.ts: test complete pipeline (health check → CSV append → _data/health.json write → 11ty CLI invocation → HTML generation → asset inlining), use mock services instead of real endpoints (MUST use MSW or similar per Constitution Principle X), verify CSV format and consecutive failure tracking, verify JSON format matches OpenAPI schema, verify generated HTML is self-contained (no external requests), verify output/ directory structure, test cycle under various scenarios (all pass, some fail, some degraded, first run PENDING) (INCOMPLETE: Contains 1 test.skip() violation of Constitution Principle IX, needs mock service implementation)

### Contract Tests for US1

- [X] T032b [P] [US1] Write contract test for _data/health.json schema in tests/contract/health-json.test.ts: validate generated _data/health.json against ServiceStatusAPI schema from OpenAPI spec, verify array structure, verify required fields (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), verify enum values for status (PENDING, PASS, DEGRADED, FAIL), verify sorting order (FAIL first), verify null handling for PENDING services (test MUST fail before T032 implementation)
- [X] T032c [P] [US1] Write integration test for HTML/JSON synchronization in tests/integration/html-json-sync.test.ts: generate mock health check results, write to CSV and _data/health.json, invoke 11ty build and post-build inlining, parse output/index.html (extract service names, statuses, latencies from HTML DOM) and output/status.json, verify both contain identical current status data for all services (same service count, same status values, same latency values, same timestamps), verify SC-006 requirement "HTML and JSON remain synchronized", test with various scenarios (all pass, some fail, some degraded, mixed states) (test MUST fail before implementing full pipeline)
- [X] T030b [P] [US1] Write contract test for CSV format in tests/contract/history-csv.test.ts: validate history.csv format (columns: timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id), verify timestamp is ISO 8601, verify status is PASS/DEGRADED/FAIL uppercase, verify latency_ms is integer, verify correlation_id is UUID v4, test parsing and type validation (test MUST fail before T030 implementation)

### E2E Tests for US1

- [ ] T039a [US1] Write E2E test for status page display in tests/e2e/status-page.spec.ts: use Playwright to load generated status page (from _site/ or output/), verify service list displays all configured services, verify failing services appear first, verify DEGRADED services appear second, verify PASS services appear third, verify PENDING services appear last, verify each service shows (name, status indicator, last check time, latency, HTTP status code, failure reason if failed), verify page generation timestamp visible and distinct from service check times, verify meta refresh tag present (`<meta http-equiv="refresh" content="60">`), verify page title "GOV.UK service status" (INCOMPLETE: Contains 1 test.skip() violation of Constitution Principle IX - must remove skipped test)
- [X] T044c [US1] Write E2E test for self-contained HTML in tests/e2e/self-contained-html.spec.ts: use Playwright to load output/index.html, verify page loads with zero external network requests (monitor network tab), verify all CSS inlined in `<style>` tags, verify all JavaScript inlined in `<script>` tags, verify all images base64-encoded as data URIs, verify GOV.UK Design System assets inlined (CSS, JS, images from plugin), verify file size < 5MB, verify page still functional after disabling network (test MUST fail before T044 implementation)

### Accessibility Tests for US1

- [ ] T039b [US1] Write accessibility test for status page WCAG 2.2 AAA in tests/accessibility/wcag-aaa.spec.ts: use Playwright with axe-core integration, run automated accessibility scan on generated status page, verify WCAG 2.2 AAA compliance (no violations), test enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text), test comprehensive ARIA labels and landmarks, test keyboard navigation support (tab through all interactive elements), verify clear focus indicators (3:1 contrast per GDS), verify no reliance on color alone for status indication, verify screen reader compatibility (test with virtual screen reader if possible), verify all non-text content has text alternatives (test MUST fail before T039 implementation)

### Performance Tests for US1

- [ ] T044d [US1] Write performance test for page load in tests/performance/page-load.spec.ts: use Playwright to measure page load time on simulated 3G connection (1.6 Mbps down, 768 Kbps up, 300ms RTT) per constitution.md Principle V, verify First Contentful Paint (FCP) < 1.8s, verify Largest Contentful Paint (LCP) < 2.5s, verify Time to Interactive (TTI) < 3.5s, verify Cumulative Layout Shift (CLS) < 0.1, verify Total Blocking Time (TBT) < 300ms, verify total page weight < 500KB uncompressed, verify compressed HTML < 14KB (using Brotli/Gzip), fail test if any metric exceeds threshold per FR-040a constitution compliance (test MUST fail before T044 implementation)
- [ ] T044e [P] [US1] Write integration test for removed service handling in tests/integration/removed-services.test.ts: configure 3 services in config.yaml, run health check cycle, verify all 3 appear in HTML/JSON output, modify config.yaml to remove 1 service, restart orchestrator, run new health check cycle, verify removed service disappeared from HTML output (not in service list), verify removed service disappeared from JSON output (status.json), verify historical CSV data for removed service still present (preserved indefinitely per FR-007b), verify no new health checks performed for removed service (test MUST fail before implementing config reload logic)

**Checkpoint**: All US1 tests written and FAILING - ready for US1 implementation (T026-T044)

---

## Phase 4: User Story 1 - View Current Service Status (Priority: P1) 🎯 MVP

**Goal**: Enable users to quickly see which public services are operational and which are experiencing issues

**Independent Test**: Access status page, view list of services with health status, see failing services first, view check time and latency

### Implementation for User Story 1

- [X] T026 [P] [US1] Implement HTTP health check logic in src/health-checks/http-check.ts: use native Node.js 22+ fetch() API, support GET/HEAD/POST methods, custom headers, POST payloads, AbortSignal.timeout() for timeouts, validate status code, search first 100KB of body for expected text, validate response headers (Location for redirects), record response latency, return HealthCheckResult per FR-004, FR-004a, FR-005, FR-006, FR-008, FR-010, FR-011, FR-012, FR-013, FR-014, FR-014a, FR-017
- [X] T027 [P] [US1] Implement response validation in src/health-checks/validation.ts: validate status code matches expected, search response body for expected text (case-sensitive substring, first 100KB), validate response headers (case-insensitive name, case-sensitive value), check latency against warning_threshold for DEGRADED status, return validation results per FR-013, FR-014, FR-014a, FR-017a
- [X] T028 [P] [US1] Implement retry logic in src/health-checks/retry-logic.ts: retry network errors only (connection refused, DNS failure, timeout), max 3 immediate retries (no delays), retries don't count toward consecutive failure threshold, don't retry status/text/header validation failures per FR-017b
- [x] T029 [US1] Implement health check worker in src/health-checks/worker.ts: worker thread using worker_threads module, receive WorkerMessage via postMessage, execute http-check with retry-logic, determine status (FAIL: validation failed or timeout, DEGRADED: passed but latency > warning_threshold, PASS: passed and latency <= warning_threshold), emit Prometheus metrics, return WorkerResult with correlation ID per FR-009a, FR-015, FR-015b
- [X] T030 [P] [US1] Implement CSV writer in src/storage/csv-writer.ts: append HealthCheckResult to history.csv, columns: timestamp (ISO 8601), service_name, status (PASS/DEGRADED/FAIL), latency_ms (integer), http_status_code, failure_reason (empty if passed), correlation_id, exit with non-zero if write fails per FR-016, FR-018, FR-020, FR-020a
- [X] T031 [P] [US1] Implement CSV reader in src/storage/csv-reader.ts: read history.csv, validate format (headers, parse sample rows), derive consecutive failure count from consecutive FAIL statuses per service, return validation errors, handle corrupted CSV (log error, emit alert, fallback to next tier) per FR-015a, FR-020e
- [X] T032 [P] [US1] Implement JSON data writer in src/storage/json-writer.ts: write _data/health.json from HealthCheckResult array, map to ServiceStatusAPI format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), sort FAIL → DEGRADED → PASS → PENDING, null values for PENDING services, exit with non-zero if write fails per FR-022, FR-028a
- [X] T033 [US1] Implement worker pool manager in src/orchestrator/worker-pool.ts: create worker pool sized to CPU cores (2x cores for I/O-bound operations, configurable via worker_pool_size setting), manage worker lifecycle (auto-restart on failure), distribute health checks across workers, track correlation IDs, implement task-level timeouts (graceful shutdown: 30s max wait for in-flight checks), structured error handling per FR-009a, FR-032
- [X] T034 [US1] Implement scheduler in src/orchestrator/scheduler.ts: setInterval for health check cycles (default 60s, per-service override), priority queue by next check time, trigger worker pool for each cycle, wait for first cycle completion before generating initial HTML (all services PENDING), regenerate HTML/JSON after every cycle completion regardless of status changes per FR-009, FR-028
- [X] T035 [US1] Implement 11ty runner in src/orchestrator/eleventy-runner.ts: invoke 11ty CLI (npx @11ty/eleventy) as subprocess after each health check cycle, capture stdout/stderr, handle failure (log error, retain previous HTML, emit alert, continue health checks), retry generation on next cycle per FR-030
- [x] T036 [P] [US1] Create GOV.UK base layout in _includes/layouts/base.njk: extend @x-govuk/govuk-eleventy-plugin base layout, page title "GOV.UK service status", meta refresh tag `<meta http-equiv="refresh" content="60">`, no Crown logo/official branding per FR-021, FR-029
- [x] T037 [P] [US1] Create service status component in _includes/components/service-status.njk: display service name, status indicator (healthy/degraded/failed/pending), last check time, latency, HTTP status code, failure reason if failed, using GOV.UK Design System components per FR-027, FR-027a
- [x] T038 [P] [US1] Create status indicator macro in _includes/macros/status-indicator.njk: visual indicators for PASS (green), DEGRADED (yellow), FAIL (red), PENDING (grey), using GOV.UK tag components per FR-027
- [x] T039 [US1] Create main status page template in pages/index.njk: load _data/health.json, display page generation timestamp, failing services first, then degraded, then healthy, then pending, flat list (no grouping), show last update time, accessible to screen readers (WCAG 2.2 AAA) per FR-021, FR-023, FR-026, FR-029a, FR-029b
- [x] T040 [US1] Create main orchestrator entry point in src/index.ts: load and validate config.yaml (exit if invalid), initialize logger with correlation ID, start Prometheus metrics server, initialize worker pool, start scheduler for health check cycles, handle graceful shutdown (SIGTERM/SIGINT), run via tsx per FR-030, FR-032
- [X] T041 [US1] Implement post-build asset inlining script in src/inlining/post-build.ts: custom Node.js script using native Node.js 22+ features, read generated HTML from _site/, inline CSS into `<style>` tags, inline JavaScript into `<script>` tags, base64 encode images as data URIs, write self-contained HTML to output/, fail with non-zero if inlining fails per FR-021
- [X] T042 [P] [US1] Implement CSS inliner in src/inlining/css-inliner.ts: read CSS files, inline into `<style>` tags in HTML head, handle GOV.UK Design System CSS from plugin per FR-021
- [X] T043 [P] [US1] Implement JavaScript inliner in src/inlining/js-inliner.ts: read JavaScript files, inline into `<script>` tags before closing `</body>`, handle GOV.UK Design System JS from plugin per FR-021
- [X] T044 [P] [US1] Implement image inliner in src/inlining/image-inliner.ts: read image files (PNG, JPG, SVG, ICO), base64 encode as data URIs, replace `<img src>` and CSS `url()` references, handle GOV.UK Design System images from plugin per FR-021
- [X] T045a [P] [US1] Write unit test for size validation in tests/unit/inlining/size-validator.test.ts: test size calculation, verify failure when > 5MB, test warning when > 4MB (80% threshold), verify error message clarity, test suggested optimizations (test MUST fail before T045 implementation)
- [X] T045 [P] [US1] Implement HTML size validation in src/inlining/size-validator.ts: check final HTML file size after inlining, fail with clear error if > 5MB, log actual size and components contributing to size, suggest optimization strategies (unused CSS removal, image compression), exit with non-zero code if exceeded per FR-021 constraint

### Additional Error Handling and Recovery Tasks

- [ ] T046 [US1] Implement graceful shutdown handler in src/orchestrator/shutdown.ts: handle SIGTERM/SIGINT signals, wait up to 30 seconds for in-flight checks, track correlation IDs of interrupted checks, force exit after timeout, log shutdown progress per FR-032
- [ ] T047 [US1] Implement CSV corruption recovery in src/storage/csv-recovery.ts: detect corrupted CSV on read (invalid headers, malformed rows), attempt repair by removing corrupted rows, create backup before repair, fall through to next tier if unrepairable, log detailed corruption analysis per FR-020e
- [ ] T048 [US1] Write integration test for shutdown scenarios in tests/integration/graceful-shutdown.test.ts: test shutdown during active health checks, verify 30-second timeout enforcement, test correlation ID tracking, verify forced termination, test recovery on next startup

### Constitution Compliance Tasks (NEW - Added per Constitution v1.3.0)

- [X] T083 [US1] Remove all test.skip() violations from test files: remove 11 test.skip() from tests/unit/orchestrator/pool-manager.test.ts, remove 2 test.skip() from tests/integration/scheduler-integration.test.ts, remove 1 test.skip() from tests/integration/end-to-end-cycle.test.ts, remove 1 test.skip() from tests/e2e/status-page.spec.ts, verify all tests run and pass per Constitution Principle IX (NON-NEGOTIABLE: no skipped tests in production code)
- [X] T084 [US1] Implement mock service infrastructure for testing: install MSW (Mock Service Worker) or similar mocking library, create mock HTTP server for integration tests in tests/mocks/mock-services.ts, simulate successful responses (200 OK with varying latencies), error responses (400, 404, 500, 503), timeout scenarios, network failures (ECONNREFUSED, ENOTFOUND), flaky behavior (intermittent failures), replace all real HTTP calls in integration tests with mock services per Constitution Principle X (NON-NEGOTIABLE: no external service calls in tests)
- [X] T085 [US1] Update integration tests to use mock services: update tests/integration/worker-pool-integration.test.ts to use mock servers instead of httpbin.org, update tests/integration/end-to-end-cycle.test.ts to use mock services, verify tests run without internet connectivity, ensure deterministic test execution per Constitution Principle X

**Checkpoint**: At this point, User Story 1 is fully functional with 100% constitution compliance - users can view current service status on auto-updating HTML page with robust error handling and all tests passing

---

## Phase 5A: User Story 2 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US2 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T049-T051

### Unit Tests for US2

- [ ] T049a [P] [US2] Write unit test for status tags component in tests/unit/components/status-tags.test.ts: test govukTag macro rendering for each service tag, verify multiple tags rendered per service, verify tag HTML structure matches GOV.UK Design System, test empty tags array handling, verify tag text content and CSS classes (test MUST fail before T049 implementation)

### E2E Tests for US2

- [ ] T050a [US2] Write E2E test for tag display in tests/e2e/service-tags.spec.ts: use Playwright to load status page with tagged services, verify tags displayed as labels next to each service name, verify multiple tags visible per service, verify tag styling matches GOV.UK Design System (govuk-tag class), verify untagged services grouped in separate "Untagged Services" section at bottom of page, verify section heading present, verify tagged and untagged services both display correctly (test MUST fail before T050 implementation)
- [ ] T051a [US2] Write E2E test for JSON API tags in tests/e2e/tags-json-api.spec.ts: fetch status.json, verify each service object includes tags array, verify tags array empty for untagged services, verify tags array populated for tagged services, verify tags match config.yaml values (test MUST fail before T051 implementation)

**Checkpoint**: All US2 tests written and FAILING - ready for US2 implementation (T049-T051)

---

## Phase 5: User Story 2 - Identify Service Categories via Tags (Priority: P2)

**Goal**: Enable users to understand service categorization through visible tag labels

**Independent Test**: View status page, see tags displayed as labels next to each service, identify related services by tag, see untagged services in separate section

### Implementation for User Story 2

- [ ] T049 [P] [US2] Create status tags component in _includes/components/status-tags.njk: render GOV.UK tag components for each service tag, use govukTag macro from Design System, display multiple tags per service per FR-024, FR-025
- [ ] T050 [US2] Update status page template in pages/index.njk: add status-tags component to each service display, group services (failing → degraded → healthy → untagged section at bottom), untagged section heading "Untagged Services" per FR-024a
- [ ] T051 [US2] Update JSON writer in src/storage/json-writer.ts: include tags array in ServiceStatusAPI output, empty array for services without tags per FR-022

**Checkpoint**: At this point, User Stories 1 AND 2 work - users see categorized services with visual tag labels

---

## Phase 6A: User Story 5 Tests (TDD - Write First) ⚠️

**Purpose**: Write failing tests BEFORE US5 implementation per Constitution Principle III

**TDD Requirement**: These tests MUST be written first and MUST fail before implementing T052-T053

### E2E Tests for US5

- [ ] T052a [US5] Write E2E test for meta refresh behavior in tests/e2e/auto-refresh.spec.ts: use Playwright to load status page, verify meta refresh tag content matches settings.page_refresh from config.yaml (default 60s), verify page automatically refreshes after configured interval (wait 61s, check for page reload event), verify updated status displays after refresh (simulate status change, wait for refresh, verify new status visible), verify refresh works without JavaScript enabled, test on 3G network throttling (1.6 Mbps down, 768 Kbps up, 300ms RTT) per SC-003 (test MUST fail before T052 implementation)
- [ ] T053a [US5] Write E2E test for last update display in tests/e2e/last-update-display.spec.ts: use Playwright to load status page, verify prominent last update time displayed, verify page generation timestamp visible and distinct from individual service check times, verify "time since last check" shown for each service, verify timestamps in user-friendly format (relative time or ISO 8601 with local conversion) (test MUST fail before T053 implementation)

**Checkpoint**: All US5 tests written and FAILING - ready for US5 implementation (T052-T053)

---

## Phase 6: User Story 5 - Automatic Status Updates (Priority: P2)

**Goal**: Enable page to refresh automatically without manual reload during incident monitoring

**Independent Test**: Open status page, observe automatic refresh after 60 seconds, see updated status without manual reload, see last update time

**Note**: Most implementation already complete in US1 (meta refresh tag) - this phase adds visibility features

### Implementation for User Story 5

- [ ] T052 [US5] Update base layout in _includes/layouts/base.njk: ensure meta refresh tag content matches settings.page_refresh from config.yaml (default 60s) per FR-029
- [ ] T053 [US5] Update status page template in pages/index.njk: add prominent page generation timestamp at top using dual format from FR-029b (relative + absolute in `<time>` element), implement relative time calculation helper (Nunjucks macro or JavaScript for auto-update), show time since last check for each service using same dual format, ensure page generation timestamp visually distinct from service check times (different heading level or visual separator), verify semantic HTML `<time datetime>` for screen reader accessibility

**Checkpoint**: User Stories 1, 2, AND 5 work - users see auto-updating categorized service status

---

## Phase 7: User Story 3 - Access Historical Service Performance (Priority: P3)

**Goal**: Enable programmatic access to historical performance data for trend analysis

**Independent Test**: Access history.csv file to retrieve historical health check results, calculate uptime percentages, identify patterns

**TDD Workflow**: This phase embeds TDD within implementation sequence (tests T054a-T057a annotated with "test MUST fail before implementation"). All test tasks MUST be completed and MUST fail before corresponding implementation tasks (T054-T056).

### TDD Tests for US3

- [ ] T054a [P] [US3] Write unit test for CSV export endpoint in tests/unit/api/csv-export.test.ts: test HTTP endpoint /history.csv serves CSV file, verify correct Content-Type header (text/csv), test range queries with date parameters, test pagination for large datasets, verify CSV format maintained (test MUST fail before T054 implementation)
- [ ] T055a [P] [US3] Write unit test for historical data queries in tests/unit/storage/csv-query.test.ts: test query by service name, test query by date range, test uptime percentage calculation (24h, 7d, 30d), test aggregation functions (average latency, failure count), verify performance with large CSV files (test MUST fail before T055 implementation)
- [ ] T056a [P] [US3] Write unit test for data retention in tests/unit/storage/csv-retention.test.ts: test automatic rotation when file exceeds size limit (configurable, default 100MB), test archival to timestamped files, test cleanup of archives older than retention period (configurable, default 90 days), verify continuity during rotation (test MUST fail before T056 implementation)
- [ ] T057a [US3] Write E2E test for historical data access in tests/e2e/historical-data.spec.ts: use Playwright or HTTP client to access /history.csv endpoint, verify CSV file downloadable, parse CSV and verify format (columns: timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id), test date range filtering, verify uptime calculation accuracy (test MUST fail before implementation)

### Implementation for US3

- [ ] T054 [P] [US3] Implement CSV export endpoint in src/api/csv-export.ts: serve history.csv via HTTP endpoint, support range queries (?from=date&to=date), implement streaming for large files, add appropriate cache headers per SC-008
- [ ] T055 [P] [US3] Implement historical data query functions in src/storage/csv-query.ts: query by service name, filter by date range, calculate uptime percentages (24h, 7d, 30d), compute aggregate statistics, optimize for performance with indexed reads
- [ ] T056 [US3] Implement CSV retention policy in src/storage/csv-retention.ts: monitor file size, rotate at configurable threshold (default 100MB), archive with timestamp, clean up old archives (default >90 days), maintain write continuity during rotation

**Checkpoint**: User Story 3 complete - programmatic access to historical data available

---

## Phase 8: User Story 4 - Consume Service Status via API (Priority: P3)

**Goal**: Enable machine-readable access to current status for integration with other systems

**Independent Test**: Make HTTP request to /status.json endpoint, receive structured current status data, integrate with external monitoring

**TDD Workflow**: This phase embeds TDD within implementation sequence (tests T058a-T061a annotated with "test MUST fail before implementation"). All test tasks MUST be completed and MUST fail before corresponding implementation tasks (T058-T061).

### TDD Tests for US4

- [ ] T058a [P] [US4] Write unit test for API versioning in tests/unit/api/versioning.test.ts: test version header support (X-API-Version), test URL path versioning (/api/v1/status.json), test backward compatibility, verify deprecation warnings, test version negotiation (test MUST fail before T058 implementation)
- [ ] T059a [P] [US4] Write unit test for rate limiting in tests/unit/api/rate-limit.test.ts: test request counting per IP, test rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining), test 429 response when exceeded, test configurable limits, verify reset timing (test MUST fail before T059 implementation)
- [ ] T060a [P] [US4] Write unit test for CORS configuration in tests/unit/api/cors.test.ts: test Access-Control headers, test allowed origins configuration, test preflight OPTIONS requests, verify allowed methods (GET only), test credential handling (test MUST fail before T060 implementation)
- [ ] T061a [US4] Write E2E test for JSON API in tests/e2e/json-api.spec.ts: fetch /status.json endpoint, verify JSON structure matches OpenAPI schema, verify all required fields present (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason), test API versioning headers, test rate limiting behavior (test MUST fail before implementation)

### Implementation for US4

- [ ] T058 [P] [US4] Implement API versioning in src/api/versioning.ts: support header-based versioning, implement URL path versioning, maintain v1 compatibility, add deprecation warnings for old versions per SC-010
- [ ] T059 [P] [US4] Implement rate limiting in src/api/rate-limit.ts: count requests per IP address, enforce configurable limits (default 60/minute), return appropriate headers, send 429 when exceeded, implement sliding window
- [ ] T060 [P] [US4] Implement CORS configuration in src/api/cors.ts: configure allowed origins (default: *), set appropriate headers, handle preflight requests, restrict to GET method only
- [ ] T061 [US4] Update JSON API endpoint: integrate versioning, rate limiting, and CORS with existing status.json generation, ensure backward compatibility maintained

**Checkpoint**: User Story 4 complete - full API access with proper versioning and rate limiting

---

## Phase 9: Technical Debt & Standardization

**Goal**: Clean up technical debt, standardize terminology, and improve maintainability

- [ ] T062 Standardize terminology from "pings" to "services" in config.yaml structure: update TypeScript types in src/types/config.ts, update JSON Schema in src/config/schema.ts, maintain backward compatibility with deprecation warning for "pings" key
- [ ] T063 Update documentation for terminology changes: update spec.md configuration examples, update quickstart.md, add migration guide for existing configs, update all code comments. Standardize inconsistent terminology: (1) use "self-contained HTML" (not just "self-contained") consistently across all documents, (2) use "health check cycle" (singular) for the process, "health checks" (plural) when referring to multiple checks, update spec.md, plan.md, tasks.md, and code comments per analysis findings T1 and T2
- [ ] T064 [P] Refactor task naming patterns in test files: rename test files from pattern T###a to T###-test for clarity, update test imports accordingly
- [ ] T065 [P] Create comprehensive API documentation in docs/api.md: document all endpoints (/status.json, /history.csv), include OpenAPI specification, provide integration examples, document rate limits and versioning

**Checkpoint**: Technical debt resolved, codebase standardized and maintainable

---

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T066 [P] Create main README.md: project overview, quick start, features, architecture diagram, links to documentation, license information per plan.md
- [ ] T067 [P] Create MIT LICENSE file: standard MIT license text with Crown (GDS) copyright per plan.md
- [ ] T068 [P] Update package.json scripts: add "build", "start", "dev", "test" (executes pnpm test which runs all test suites per FR-040a: unit, e2e, accessibility, coverage validation, performance), "lint", "lint:fix", "type-check", "validate-config" commands per quickstart.md
- [ ] T069 [P] Create example config.yaml in repository root: 2-3 example services demonstrating GET, HEAD, POST methods, status validation, text validation, header validation, redirect validation, tags per configuration structure from spec.md
- [ ] T070 [P] Add structured logging to all modules: include correlation IDs in all log statements, DEBUG env var controls verbosity, security warnings for debug mode (per T015 implementation), use child loggers per context per FR-033, FR-034, FR-034a. Document debug security warnings in docs/logging.md per FR-034a requirement: "Debug mode security implications - sensitive data (API keys, tokens, passwords, PII) logged when DEBUG=debug enabled. Operators must ensure appropriate log access controls and use debug mode only in secure troubleshooting environments."
- [ ] T071 [P] Add error handling to all modules: structured error objects, detailed error messages, appropriate exit codes (non-zero for failures), stderr output for validation errors per FR-007, FR-020a, FR-028a
- [ ] T072 [P] Validate quickstart.md: verify all commands work, test development workflow, validate prerequisites, test troubleshooting steps per quickstart.md content
- [ ] T073 Code review and refactoring: remove code duplication, improve type safety, optimize performance, ensure consistent naming conventions
- [ ] T074 Security hardening: validate no secrets in code, review workflow permissions, implement input validation for all external data, add rate limiting considerations to docs
- [ ] T075 [P] Performance optimization: benchmark health check cycle time, HTML generation time, memory usage, set aggressive thresholds, document in performance tests per FR-040a
- [ ] T076 [P] Accessibility validation: run axe-core tests via Playwright, verify WCAG 2.2 AAA compliance (color contrast 7:1 normal text, 4.5:1 large text), test with screen readers (NVDA, VoiceOver, JAWS), verify keyboard navigation, check focus indicators per FR-029a
- [ ] T077 Final integration testing: end-to-end test full health check → CSV → 11ty → inlining → deployment cycle, verify CSV fallback chain, test graceful shutdown, validate all error paths
- [ ] T078 [P] Establish performance baseline in tests/performance/baseline.md: run health checks against 5 sample services (response times: 100ms, 500ms, 1s, 2s, 5s), measure health check cycle time, memory usage, and HTML generation time, document baseline measurements with timestamp and system specs (CPU cores, Node.js version), set performance test thresholds at 80% of baseline using formula: threshold = baseline × 0.8 with rounding rules (round to 2 decimal places for sub-second metrics < 1s, round to whole numbers for metrics ≥ 1s; examples: baseline 7.3s → threshold 5.84s → rounds to 6s, baseline 0.856s → threshold 0.6848s → rounds to 0.68s), rationale: 20% headroom tolerates measurement variance/noise from system load fluctuations, while catching meaningful regressions where actual performance degrades beyond 1.25x baseline (e.g., baseline 10s → threshold 8s → regression detected at >12.5s = 1.25x original), validate page load metrics meet constitution.md Principle V budgets (FCP < 1.8s, LCP < 2.5s, TTI < 3.5s, CLS < 0.1, TBT < 300ms on 3G), document rationale for 80% threshold selection and rounding rules, commit baseline.md to main branch (or feature branch if working in feature branch) for CI reference
- [ ] T079 [P] Research GitHub Pages CSP capabilities: use WebSearch to find "GitHub Pages Content-Security-Policy headers 2025", determine if GitHub Pages supports custom CSP headers, identify limitations (GitHub Pages serves static files with default headers), document findings in docs/security.md, identify CSP implementation strategy (meta tag in HTML vs HTTP headers), research CSP directives for self-contained HTML (all assets inline), cite sources per constitution.md Principle VIII. If research confirms GitHub Pages doesn't support custom HTTP CSP headers, document fallback to CSP meta tag approach (implemented in T080) as the required solution for static hosting constraints, justify 'unsafe-inline' directives as necessary for self-contained HTML architecture
- [ ] T080 [P] Add CSP meta tag to base layout in _includes/layouts/base.njk: implement `<meta http-equiv="Content-Security-Policy" content="...">` in HTML head, configure directives for self-contained HTML (default-src 'none', style-src 'unsafe-inline', script-src 'unsafe-inline', img-src data:, base-uri 'self', form-action 'none'), document rationale for 'unsafe-inline' (required for inlined CSS/JS in self-contained HTML), add nonce generation if feasible for inline scripts, reference CSP Level 3 specification
- [ ] T081 [P] Write E2E test for CSP enforcement in tests/e2e/csp-enforcement.spec.ts: use Playwright to load status page, intercept security policy violations using page.on('console') and page.on('pageerror'), verify CSP header or meta tag present, test that external resource loads are blocked (inject test script attempting external fetch, verify blocked by CSP), verify inline styles and scripts execute successfully, verify page remains functional with CSP active, test CSP reporting (if implemented) per constitution.md Principle VI security requirement
- [ ] T082 [P] Document Prometheus alerting rules in docs/monitoring.md: define alerting rules for operational response (rules require external Prometheus/AlertManager deployment, out of scope for MVP, documented for future operations teams), create monitoring.md with sections: (1) Metrics Catalog documenting each metric from FR-035 (health_checks_total, health_check_latency_seconds, services_failing) with labels and semantics, (2) Recommended Alerting Rules with PromQL expressions and thresholds (services_failing gauge > 0 for 10 minutes = "ServiceDown", health_check_latency_seconds histogram p95 > warning_threshold for 15 minutes = "ServiceDegraded", rate(health_checks_total{status="FAIL"}[5m]) > 0.05 = "HighErrorRate"), (3) Grafana Dashboard JSON for visualizing metrics (pre-built dashboard config importing metrics, showing service status overview, latency heatmaps, error rate graphs), (4) Runbook links for each alert explaining investigation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 6/7 - Deployment & CI (Phase 3)**: Depends on Foundational - Must complete before other stories are useful in production
- **User Story 1 - View Status (Phase 4)**: Depends on Foundational AND US7 - Core functionality
- **User Story 2 - Tags (Phase 5)**: Depends on US1 - Enhances status display
- **User Story 5 - Auto-refresh (Phase 6)**: Depends on US1 - Enhances UX
- **User Story 3 - Historical Data (Phase 7)**: Depends on US1 - Adds data persistence
- **User Story 4 - JSON API (Phase 8)**: Depends on US1 - Adds programmatic access
- **Technical Debt (Phase 9)**: Can proceed after MVP - Standardization and cleanup
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### Critical Path (TDD-Compliant)

1. Setup (Phase 1) → Foundational (Phase 2) → **MVP Path:**
2. US6/US7 Tests (Phase 3A) → US7 Deployment (Phase 3) → Tests PASS ✅
3. US1 Tests (Phase 4A) → US1 View Status (Phase 4) → Tests PASS ✅ = **MVP COMPLETE**
4. Add US2 Tags: Tests (5A) → Impl (5) → Tests PASS ✅
5. Add US5 Auto-refresh: Tests (6A) → Impl (6) → Tests PASS ✅
6. Add US3 Historical: Tests (7) with embedded TDD → Tests PASS ✅
7. Add US4 JSON API: Tests (8) with embedded TDD → Tests PASS ✅
8. Technical Debt (Phase 9) → Standardization
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

### MVP First (User Stories 6/7 + 1 Only) - TDD-Compliant

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T018) - CRITICAL
3. **TDD: US6/US7 Deployment**
   - Phase 3A: Write US6/US7 tests (T018a-T025a) → Tests FAIL ❌
   - Phase 3: Implement US7 (T019-T025) → Tests PASS ✅
4. **TDD: US1 View Status**
   - Phase 4A: Write US1 tests (T026a-T045a) → Tests FAIL ❌
   - Phase 4: Implement US1 (T026-T048) → Tests PASS ✅
5. Phase 10: T078 (baseline), T077 (integration test)
6. **STOP and VALIDATE**: All tests passing, 80%+ coverage achieved
7. Deploy to GitHub Pages, verify status page accessible

**This is the MINIMUM VIABLE PRODUCT** - users can view current service status with full test coverage and CI validation

**MVP = 72 tasks** (Setup + Foundation + US6/US7 Tests + US7 + US1 Tests + US1 + baseline/integration)

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

- **Total Tasks**: 128 (ADRs + implementation + tests + technical debt + security + performance + monitoring)
- **Phase 0 (ADRs)**: 5 tasks (prerequisite for all phases - architecture decisions)
- **Phase 1 (Setup)**: 7 tasks
- **Phase 2 (Foundational)**: 11 tasks (BLOCKS all user stories)
- **Phase 3A (US6/US7 Tests - TDD)**: 5 tasks (added US6 tests, write first, must fail)
- **Phase 3 (US7 Deployment - P1)**: 9 tasks (infrastructure + Lighthouse CI + Pages setup split)
- **Phase 4A (US1 Tests - TDD)**: 19 tasks (includes size validation test, write first, must fail)
- **Phase 4 (US1 View Status - P1)**: 22 tasks (includes error handling and recovery tasks)
- **Phase 5A (US2 Tests - TDD)**: 3 tasks (write first, must fail)
- **Phase 5 (US2 Tags - P2)**: 3 tasks
- **Phase 6A (US5 Tests - TDD)**: 2 tasks (write first, must fail)
- **Phase 6 (US5 Auto-refresh - P2)**: 2 tasks
- **Phase 7 (US3 Historical - P3)**: 7 tasks (4 tests + 3 implementation)
- **Phase 8 (US4 JSON API - P3)**: 8 tasks (4 tests + 4 implementation)
- **Phase 9 (Technical Debt)**: 4 tasks (terminology standardization)
- **Phase 10 (Polish)**: 17 tasks (includes T079-T082 CSP + monitoring docs)

**MVP Scope**: Phases 0-4 = 79 tasks (62% of total)
- ADRs (5) + Setup (7) + Foundational (11) + US6/US7 Tests (5) + US7 Impl (9) + US1 Tests (19) + US1 Impl (22) + Integration test (1) = 79 tasks

**Test Coverage**: 51 test tasks ensuring TDD compliance
- Unit tests: 25+ | Integration tests: 10+ | E2E tests: 12+ | Contract tests: 7+ | Accessibility tests: 1+ | Performance tests: 2+

**Parallel Opportunities**: 50+ tasks marked [P] can run in parallel within their phases

**TDD Workflow**: All test phases (3A, 4A, 5A, 6A, 7A, 8A, 9A) MUST complete and FAIL before corresponding implementation phases

**Independent Test Criteria**: Each user story phase includes checkpoint describing how to verify that story works independently

---

## Notes

- **[P] marker**: Tasks that operate on different files with no inter-task dependencies
- **[Story] label**: Maps task to specific user story (US1-US7) for traceability
- **TDD Compliance**: 47+ test tasks added per Constitution Principle III (NON-NEGOTIABLE) and spec.md FR-040a requirement
- **Test-first workflow**: All test phases MUST be written first and MUST fail before implementation
- **Test types**: Unit (25+), Integration (10+), E2E (10+), Contract (5+), Accessibility (1+), Performance (2+) = 47+ total
- **80% coverage target**: Achievable with comprehensive test suite per FR-040a requirement
- **Commit strategy**: Commit after completing each task or logical group of parallel tasks
- **Checkpoints**: Stop at phase checkpoints to validate user story works independently before proceeding
- **File paths**: All paths are exact and follow plan.md project structure
- **MVP focus**: Phases 1-4 deliver core value with full test coverage (view current service status with automated deployment)
- **Constitution compliance (8/8 = 100%)**:
  - ✅ **Test-Driven Development** via 47+ test tasks across all user stories (Constitution Principle III)
  - ✅ GDS Design System via @x-govuk/govuk-eleventy-plugin
  - ✅ Accessibility-First via WCAG 2.2 AAA validation in T039b, T076
  - ✅ Progressive Enhancement via meta refresh (no JavaScript required)
  - ✅ Performance Budgets via benchmarking in T044d, T075, T078
  - ✅ Component Quality via formal JSON Schema validation (T011-T013)
  - ✅ User Research via 13 measurable success criteria (SC-001 to SC-013)
  - ✅ Research-Driven Decisions via research.md with Context7/WebSearch/WebFetch citations

