# Implementation Plan: GOV.UK Public Services Status Monitor

**Branch**: `001-govuk-status-monitor` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-govuk-status-monitor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a GOV.UK Design System-compliant static site generator for monitoring public service health status. The system performs HTTP(S) health checks against configured service endpoints, generates static HTML pages and JSON APIs showing current status, and stores historical performance data in CSV format. The application uses TypeScript with 11ty (Eleventy) static site generator and the govuk-eleventy-plugin to produce GOV.UK-styled status pages that meet WCAG 2.2 AAA accessibility standards.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 22+
**Primary Dependencies**:
- **11ty (Eleventy) v3+**: Static site generator core
- **govuk-eleventy-plugin**: GOV.UK Design System integration
- **GOV.UK Frontend Toolkit**: Component library for GDS compliance
- **node-fetch or axios**: HTTP client for health check probes
- **yaml**: YAML configuration parsing
- **csv-writer**: CSV file generation for historical data

**Storage**: File-based (CSV for historical data, static HTML/JSON for current status)
**Testing**: Jest (unit/integration tests), Playwright or Cypress (E2E), axe-core & Pa11y (accessibility)
**Target Platform**: Linux server (background service generating static assets)
**Project Type**: Single project (static site generator + background health check service)
**Performance Goals**:
- Generate status page in <1 second per check cycle
- Support monitoring 100+ services concurrently
- Status page load time <2 seconds (see spec SC-003)
- 95% of health checks complete within timeout (see spec SC-004)

**Constraints**:
- WCAG 2.2 AAA accessibility compliance (non-negotiable per constitution)
- GOV.UK Design System strict adherence (non-negotiable per constitution)
- Progressive enhancement (must work without JavaScript per constitution)
- Performance budgets: HTML <14KB, CSS <50KB, JS <100KB compressed (constitution)
- First Contentful Paint <1.8s, Largest Contentful Paint <2.5s (constitution)

**Scale/Scope**:
- Initial deployment: 50-100 monitored services
- Designed for extensibility to database-backed storage
- CSV file-based historical data with manual rotation
- Single-process monitoring with thread pool (2x CPU cores)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. GDS Design System Compliance ✅ PASS

- **Requirement**: All user-facing components must adhere to GOV.UK Design System
- **Status**: COMPLIANT - Feature spec explicitly requires GOV.UK Design System compliance (FR-021, FR-025), using govuk-eleventy-plugin for component integration
- **Implementation**:
  - Use govuk-eleventy-plugin to ensure GDS component patterns
  - Leverage GOV.UK Frontend tag components for service categorization (FR-025)
  - Follow GDS typography, spacing, color schemes through plugin defaults
  - Status page uses standard GDS layouts and patterns (notification banners, tables, summary lists per spec assumptions)

### II. Accessibility-First Development ✅ PASS

- **Requirement**: Meet WCAG 2.2 Level AA minimum, AAA as target
- **Status**: COMPLIANT - Feature spec explicitly requires WCAG 2.2 AAA (FR-029a, SC-007)
- **Implementation**:
  - Enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text) per FR-029a
  - Comprehensive ARIA labels and landmarks per FR-029a
  - Keyboard navigation support per FR-029a
  - Screen reader compatibility testing required per FR-029a
  - Automated accessibility tests (axe-core, Pa11y) in testing strategy
  - Clear focus indicators per FR-029a
  - No color-only information conveying per FR-029a

### III. Test-Driven Development ✅ PASS

- **Requirement**: Write tests → Tests fail → Implement → Tests pass → Refactor
- **Status**: COMPLIANT - Plan includes comprehensive testing strategy
- **Implementation**:
  - Unit tests: Health check logic, YAML validation, CSV writing (Jest)
  - Integration tests: Health check execution, file generation, configuration loading
  - E2E tests: Complete user journeys for all 5 user stories (Playwright/Cypress)
  - Contract tests: JSON API schema validation
  - Accessibility tests: Automated WCAG validation (axe-core, Pa11y CI)
  - Target: 80% code coverage minimum per constitution
  - CI/CD pipeline blocks merges on failing tests

### IV. Progressive Enhancement ✅ PASS

