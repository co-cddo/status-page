# Implementation Plan: GOV.UK Public Services Status Monitor

**Branch**: `001-govuk-status-monitor` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-govuk-status-monitor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a self-contained status monitoring application that performs periodic HTTP(S) health checks against configured public services and generates static HTML/JSON assets compliant with GOV.UK Design System. The application uses a hybrid orchestrator architecture where a Node.js/TypeScript process (run via tsx) orchestrates health checks via worker threads, writes results to _data/health.json, then invokes 11ty CLI to regenerate static assets. Generated HTML is self-contained (all CSS/JS/images inlined via post-build processing) and deployed to GitHub Pages every 5 minutes. Historical health data persists in CSV format with GitHub Actions cache as primary storage and GitHub Pages as fallback.

## Technical Context

**Language/Version**: TypeScript with Node.js 22+ (run via tsx, no compilation)
**Primary Dependencies**:
- 11ty (Eleventy) v3+ static site generator
- @x-govuk/govuk-eleventy-plugin for GOV.UK Design System integration
- tsx for running TypeScript without compilation
- worker_threads (built-in Node.js) for concurrent health check execution
- prom-client for Prometheus metrics
- js-yaml for configuration parsing
- Ajv for JSON Schema validation
- uuid for correlation ID generation

**Storage**:
- CSV files for historical health check data (GitHub Actions cache + GitHub Pages fallback)
- _data/health.json for 11ty data source (ephemeral, regenerated each cycle)
- config.yaml for service configuration (version controlled)

**Testing**:
- Vitest for unit tests (native ESM, TypeScript integration)
- Playwright for e2e and accessibility tests (axe-core integration for WCAG 2.2 AAA)
- npm test runs all suites: unit, e2e, accessibility, coverage (80% min), performance (benchmarked thresholds)

**Target Platform**:
- Node.js 22+ runtime (GitHub Actions runners for scheduled execution)
- GitHub Pages for static HTML/JSON hosting
- Prometheus for metrics scraping (port 9090)

**Project Type**: Single Node.js application (hybrid orchestrator)

**Performance Goals**:
- Status page loads in < 2 seconds on standard government network connections (SC-003)
- 95% of health checks complete within configured timeout under normal conditions (SC-004)
- HTML generation completes within benchmarked thresholds (measured during development)
- Self-contained HTML file < 5MB after asset inlining

**Constraints**:
- WCAG 2.2 AAA accessibility compliance (SC-007)
- Single HTTP request per page load (zero external dependencies after asset inlining)
- GitHub Actions cache limits (10GB per repository, 7-day eviction)
- GitHub Pages file size limits for deployment artifacts
- 80% code coverage minimum (both branch and line coverage)
- Worker pool sized to 2x CPU cores for concurrent health checks

**Scale/Scope**:
- Monitor < 100 services initially (allowing file-based CSV storage)
- Health check cycle every 60 seconds (default, configurable per-service)
- Scheduled GitHub Actions deployment every 5 minutes
- CSV historical data with manual rotation/archival

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. GDS Design System Compliance ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - Using 11ty GOV.UK plugin (@x-govuk/govuk-eleventy-plugin) which provides GOV.UK Frontend toolkit integration
  - Page title "GOV.UK service status" follows GDS guidance for services not yet on gov.uk domain
  - Using GOV.UK Design System tag components for service categorization
  - Following GOV.UK Design System guidance for services not hosted on gov.uk domain (no Crown logo/official branding until on gov.uk)
  - Component usage documented in FR-021, FR-025

### II. Accessibility-First Development ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - WCAG 2.2 AAA standard explicitly specified (FR-029a)
  - Automated accessibility testing: Playwright with axe-core integration
  - Meta refresh tag for auto-refresh ensures JavaScript-free accessibility
  - Enhanced color contrast ratios: 7:1 for normal text, 4.5:1 for large text
  - Comprehensive ARIA labels and landmarks, keyboard navigation support
  - Screen reader compatibility, clear focus indicators
  - No reliance on color alone for conveying information

### III. Test-Driven Development ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - npm test executes all test suites: unit, e2e, accessibility, coverage, performance (FR-040a)
  - 80% minimum coverage for both branch and line coverage (enforced, test fails if below threshold)
  - Tests run in CI/CD pipeline; failing tests block merges (FR-041)
  - Vitest for unit tests (TDD-friendly, fast feedback)
  - Playwright for e2e tests validating complete user journeys (User Stories 1-7)
  - Accessibility tests integrated via axe-core in Playwright

