# Task Breakdown: GOV.UK Public Services Status Monitor

This document breaks down the implementation of the GOV.UK Public Services Status Monitor into actionable tasks, organized by development phase and user story.

## Phase 1: Project Setup

**Goal**: Initialize the project structure, install dependencies, and create basic configuration files.

- [ ] T001 Create the project directory structure as defined in `plan.md`.
- [ ] T002 Initialize a new Node.js project with `pnpm init`.
- [ ] T003 Install all primary and development dependencies listed in `plan.md` using `pnpm install`.
- [ ] T004 Create the `eleventy.config.js` file and add basic configuration for the 11ty GOV.UK plugin.
- [ ] T005 Create the `tsconfig.json` file with settings for `tsx` and Node.js 22+.
- [ ] T006 Create a placeholder `config.yaml` in the root directory.

## Phase 2: Foundational Implementation

**Goal**: Implement core, non-functional components that are prerequisites for all user stories.

- [ ] T007 [P] Implement the logging service in `src/logging/logger.ts` and `src/logging/correlation.ts`.
- [ ] T008 [P] Implement the configuration loader and validator in `src/config/`, including schema validation with Ajv.
- [ ] T009 Implement the basic orchestrator entry point in `src/index.ts` that loads the configuration.

## Phase 3: [US7] Automated Status Page Deployment (P1)

**Goal**: Implement the core health checking and automated deployment pipeline.

- [ ] T010 [US7] Implement the health check scheduler in `src/orchestrator/scheduler.ts`.
- [ ] T011 [US7] Implement the worker pool management in `src/orchestrator/worker-pool.ts`.
- [ ] T012 [US7] Implement the health check worker in `src/health-checks/worker.ts`.
- [ ] T013 [US7] Implement the HTTP health check logic in `src/health-checks/http-check.ts`.
- [ ] T014 [US7] Implement the CSV writer in `src/storage/csv-writer.ts`.
- [ ] T015 [US7] Implement the JSON writer in `src/storage/json-writer.ts`.
- [ ] T016 [US7] Implement the 11ty runner in `src/orchestrator/eleventy-runner.ts`.
- [ ] T017 [US7] Create basic 11ty templates in `pages/index.njk` and `_includes/layouts/base.njk`.
- [ ] T018 [US7] Create the scheduled deployment workflow in `.github/workflows/deploy.yml`.

## Phase 4: [US1] View Current Service Status (P1)

**Goal**: Display the current status of all monitored services on a static HTML page.

- [ ] T019 [US1] Implement the main status page template in `pages/index.njk` to display services from `_data/health.json`.
- [ ] T020 [US1] Create the service status component in `_includes/components/service-status.njk`.
- [ ] T021 [US1] Create the status indicator macro in `_includes/macros/status-indicator.njk`.
- [ ] T022 [US1] Implement the post-build asset inlining script in `src/inlining/post-build.ts`.
- [ ] T023 [US1] Write e2e tests for the status page in `tests/e2e/status-page.spec.ts`.

## Phase 5: [US2] Identify Service Categories via Tags (P2)

**Goal**: Display service category tags on the status page.

- [ ] T024 [US2] Create the status tags component in `_includes/components/status-tags.njk`.
- [ ] T025 [US2] Update the service status component to display tags.
- [ ] T026 [US2] Write e2e tests for service tags in `tests/e2e/service-tags.spec.ts`.

## Phase 6: [US5] Automatic Status Updates (P2)

**Goal**: Ensure the status page automatically refreshes.

- [ ] T027 [US5] Add the meta refresh tag to the base layout in `_includes/layouts/base.njk`.
- [ ] T028 [US5] Write e2e tests for auto-refresh in `tests/e2e/auto-refresh.spec.ts`.

## Phase 7: [US6] Configuration Change Validation via CI (P2)

**Goal**: Implement a smoke test workflow for configuration changes.

- [ ] T029 [US6] Create the smoke test workflow in `.github/workflows/smoke-test.yml`.
- [ ] T030 [US6] Write e2e tests for config validation in `tests/e2e/config-validation.spec.ts`.

## Phase 8: [US3] Access Historical Service Performance (P3)

**Goal**: Enable access to historical data via the CSV file.

- [ ] T031 [US3] Implement the CSV reader in `src/storage/csv-reader.ts` for consecutive failure tracking.
- [ ] T032 [US3] Write contract tests for the `history.csv` format in `tests/contract/history-csv.test.ts`.

## Phase 9: [US4] Consume Service Status via API (P3)

**Goal**: Ensure the JSON API is available and correct.

- [ ] T033 [US4] Write contract tests for the `status.json` API in `tests/contract/status-json.test.ts`.

## Phase 10: Polish & Cross-cutting Concerns

**Goal**: Implement remaining features and tests.

- [ ] T034 [P] Implement Prometheus metrics in `src/metrics/prometheus.ts`.
- [ ] T035 [P] Implement graceful shutdown logic in the orchestrator.
- [ ] T036 [P] Write all remaining unit tests for `health-checks`, `storage`, `config`, `metrics`, `logging`, and `inlining`.
- [ ] T037 [P] Write all remaining integration tests for the orchestrator and end-to-end cycle.
- [ ] T038 [P] Write all remaining accessibility and performance tests.
- [ ] T039 Create a comprehensive `README.md` for the project.

## Dependencies

- **US1** depends on **US7**
- **US2** depends on **US1**
- **US3** depends on **US7**
- **US4** depends on **US7**
- **US5** depends on **US1**
- **US6** depends on **US7**

## Parallel Execution Examples

- Within Phase 3, tasks T010-T017 can be worked on in parallel to a large extent, as they represent different modules of the core application.
- Within Phase 10, tasks T034-T038 are all independent and can be executed in parallel.

## Implementation Strategy

The implementation will follow an MVP-first approach, focusing on delivering User Story 7 and User Story 1 as the highest priority to get a functional end-to-end system. Subsequent user stories will be implemented as incremental additions to this baseline.