- **Requirement**: Core functionality must work without JavaScript
- **Status**: COMPLIANT - Static HTML-first architecture naturally supports this
- **Implementation**:
  - Server-side (Eleventy) generates complete, functional HTML
  - Core status display requires no JavaScript (static HTML table/list)
  - JavaScript only for optional auto-refresh (60s interval per FR-029)
  - Meta refresh tag fallback for browsers with JavaScript disabled
  - No client-side routing (static pages)
  - All content accessible with HTML and CSS only

### V. Performance Budgets ✅ PASS

- **Requirement**: Meet FCP <1.8s, LCP <2.5s, page weight limits
- **Status**: COMPLIANT - Spec includes performance requirements (SC-003, SC-004, SC-005)
- **Implementation**:
  - Target page load <2 seconds (SC-003) aligns with LCP <2.5s
  - Static HTML generation (no runtime server processing) optimizes TTI
  - Minimal JavaScript (auto-refresh only) keeps JS budget low
  - GOV.UK Frontend CSS optimized for performance
  - Lighthouse CI integration in testing strategy
  - Performance budgets: HTML <14KB, CSS <50KB, JS <100KB (constitution requirements)

### VI. Component Quality Standards ✅ PASS

- **Requirement**: Code style, documentation, code review, security standards
- **Status**: COMPLIANT - Standard practices apply
- **Implementation**:
  - ESLint + Prettier with GDS config
  - TypeScript for type safety
  - Structured JSON logging (FR-033, FR-034) for operational observability
  - OpenAPI specification for JSON API contract (Phase 1 deliverable)
  - Security: Server-side validation (YAML config), no user input in initial version
  - Dependency security scanning (npm audit)
  - Code review required before merge

### VII. User Research & Data-Driven Decisions ✅ PASS

- **Requirement**: Design decisions validated through user research and data
- **Status**: COMPLIANT - Spec includes measurable success criteria
- **Implementation**:
  - Spec includes 10 measurable success criteria (SC-001 through SC-010)
  - User stories include explicit acceptance scenarios
  - Analytics for future iterations (out of scope for MVP)
  - Follows GDS Service Manual patterns (status page similar to existing gov.uk patterns)

### Gate Summary

**Overall Status**: ✅ PASS - All constitutional principles satisfied

No violations requiring justification. The feature naturally aligns with the constitution due to:
1. Explicit WCAG 2.2 AAA requirement in spec
2. GOV.UK Design System mandate in spec
3. Static HTML-first architecture supporting progressive enhancement
4. Comprehensive testing requirements included
5. Performance-oriented static generation approach

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── models/              # Data models (Service, HealthCheckResult, Configuration)
├── services/            # Business logic (HealthChecker, FileWriter, StatusGenerator)
├── lib/                 # Utilities (logger, yaml-parser, csv-writer)
└── cli/                 # CLI entry point for background service

_site/                   # Eleventy output (generated HTML/JSON)
├── index.html           # Generated status page
└── api/
    └── status.json      # Generated JSON API

_data/                   # Eleventy data files
├── services.json        # Current service status (fed to templates)
└── config.json          # Configuration for Eleventy

_includes/               # Eleventy templates (Nunjucks)
├── layouts/
│   └── status-page.njk  # Main status page layout (GOV.UK template)
└── components/
    ├── service-list.njk # Service status list component
    └── service-tag.njk  # GOV.UK tag component

tests/
├── unit/                # Unit tests for models, utilities
├── integration/         # Integration tests for health checks, file I/O
├── contract/            # JSON API schema validation tests
└── e2e/                 # End-to-end tests for user journeys (Playwright)