### IV. Progressive Enhancement ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - HTML page auto-refreshes using meta refresh tag (works without JavaScript) - FR-029
  - Static HTML generation (no client-side routing required)
  - Server-side rendered (11ty generates complete, functional HTML)
  - Self-contained HTML with inlined assets (works offline after initial load)
  - No JavaScript required for core functionality (viewing status)
  - Core content accessible with HTML and CSS only

### V. Performance Budgets ✅ PASS
- **Status**: Compliant (with monitoring)
- **Evidence**:
  - SC-003: Status page loads in < 2 seconds (target)
  - Self-contained HTML file < 5MB target (FR-021, Assumption)
  - Single HTTP request architecture minimizes network overhead
  - Performance tests validate benchmarked thresholds (FR-040a)
  - GitHub Pages CDN provides edge caching
- **Note**: Lighthouse CI should be added to pipeline to enforce performance budgets automatically (considered for constitution compliance)

### VI. Component Quality Standards ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - Formal JSON Schema validation for config.yaml (FR-001, detailed error reporting)
  - Security best practices researched for GitHub Actions workflows (FR-037a)
  - Explicit least-privilege permissions in workflows
  - No secrets in code (environment variables: DEBUG, PROMETHEUS_PORT, METRICS_BUFFER_SIZE)
  - Code review required before merge (FR-041: main branch protection)
  - Dependabot for automated dependency updates
  - Structured logging with correlation IDs for traceability (FR-033)

### VII. User Research & Data-Driven Decisions ✅ PASS
- **Status**: Compliant
- **Evidence**:
  - 13 measurable success criteria defined (SC-001 through SC-013)
  - User Stories 1-7 with specific acceptance scenarios
  - Performance benchmarking approach: measure baseline, set aggressive thresholds, adjust frequently based on data
  - Prometheus metrics telemetry for operational monitoring (FR-035)
  - CSV historical data enables uptime percentage calculations (SC-008)

### Gate Result: ✅ ALL GATES PASS - PROCEED TO PHASE 0

No constitution violations. All principles satisfied by specification design.

## Project Structure

### Documentation (this feature)

