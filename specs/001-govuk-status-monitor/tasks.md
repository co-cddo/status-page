# Tasks: GOV.UK Public Services Status Monitor

**Input**: Design documents from `/specs/001-govuk-status-monitor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: No explicit test requirements found in specification - tests are NOT included in task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Single project structure: `src/`, `tests/`, `_includes/`, `_data/`, `_site/` at repository root
- Source code in TypeScript with Node.js 22+
- Eleventy templates in Nunjucks

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Node.js 22+ project with package.json, tsconfig.json for ESM and type stripping
- [ ] T002 [P] Install core dependencies (@11ty/eleventy@^3.0.0, @x-govuk/govuk-eleventy-plugin@^4.0.0, typescript@^5.8.0)
- [ ] T003 [P] Install additional dependencies (fast-csv@^5.0.0, pino@^9.0.0, yaml for config parsing)
- [ ] T004 [P] Configure ESLint and Prettier with GDS-compatible rules
- [ ] T005 Create project structure: src/{models,services,lib,cli}, _includes/{layouts,components}, _data/, _site/
- [ ] T006 [P] Configure Eleventy config file .eleventy.js with govuk-eleventy-plugin integration
- [ ] T007 [P] Setup TypeScript configuration with Node.js 22 native type stripping support

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create Configuration model in src/models/configuration.ts with TypeScript interfaces for YAML structure
- [ ] T009 Create Service model in src/models/service.ts with runtime state properties
- [ ] T010 Create HealthCheckResult model in src/models/health-check-result.ts with status validation
- [ ] T011 Create HistoricalRecord model in src/models/historical-record.ts for CSV schema
- [ ] T012 Implement YAML configuration parser in src/lib/yaml-parser.ts with validation logic
- [ ] T013 Implement configuration validator in src/lib/config-validator.ts (checks duplicates, required fields, valid enums)
- [ ] T014 Create Pino logger instance in src/lib/logger.ts with structured JSON logging and correlation ID support
- [ ] T015 Create CSV writer wrapper in src/lib/csv-writer.ts using fast-csv with atomic append pattern
- [ ] T016 Implement HealthChecker service in src/services/health-checker.ts using native fetch with AbortSignal.timeout()
- [ ] T017 Implement concurrent health check execution in src/services/health-check-runner.ts using Promise.allSettled()
- [ ] T018 Create FileWriter service in src/services/file-writer.ts for generating _data/services.json
- [ ] T019 Create CLI entry point in src/cli/monitor.ts with graceful shutdown handling
- [ ] T020 Implement error handling framework with structured error types across all services

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Current Service Status (Priority: P1) 🎯 MVP

**Goal**: Enable users to quickly see which public services are operational and which are experiencing issues via an HTML status page

**Independent Test**: Access the generated HTML page (_site/index.html) and verify it displays a list of services with their current health status, with failed services appearing first

### Implementation for User Story 1

- [ ] T021 [P] [US1] Create base Nunjucks layout in _includes/layouts/status-page.njk using GOV.UK Design System structure
- [ ] T022 [P] [US1] Create service list component in _includes/components/service-list.njk to display services with status indicators
- [ ] T023 [P] [US1] Create service tag component in _includes/components/service-tag.njk using govukTag macro
- [ ] T024 [US1] Create Eleventy data file generator in src/services/status-generator.ts to write current status to _data/services.json
- [ ] T025 [US1] Implement service sorting logic (FAIL → DEGRADED → PASS → PENDING) in status generator
- [ ] T026 [US1] Create main status page template in src/index.md using status-page.njk layout and service-list.njk component
- [ ] T027 [US1] Add visual status indicators (GOV.UK tag components: red for FAIL, yellow for DEGRADED, green for PASS, grey for PENDING)
- [ ] T028 [US1] Display last check time and response latency for each service on status page
- [ ] T029 [US1] Integrate status page generation with health check cycle in CLI monitor
- [ ] T030 [US1] Add error handling for HTML generation failures with non-zero exit code (per FR-028a)

**Checkpoint**: At this point, User Story 1 should be fully functional - accessing the status page shows current service health with failed services first

---

## Phase 4: User Story 2 - Identify Service Categories via Tags (Priority: P2)

**Goal**: Enable users to see tags for each service displayed as labels, providing context about service categorization without requiring navigation or filtering

**Independent Test**: View the status page and confirm each service displays its associated tags as visible GOV.UK tag components; services without tags appear in a separate "Untagged Services" section

### Implementation for User Story 2

- [ ] T031 [P] [US2] Update service-list.njk component to render tags array for each service using govukTag macro
- [ ] T032 [P] [US2] Implement tag display logic in _includes/components/service-tag.njk with GOV.UK tag styling
- [ ] T033 [US2] Add "Untagged Services" section rendering in service-list.njk for services with empty tags array (per FR-024a)
- [ ] T034 [US2] Update status-page.njk layout to separate tagged and untagged services sections
- [ ] T035 [US2] Ensure tags are populated from YAML config into _data/services.json via status generator
- [ ] T036 [US2] Add visual separation between tagged services (main list) and untagged services (bottom section)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - status page displays services with their tags as visual labels

---

## Phase 5: User Story 3 - Access Historical Service Performance (Priority: P3)

**Goal**: Enable service managers and technical analysts to access historical service performance data programmatically for trend analysis and reliability assessment

**Independent Test**: Read the CSV file (history.csv) and verify it contains historical health check results with timestamp, service_name, status, latency_ms, http_status_code, failure_reason, and correlation_id columns

### Implementation for User Story 3

- [ ] T037 [P] [US3] Create CSV history writer service in src/services/history-writer.ts using CsvWriter from csv-writer lib
- [ ] T038 [P] [US3] Define CSV schema structure (timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id) in HistoricalRecord model
- [ ] T039 [US3] Integrate CSV append operation into health check cycle - write each HealthCheckResult to history.csv
- [ ] T040 [US3] Implement CSV file initialization with headers if file doesn't exist
- [ ] T041 [US3] Add correlation ID generation (UUID) to health check execution for log traceability (per FR-036)
- [ ] T042 [US3] Implement CSV write error handling with process exit on failure (per FR-020a)
- [ ] T043 [US3] Add structured logging for CSV write operations with correlation ID

**Checkpoint**: All historical health checks are now persisted to CSV file, enabling programmatic access for trend analysis

---

## Phase 6: User Story 4 - Consume Service Status via API (Priority: P3)

**Goal**: Enable developers and automated systems to access current service status data in machine-readable JSON format for integration with other applications

**Independent Test**: Make an HTTP GET request to /api/status.json and verify it returns structured status data matching the OpenAPI schema (array of ServiceStatus objects)

### Implementation for User Story 4

- [ ] T044 [P] [US4] Create JSON API generator service in src/services/json-api-generator.ts to write _site/api/status.json
- [ ] T045 [P] [US4] Define JSON schema structure in src/models/service-status-api.ts matching OpenAPI specification
- [ ] T046 [US4] Implement JSON file generation in status generator - write current status array to _site/api/status.json
- [ ] T047 [US4] Ensure JSON output matches OpenAPI schema structure (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason)
- [ ] T048 [US4] Add JSON generation to health check cycle - synchronize with HTML generation (per FR-028)
- [ ] T049 [US4] Implement JSON write error handling with process exit on failure (per FR-028a)
- [ ] T050 [US4] Ensure JSON and HTML contain identical current status information (per acceptance scenario 3)

**Checkpoint**: JSON API endpoint is now functional, providing programmatic access to current service status

---

## Phase 7: User Story 5 - Automatic Status Updates (Priority: P2)

**Goal**: Enable users monitoring service status during an incident to see updates automatically without manually reloading the page

**Independent Test**: Open the status page and observe it update automatically after the configured refresh interval (60 seconds default) without user interaction

### Implementation for User Story 5

- [ ] T051 [P] [US5] Add meta refresh tag to status-page.njk layout with page_refresh interval from config (default 60 seconds)
- [ ] T052 [P] [US5] Implement optional JavaScript auto-refresh enhancement in _includes/components/auto-refresh.js using setTimeout
- [ ] T053 [US5] Add last update timestamp display in status-page.njk layout to show when status was last refreshed
- [ ] T054 [US5] Ensure meta refresh fallback works when JavaScript is disabled (progressive enhancement per constitution)
- [ ] T055 [US5] Add visual indication of last update time with GOV.UK Design System typography
- [ ] T056 [US5] Configure page_refresh interval from YAML config settings (default 60 seconds per FR-029)

**Checkpoint**: Status page now auto-refreshes at configured interval, improving user experience during incident monitoring

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Add WCAG 2.2 AAA accessibility enhancements: enhanced contrast ratios (7:1 for normal text), comprehensive ARIA labels
- [ ] T058 [P] Implement keyboard navigation testing and focus indicators across all GOV.UK components
- [ ] T059 [P] Add graceful shutdown handling in CLI to complete in-flight health checks before exit (per FR-032)
- [ ] T060 [P] Implement worker pool with priority queue scheduling (2x CPU cores) for concurrent health checks (per FR-009a)
- [ ] T061 [P] Add two-threshold model for DEGRADED status: warning_threshold (2s default) and timeout (5s default) per FR-015b, FR-017a
- [ ] T062 [P] Implement 2 consecutive check cycle failures requirement for HTML display (per FR-015a)
- [ ] T063 [P] Add response body text validation (first 100KB only) per FR-014
- [ ] T064 [P] Add response header validation for redirect checks (Location header) per FR-014a, FR-004a
- [ ] T065 [P] Implement POST request support with JSON payload per FR-006, FR-011
- [ ] T066 [P] Add custom HTTP headers support per service configuration (per FR-005, FR-010)
- [ ] T067 [P] Implement metrics telemetry buffering with memory limit (per FR-035a, FR-035b)
- [ ] T068 [P] Add verbose debug logging controlled by DEBUG environment variable (per FR-034)
- [ ] T069 [P] Add security warnings for debug mode logging sensitive data (per FR-034a)
- [ ] T070 [P] Implement configuration hot-reload blocker - require manual restart (per FR-032)
- [ ] T071 [P] Add removed service handling - preserve CSV data, remove from HTML/JSON (per FR-007b)
- [ ] T072 [P] Update quickstart.md with final installation, configuration, and testing instructions
- [ ] T073 Code review and refactoring for clarity and maintainability
- [ ] T074 Performance optimization: verify page load <2s, FCP <1.8s, LCP <2.5s (per constitution and SC-003)
- [ ] T075 Security audit: dependency scanning, log redaction, HTTPS-only validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P3 → P2)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - View Current Service Status**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2) - Identify Service Categories via Tags**: Depends on User Story 1 (builds on status page rendering) - SEQUENTIAL
- **User Story 3 (P3) - Access Historical Service Performance**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)
- **User Story 4 (P3) - Consume Service Status via API**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)
- **User Story 5 (P2) - Automatic Status Updates**: Depends on User Story 1 (enhances status page) - SEQUENTIAL

### Within Each User Story

- Models before services (Foundational phase handles core models)
- Services before templates (status generator before Nunjucks templates)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T006, T007 can run in parallel (different files)
- **Phase 2**: All tasks are sequential due to dependencies (models → services → CLI)
- **Phase 3 (US1)**: T021, T022, T023 can run in parallel (different component files)
- **Phase 4 (US2)**: T031, T032 can run in parallel (different component files)
- **Phase 5 (US3)**: T037, T038 can run in parallel (different files)
- **Phase 6 (US4)**: T044, T045 can run in parallel (different files)
- **Phase 7 (US5)**: T051, T052 can run in parallel (different files)
- **Phase 8**: Most polish tasks (T057-T071) can run in parallel as they affect different concerns

**User Story Parallelization**: After Foundational (Phase 2), US3 and US4 can be developed in parallel as they are independent. US1, US2, and US5 must be sequential due to template dependencies.

---

## Parallel Example: Foundational Phase

```bash
# After models are complete (T008-T011), launch services in parallel:
# (Note: These have dependencies on models, so they run AFTER model tasks)
Task: "Implement HealthChecker service in src/services/health-checker.ts"
Task: "Implement FileWriter service in src/services/file-writer.ts"
```

## Parallel Example: User Story 1

```bash
# Launch all component templates for User Story 1 together:
Task: "Create base Nunjucks layout in _includes/layouts/status-page.njk"
Task: "Create service list component in _includes/components/service-list.njk"
Task: "Create service tag component in _includes/components/service-tag.njk"
```

## Parallel Example: Independent User Stories

```bash
# After Foundational phase completes, launch US3 and US4 in parallel:
Developer A: User Story 3 (Historical CSV data)
Developer B: User Story 4 (JSON API endpoint)
# Both are independent and don't conflict
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - View Current Service Status
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Access status page
   - Verify services display with health status
   - Confirm failed services appear first
   - Check GOV.UK Design System compliance