config.yaml              # Service configuration (already exists)
history.csv              # Historical health check data (generated)
package.json             # Node.js dependencies
tsconfig.json            # TypeScript configuration
.eleventy.js             # Eleventy configuration
jest.config.js           # Jest test configuration
playwright.config.ts     # Playwright E2E test configuration
```

**Structure Decision**: Single project architecture combining:
1. **Health check service** (src/): Background TypeScript service executing probes
2. **Static site generator** (Eleventy): Generates GOV.UK-styled HTML from health check data
3. **Data flow**: Health checker writes current status to `_data/services.json` → Eleventy reads data and generates `_site/index.html` and `_site/api/status.json`

This structure separates concerns while keeping the project simple:
- `src/` contains all health check business logic
- `_includes/` contains Eleventy templates using GOV.UK components
- `_data/` serves as the bridge between health checker and static generation
- Tests mirror the source structure

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations identified. Complexity tracking not required.

---

## Phase 1 Re-evaluation: Constitution Check

**Date**: 2025-10-21 (Post-Design)

After completing Phase 1 design artifacts (research.md, data-model.md, contracts/, quickstart.md), the Constitution Check has been re-evaluated:

### I. GDS Design System Compliance ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Research confirms govuk-eleventy-plugin v4+ provides built-in GDS component integration
- Data model specifies use of GOV.UK tag components for service categorization
- Quickstart guide includes GOV.UK Design System resources and validation steps
- Eleventy templates (`_includes/`) will use Nunjucks with GDS components

**No Changes Required**: Original assessment remains valid.

---

### II. Accessibility-First Development ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Research identifies WCAG 2.2 AA compliance in govuk-eleventy-plugin (AAA pursued where feasible)
- Quickstart guide includes accessibility testing workflow (axe-core, Pa11y, screen readers)
- Data model JSON schema includes accessibility considerations (ARIA labels in HTML templates)
- Testing strategy includes automated accessibility tests in CI/CD

**No Changes Required**: Original assessment remains valid. Note that govuk-eleventy-plugin provides AA compliance baseline; additional work required for AAA target (enhanced contrast ratios, comprehensive ARIA).

---

### III. Test-Driven Development ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Quickstart guide documents TDD workflow with watch mode
- Testing strategy includes unit, integration, contract, E2E, and accessibility tests
- Data model provides TypeScript type definitions enabling type-safe test development
- Contract tests will validate JSON API against OpenAPI specification

**No Changes Required**: Original assessment remains valid.

---

### IV. Progressive Enhancement ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Research confirms Eleventy server-side rendering generates complete HTML
- Quickstart notes JavaScript only for auto-refresh (60s interval)
- Data model shows static JSON files (no client-side data fetching required)
- Meta refresh tag fallback available for no-JS scenarios

**No Changes Required**: Original assessment remains valid.

---

### V. Performance Budgets ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Research shows static generation approach optimizes FCP/LCP/TTI
- Quickstart includes Lighthouse CI integration and performance testing commands
- Data model specifies lightweight JSON API (array of service objects)
- Native fetch API (zero dependencies) reduces bundle size

**No Changes Required**: Original assessment remains valid.

---

### VI. Component Quality Standards ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Quickstart documents ESLint, Prettier, TypeScript configuration
- OpenAPI 3.0.3 specification provides API contract documentation
- Data model includes comprehensive TypeScript type definitions
- Research identifies Pino structured logging for observability

**No Changes Required**: Original assessment remains valid.

---

### VII. User Research & Data-Driven Decisions ✅ PASS (Confirmed)

**Post-Design Confirmation**:
- Spec includes 10 measurable success criteria (SC-001 through SC-010)
- User stories provide clear acceptance scenarios
- Research validates technology choices against GDS Service Manual patterns

**No Changes Required**: Original assessment remains valid.

---

### Post-Design Gate Summary

**Overall Status**: ✅ PASS - All constitutional principles satisfied after Phase 1 design

**Key Findings**:
1. Technology choices align with constitution requirements (TypeScript, Eleventy, GOV.UK plugin)
2. Architecture naturally supports progressive enhancement (static HTML-first)
3. Testing strategy comprehensive (unit, integration, contract, E2E, accessibility)
4. Performance-oriented approach (static generation, minimal JS)
5. Accessibility testing workflow documented (automated + manual)

**Action Items**: None - proceed to Phase 2 (/speckit.tasks) to generate implementation tasks.

---

## Planning Complete

This implementation plan is complete through Phase 1. The next step is to run `/speckit.tasks` to generate the task breakdown for implementation.

**Artifacts Generated**:
- ✅ plan.md (this file)
- ✅ research.md (technology stack research)
- ✅ data-model.md (entity definitions and schemas)
- ✅ contracts/status-api.openapi.yaml (API specification)
- ✅ contracts/README.md (contract documentation)
- ✅ quickstart.md (developer guide)
- ✅ CLAUDE.md (agent context updated)

**Ready for**: `/speckit.tasks` command to generate tasks.md