```
specs/001-govuk-status-monitor/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (next step)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Single Node.js application (hybrid orchestrator architecture)

# Project Root
/
├── eleventy.config.js        # 11ty configuration (GOV.UK plugin setup)
├── config.yaml               # Service health check configuration (fixed path)
├── package.json              # npm dependencies and scripts
├── tsconfig.json             # TypeScript configuration for tsx
├── .gitignore
├── README.md
└── LICENSE

# Source Code
src/
├── index.ts                  # Main entry point (orchestrator)
├── orchestrator/
│   ├── scheduler.ts          # Health check scheduling (setInterval logic)
│   ├── worker-pool.ts        # Worker thread pool management
│   └── eleventy-runner.ts    # 11ty CLI subprocess invocation
├── health-checks/
│   ├── worker.ts             # Worker thread implementation
│   ├── http-check.ts         # HTTP(S) health check logic (fetch API)
│   ├── retry-logic.ts        # Retry for network errors (max 3, immediate)
│   └── validation.ts         # Status code, text, header validation
├── storage/
│   ├── csv-writer.ts         # CSV append operations (history.csv)
│   ├── csv-reader.ts         # CSV validation and consecutive failure derivation
│   ├── json-writer.ts        # _data/health.json writer (11ty data source)
│   └── cache-manager.ts      # GitHub Actions cache fallback logic
├── config/
│   ├── loader.ts             # config.yaml loading (js-yaml)
│   ├── schema.ts             # JSON Schema definition (Ajv validation)
│   └── validator.ts          # Service name/tag validation (ASCII, length)
├── metrics/
│   ├── prometheus.ts         # Prometheus metrics setup (prom-client)
│   └── buffer.ts             # Metrics buffering (1000 entry limit)
├── logging/
│   ├── logger.ts             # Structured JSON logging (correlation IDs)
│   └── correlation.ts        # UUID v4 generation
├── inlining/
│   ├── post-build.ts         # Post-build asset inlining script
│   ├── css-inliner.ts        # Inline CSS into <style> tags
│   ├── js-inliner.ts         # Inline JavaScript into <script> tags
│   └── image-inliner.ts      # Base64 encode images as data URIs
└── types/
    ├── config.ts             # TypeScript types for config.yaml structure
    ├── health-check.ts       # TypeScript types for health check results
    └── worker-message.ts     # TypeScript types for worker thread messages

# 11ty Source (HTML generation)
_includes/
├── layouts/
│   └── base.njk              # Base layout using GOV.UK plugin layouts
├── components/
│   ├── service-status.njk    # Service status display component
│   └── status-tags.njk       # GOV.UK tag components for service tags
└── macros/
    └── status-indicator.njk  # Visual status indicators (healthy/degraded/failed/pending)

_data/
└── health.json               # Generated by orchestrator (ephemeral, health check results)

pages/
└── index.njk                 # Main status page template (reads _data/health.json)

# Build Output (generated by 11ty)
_site/ or dist/               # Configurable output directory
├── index.html                # Generated HTML with external asset references (pre-inlining)
├── status.json               # Current status API
└── history.csv               # Historical data (from src via orchestrator)

# Final Output (after post-build inlining)
output/
├── index.html                # Self-contained HTML (all assets inlined)
├── status.json               # Current status API (unchanged)
├── history.csv               # Historical data (unchanged)
├── favicon.ico               # Optional
└── robots.txt                # Optional

# Tests
tests/
├── unit/
│   ├── health-checks/
│   │   ├── http-check.test.ts
│   │   ├── retry-logic.test.ts
│   │   └── validation.test.ts
│   ├── storage/
│   │   ├── csv-writer.test.ts
│   │   ├── csv-reader.test.ts
│   │   └── json-writer.test.ts
│   ├── config/
│   │   ├── loader.test.ts
│   │   ├── schema.test.ts
│   │   └── validator.test.ts
│   ├── metrics/
│   │   ├── prometheus.test.ts
│   │   └── buffer.test.ts
│   ├── logging/
│   │   ├── logger.test.ts
│   │   └── correlation.test.ts
│   └── inlining/
│       ├── css-inliner.test.ts
│       ├── js-inliner.test.ts
│       └── image-inliner.test.ts
├── integration/
│   ├── orchestrator/
│   │   ├── scheduler.test.ts
│   │   ├── worker-pool.test.ts
│   │   └── eleventy-runner.test.ts
│   ├── end-to-end-cycle.test.ts      # Full health check → CSV → 11ty → inlining cycle
│   └── github-actions-cache.test.ts  # CSV fallback logic integration
├── e2e/
│   ├── status-page.spec.ts           # User Story 1: View current service status
│   ├── service-tags.spec.ts          # User Story 2: Identify service categories
│   ├── historical-data.spec.ts       # User Story 3: Access historical performance
│   ├── json-api.spec.ts              # User Story 4: Consume status via API
│   ├── auto-refresh.spec.ts          # User Story 5: Automatic status updates (meta refresh)
│   ├── config-validation.spec.ts     # User Story 6: Configuration change validation via CI
│   └── deployment.spec.ts            # User Story 7: Automated status page deployment
├── accessibility/
│   ├── wcag-aaa.spec.ts              # WCAG 2.2 AAA compliance (axe-core)
│   ├── keyboard-navigation.spec.ts   # Keyboard-only navigation
│   ├── screen-reader.spec.ts         # Screen reader compatibility
│   └── contrast.spec.ts              # Enhanced color contrast ratios (7:1, 4.5:1)
├── performance/
│   ├── page-load.spec.ts             # SC-003: < 2 seconds page load
│   ├── health-check-cycle.spec.ts    # Benchmarked health check cycle time
│   ├── html-generation.spec.ts       # Benchmarked HTML generation time
│   └── memory-usage.spec.ts          # Benchmarked memory usage
└── contract/
    ├── status-json.test.ts           # status.json API contract validation
    ├── history-csv.test.ts           # history.csv format validation
    └── prometheus-metrics.test.ts    # Prometheus metrics contract validation

# GitHub Actions Workflows
.github/
└── workflows/
    ├── test.yml                      # Run tests on PR (application tests or smoke tests)
    ├── smoke-test.yml                # Config.yaml PR smoke tests with comment posting
    ├── deploy.yml                    # Scheduled deployment (every 5 minutes)
    └── dependency-update.yml         # Dependabot PR handling
```

**Structure Decision**: Single Node.js application with hybrid orchestrator architecture. Separates concerns between runtime health checking (Node.js orchestrator in src/), build-time HTML generation (11ty in _includes/, _data/, pages/), and post-build asset inlining (src/inlining/). No backend/frontend split needed as this is a static site generation workflow. Tests organized by type (unit, integration, e2e, accessibility, performance, contract) following TDD requirements from constitution.

## Complexity Tracking

*No constitution violations requiring justification.*

## Phase 0: Research & Technical Decisions

Research tasks to be dispatched:
1. 11ty GOV.UK plugin configuration best practices
2. Worker threads message passing patterns for health check results
3. CSV format design for consecutive failure tracking
4. Post-build asset inlining implementation approach
5. GitHub Actions artifact-based deployment workflow
6. Prometheus metrics cardinality management best practices

**Status**: Research tasks ready for dispatch. Proceeding to research.md generation.