5. Deploy/demo if ready - **MVP is functional!**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (adds tag labels)
4. Add User Story 3 → Test independently → Deploy/Demo (adds CSV historical data)
5. Add User Story 4 → Test independently → Deploy/Demo (adds JSON API)
6. Add User Story 5 → Test independently → Deploy/Demo (adds auto-refresh)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (status page) → blocks US2 and US5
   - Developer B: User Story 3 (CSV history) - can start immediately
   - Developer C: User Story 4 (JSON API) - can start immediately
3. After US1 completes:
   - Developer A continues: User Story 2 (tags)
   - Developer B continues: User Story 5 (auto-refresh)
4. Stories complete and integrate independently

---

## Summary

**Total Tasks**: 75 tasks
**Task Distribution**:
- Setup (Phase 1): 7 tasks
- Foundational (Phase 2): 13 tasks
- User Story 1 (Phase 3): 10 tasks
- User Story 2 (Phase 4): 6 tasks
- User Story 3 (Phase 5): 7 tasks
- User Story 4 (Phase 6): 7 tasks
- User Story 5 (Phase 7): 6 tasks
- Polish (Phase 8): 19 tasks

**Parallel Opportunities**: 23 tasks marked [P] can run in parallel
**Independent Stories**: US3 (Historical Performance) and US4 (JSON API) are fully independent
**Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1) = 30 tasks

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, labels, file paths)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are NOT included (no explicit test requirements in specification)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Configuration validation fails startup with detailed errors (per FR-007)
- CSV/JSON generation failures exit with non-zero code (per FR-020a, FR-028a)
