# Tasks: GOV.UK Public Services Status Monitor

**Input**: Design documents from `/specs/001-govuk-status-monitor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested in feature specification - tests are EXCLUDED from this task list per TDD constitution guidance

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

## Phase 5: User Story 2 - Identify Service Categories via Tags (Priority: P2)

**Goal**: Enable users to understand service categorization through visible tag labels

**Independent Test**: View status page, see tags displayed as labels next to each service, identify related services by tag, see untagged services in separate section

### Implementation for User Story 2

- [ ] T045 [P] [US2] Create status tags component in _includes/components/status-tags.njk: render GOV.UK tag components for each service tag, use govukTag macro from Design System, display multiple tags per service per FR-024, FR-025
- [ ] T046 [US2] Update status page template in pages/index.njk: add status-tags component to each service display, group services (failing → degraded → healthy → untagged section at bottom), untagged section heading "Untagged Services" per FR-024a
- [ ] T047 [US2] Update JSON writer in src/storage/json-writer.ts: include tags array in ServiceStatusAPI output, empty array for services without tags per FR-022

**Checkpoint**: At this point, User Stories 1 AND 2 work - users see categorized services with visual tag labels

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

## Phase 7: User Story 3 - Access Historical Service Performance (Priority: P3)

**Goal**: Enable programmatic access to historical performance data for trend analysis

**Independent Test**: Read history.csv file, access historical health check results, calculate uptime percentages, identify outage patterns

### Implementation for User Story 3

- [ ] T050 [P] [US3] Implement GitHub Actions cache manager in src/storage/cache-manager.ts: restore CSV from Actions cache (primary), fetch from GitHub Pages if cache miss, validate restored CSV format, log errors and fall through to next tier if corrupted, create new CSV only if both tiers fail (first run), fail immediately on cache limit or network errors per FR-020b, FR-020c, FR-020d, FR-020e
- [ ] T051 [US3] Update deploy workflow in .github/workflows/deploy.yml: use cache-manager to restore CSV at workflow start, append new results, save to cache, include in GitHub Pages deployment per FR-020b
- [ ] T052 [US3] Create CSV documentation in docs/historical-data.md: CSV format specification, uptime calculation examples, manual rotation guidance, cache limit troubleshooting per SC-008

**Checkpoint**: User Stories 1, 2, 3, AND 5 work - historical data persists and is accessible

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

### Critical Path

1. Setup (Phase 1) → Foundational (Phase 2) → US7 Deployment (Phase 3) → US1 View Status (Phase 4) = **MVP**
2. Add US2 Tags (Phase 5) → enhances US1
3. Add US5 Auto-refresh (Phase 6) → enhances US1
4. Add US3 Historical (Phase 7) → adds persistence
5. Add US4 JSON API (Phase 8) → adds programmatic access
6. Add US6 Config Validation (Phase 9) → enhances CI/CD
7. Polish (Phase 10) → production ready

### Within Each User Story

- Foundation tasks (types, config, logging) before business logic
- HTTP health checks before worker pool
- Storage writers before orchestrator
- Orchestrator components before 11ty templates
- Templates before asset inlining
- All tasks within a phase before moving to next phase

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

### MVP First (User Stories 7 + 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T018) - CRITICAL
3. Complete Phase 3: US7 Deployment (T019-T025) - Infrastructure
4. Complete Phase 4: US1 View Status (T026-T044) - Core functionality
5. **STOP and VALIDATE**: Test full cycle (health checks → CSV → HTML → deployment)
6. Deploy to GitHub Pages, verify status page accessible

**This is the MINIMUM VIABLE PRODUCT** - users can view current service status

### Incremental Delivery

1. MVP: Setup + Foundational + US7 + US1 → Deploy
2. Add US2 Tags → Test independently → Deploy (categorized services)
3. Add US5 Auto-refresh → Test independently → Deploy (better UX)
4. Add US3 Historical → Test independently → Deploy (trend analysis)
5. Add US4 JSON API → Test independently → Deploy (programmatic access)
6. Add US6 Config Validation → Test independently → Deploy (safer config changes)
7. Polish (Phase 10) → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T018)
2. Team completes US7 Deployment together (T019-T025)
3. Team completes US1 View Status together (T026-T044) - too many interdependencies for parallel work
4. Once US1 complete, parallelize:
   - Developer A: US2 Tags (T045-T047)
   - Developer B: US3 Historical (T050-T052)
   - Developer C: US4 JSON API (T053-T055)
   - Developer D: US5 Auto-refresh (T048-T049) + US6 Config Validation (T056-T058)
5. Team completes Polish together (T059-T070)

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

- **Total Tasks**: 70
- **Phase 1 (Setup)**: 7 tasks
- **Phase 2 (Foundational)**: 11 tasks (BLOCKS all user stories)
- **Phase 3 (US7 Deployment - P1)**: 7 tasks (infrastructure)
- **Phase 4 (US1 View Status - P1)**: 19 tasks (MVP)
- **Phase 5 (US2 Tags - P2)**: 3 tasks
- **Phase 6 (US5 Auto-refresh - P2)**: 2 tasks
- **Phase 7 (US3 Historical - P3)**: 3 tasks
- **Phase 8 (US4 JSON API - P3)**: 3 tasks
- **Phase 9 (US6 Config Validation - P2)**: 3 tasks
- **Phase 10 (Polish)**: 12 tasks

**MVP Scope**: Phases 1-4 = 44 tasks (63% of total)

**Parallel Opportunities**: 27 tasks marked [P] can run in parallel within their phases

**Independent Test Criteria**: Each user story phase includes checkpoint describing how to verify that story works independently

---

## Notes

- **[P] marker**: Tasks that operate on different files with no inter-task dependencies
- **[Story] label**: Maps task to specific user story (US1-US7) for traceability
- **Tests excluded**: Not explicitly requested in feature specification - can be added later following TDD principles
- **Commit strategy**: Commit after completing each task or logical group of parallel tasks
- **Checkpoints**: Stop at phase checkpoints to validate user story works independently before proceeding
- **File paths**: All paths are exact and follow plan.md project structure
- **MVP focus**: Phases 1-4 deliver core value (view current service status with automated deployment)
- **Constitution compliance**:
  - ✅ GDS Design System via @x-govuk/govuk-eleventy-plugin
  - ✅ Accessibility-First via WCAG 2.2 AAA validation in T069
  - ✅ Progressive Enhancement via meta refresh (no JavaScript required)
  - ✅ Performance Budgets via benchmarking in T068
  - ✅ Component Quality via formal JSON Schema validation (T011-T013)

