# Implementation Plan: Comprehensive UK Public Service Monitoring

**Branch**: `002-add-9500-public-services` | **Date**: 2025-10-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-add-9500-public-services/spec.md`

## Summary

This feature performs exhaustive research to discover and document 9500+ UK public sector services, then adds them to `config.yaml` with appropriate health check configuration. This is a **data collection and configuration task**, not traditional software development. The work involves systematic service discovery using multiple research methods (DNS enumeration, web search, certificate transparency logs, government directories), validation of discovered endpoints, and structured documentation in JSON format before transforming to YAML configuration.

**Key Clarifications from /speckit.clarify**:
- Research output format: JSON (disposable development artifact for programmatic transformation)
- Discovery strategy: Breadth-first coverage across all categories, then depth by criticality
- Scope: 9500 is minimum baseline - exhaustive research should continue beyond this threshold
- Deduplication: Follow HTTP redirects to canonical URL

## Technical Context

**Language/Version**: Node.js 22+ with TypeScript 5.x (existing project stack)
**Primary Dependencies**: Research tools (dns, http clients), existing monitoring infrastructure
**Storage**: JSON intermediate files → config.yaml (YAML)
**Testing**: Validation scripts for discovered services (URL accessibility, redirect following, deduplication)
**Target Platform**: Development workstation with network access to UK public services
**Project Type**: Data collection and configuration (not code development)
**Performance Goals**: Discover and validate 9500+ services within 80-120 hours research effort
**Constraints**:
- All discovered services must be publicly accessible production endpoints
- Services must pass validation (HTTP 200/401/403 response or documented expected status)
- Config.yaml must remain under 5MB and parsable by standard YAML libraries
- Follow redirects to canonical URLs for deduplication

**Scale/Scope**:
- Minimum 9500 unique service endpoints (exhaustive discovery - no upper limit)
- Minimum 50 services per major department (HMRC, DVLA, DWP, NHS, Home Office, MOJ, DfE, DEFRA)
- Minimum 100 emergency service endpoints (police, fire, ambulance, coast guard)
- Minimum 200 local government service endpoints
- Minimum 50 *.services.gov.uk subdomains
- Minimum 100 third-party contracted service provider endpoints

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Note**: This feature is a **data collection and configuration task**, not traditional software development. Constitution principles apply to the research process, validation tooling, and documentation quality rather than application code.

**Test-Driven Development (Principle III)**: ⚠️ **MODIFIED INTERPRETATION**

- [x] Research process will use validation scripts with 100% pass rate requirement for discovered services
- [x] Validation coverage: URL accessibility checks, redirect following, deduplication logic, JSON schema validation
- [x] All validation scripts must pass before services added to config.yaml
- [x] No service entries bypass validation (zero tolerance)
- [ ] Traditional TDD Red-Green-Refactor cycle: **N/A** (no application code development)
- [ ] 80% code coverage target: **N/A** (validation scripts only, not production code)

**Justification**: This is exhaustive research/data collection, not software feature development. Validation scripts ensure data quality (analogous to test quality in code development). Principle III's core intent (quality gates, zero failures) applies to validation process.

**Accessibility-First Development (Principle II)**: ✅ **SATISFIED**

- [x] Discovered services are inherently public-facing and should meet accessibility standards
- [x] Research will document accessibility concerns for services with obvious WCAG violations
- [x] This feature enhances accessibility of monitoring system by ensuring comprehensive service coverage

**GDS Design System Compliance (Principle I)**: ✅ **SATISFIED**

- [x] No UI changes - pure configuration/data collection
- [x] Existing status page uses `@x-govuk/govuk-eleventy-plugin` (unchanged)

**Progressive Enhancement (Principle IV)**: ✅ **SATISFIED**

- [x] No JavaScript changes - pure configuration/data collection

**Performance Budgets (Principle V)**: ✅ **SATISFIED**

- [x] Config.yaml size monitored (< 5MB target documented)
- [x] Worker pool sizing validated against 9500+ service scale (2x CPU cores, configurable)
- [x] Page load performance regression testing recommended after adding 9500+ services

**Component Quality Standards (Principle VI)**: ✅ **SATISFIED**

- [x] JSON Schema validation for intermediate research data
- [x] Config.yaml validation against existing JSON Schema before deployment
- [x] Structured logging for research process (discovery source, validation results)
- [x] No secrets in configuration (all services are public endpoints)

**User Research & Data-Driven Decisions (Principle VII)**: ✅ **SATISFIED**

- [x] 13 measurable success criteria defined in spec.md (SC-001 through SC-013)
- [x] Research methodology documented for reproducibility

**Research-Driven Technical Decisions (Principle VIII)**: ✅ **SATISFIED**

- [x] Research methods explicitly documented (DNS enumeration, CT logs, web search, etc.)
- [x] Tool selection justified (subfinder, amass, crt.sh, WebSearch, Perplexity, WebFetch)
- [x] Discovery sources documented per service (FR-008)

**No Test Skipping or TODOs (Principle IX)**: ✅ **SATISFIED**

- [x] All validation scripts execute fully (no skipped services)
- [x] Failed validations must be resolved or service excluded with documentation

**Mock Services for Testing (Principle X)**: ⚠️ **MODIFIED INTERPRETATION**

- [x] Validation process will call real services to verify public accessibility
- [ ] Mock services: **N/A** (validation requires real HTTP requests to verify public endpoints)

**Justification**: Service discovery validation inherently requires real HTTP requests to verify public accessibility. This is data collection validation, not application testing. Mock services would defeat the purpose of verifying services are publicly accessible.

**Continuous Integration Workflow (Principle XI)**: ✅ **SATISFIED**

- [x] Research progress committed regularly (JSON files, validation scripts)
- [x] CI validation workflow will validate config.yaml on each push
- [x] GitHub pushes after each research phase completion (breadth → depth → exhaustive)

## Project Structure

### Documentation (this feature)

```text
specs/002-add-9500-public-services/
├── spec.md              # Feature specification (/speckit.specify output)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output - research methodology and tool decisions
├── data-model.md        # Phase 1 output - service entry schema and validation rules
├── quickstart.md        # Phase 1 output - researcher setup guide
├── contracts/           # Phase 1 output - validation API contracts
│   └── service-discovery-api.json  # Service discovery and validation data model
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Research Artifacts (ephemeral - not committed)

```text
specs/002-add-9500-public-services/research-data/
├── discovered-services.json      # Intermediate JSON output from discovery phase
├── validated-services.json       # Services passing validation
├── excluded-services.json        # Services excluded with reasons
├── deduplication-map.json        # URL redirect mapping for canonical resolution
└── validation-reports/           # Detailed validation results per category
    ├── government-departments.json
    ├── nhs-services.json
    ├── emergency-services.json
    ├── local-government.json
    └── third-party.json
```

### Source Code (repository root)

**Note**: This feature does NOT add new application code. It adds configuration data to existing `config.yaml`.

```text
config.yaml              # Updated with 9500+ service entries (MODIFIED)

scripts/                 # Validation and transformation scripts (NEW)
├── validate-services.ts # Service URL validation, redirect following, accessibility checks
├── deduplicate.ts       # Canonical URL resolution via redirect following
├── transform-to-yaml.ts # JSON → YAML transformation with sorting and grouping
└── validate-config.ts   # JSON Schema validation for final config.yaml
```

**Structure Decision**: This is a **configuration/data collection feature**, not application development. New validation scripts in `scripts/` directory support the research process. Main deliverable is updated `config.yaml` with 9500+ validated service entries organized by department and criticality tier.

## Complexity Tracking

> **No constitution violations requiring justification.**

**Modified Interpretations** (not violations):

| Principle             | Modification                                                                 | Justification                                                                                       |
| --------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Principle III (TDD)   | Validation scripts instead of traditional unit tests                        | Data collection task - validation ensures data quality (analogous to test quality in code dev)     |
| Principle X (Mocking) | Real HTTP requests for validation instead of mocks                           | Service discovery validation requires real requests to verify public accessibility                 |
| Principle IX (No Skip)| All validation checks execute, failed services excluded with documentation   | Maintains zero-tolerance quality standard while allowing documented exclusions for invalid services |

**Alternatives Considered**:

1. **Mock HTTP responses for validation**: Rejected - Defeats purpose of verifying services are publicly accessible. Cannot validate redirect behavior or actual service availability.
2. **Manual service list without validation**: Rejected - High risk of broken links, deprecated services, duplicate entries. Automated validation ensures data quality.
3. **Sample subset instead of exhaustive**: Rejected - User explicitly requested exhaustive research beyond 9500 minimum. Comprehensive coverage is core requirement.

## Phase 0: Research & Tool Selection

**Goal**: Research and document discovery tools, validation methodologies, and transformation approaches.

### Research Tasks (to be executed using research-expert agents)

The following research tasks will be dispatched to specialized research agents to gather comprehensive information:

1. **DNS Enumeration Tools**: Research subfinder, amass, dnsrecon for *.services.gov.uk subdomain discovery
2. **Certificate Transparency Logs**: Research crt.sh API and CT log querying for subdomain discovery
3. **Web Search Strategies**: Research advanced search operators for service discovery
4. **Government Service Directories**: Research GOV.UK API, NHS Digital catalogs, data.gov.uk APIs
5. **HTTP Client Libraries**: Research Node.js http clients for redirect following and canonical URL resolution
6. **JSON Schema Validation**: Research schema design and validation libraries for service entries
7. **YAML Transformation**: Research js-yaml and formatting strategies for 9500+ entry config file
8. **Service Categorization**: Research UK government department structure and taxonomy design
9. **Deduplication Algorithms**: Research URL normalization and redirect chain resolution
10. **Validation Approaches**: Research HTTP health check best practices and rate limiting

### Expected Research Outputs

**File**: `specs/002-add-9500-public-services/research.md`

Will contain consolidated findings with:
- Tool decisions and installation instructions
- Discovery methodology workflows
- Validation approach and error handling
- Transformation strategy for JSON → YAML
- Cited sources for all technical decisions

## Phase 1: Data Model & Validation Contracts

**Prerequisites**: research.md complete

### Deliverables

1. **data-model.md**: Service entry schema, validation rules, state transitions
2. **contracts/service-discovery-api.json**: JSON Schema for intermediate discovery format
3. **quickstart.md**: Researcher setup and workflow guide

### Agent Context Update

After Phase 1 completion, run:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This updates CLAUDE.md with:
- New research tools (subfinder, amass, crt.sh)
- Validation script locations
- Discovery workflow overview

## Phase 2: Task Breakdown

**Not executed by /speckit.plan** - Run `/speckit.tasks` separately after plan approval.

Will generate `tasks.md` with:
- Task breakdown for each discovery phase (breadth → depth → exhaustive)
- Service category research tasks (HMRC, NHS, emergency, local gov, etc.)
- Validation and transformation tasks
- Quality gate verification tasks

## Success Criteria Review

Mapping spec.md Success Criteria to plan deliverables:

- **SC-001**: 9500+ unique endpoints → Validated in transformation script before YAML generation
- **SC-002**: 50+ services per major dept → Breadth-first phase ensures minimum coverage
- **SC-003**: All 4 UK health systems → NHS research task covers England, Scotland, Wales, NI
- **SC-004**: 100+ emergency services → Dedicated emergency services research task
- **SC-005**: 200+ local gov services → Local government research task
- **SC-006**: 50+ *.services.gov.uk → DNS enumeration task
- **SC-007**: 100+ third-party → Third-party research task
- **SC-008**: No resource exhaustion → Worker pool validation in existing monitoring system
- **SC-009**: Zero schema errors → JSON Schema validation in transformation pipeline
- **SC-010**: 15min monitoring cycle → Performance validation recommended post-deployment
- **SC-011**: Documented methodology → research.md captures reproducible process
- **SC-012**: 50+ unique tags → Tag taxonomy in data-model.md
- **SC-013**: Page load < 2s → Performance regression testing recommended

## Risk Assessment

| Risk                                      | Mitigation                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| DNS enumeration blocked by rate limiting  | Use multiple tools (subfinder, amass), stagger requests, respect robots.txt         |
| Services return 403/blocks                | Document as inaccessible, classify by expected behavior (auth-required vs blocked)  |
| Redirect loops                            | Max redirect limit (10), detect circular redirects, document pathological cases     |
| Config.yaml exceeds 5MB                   | Monitor file size, optimize comments, consider splitting by criticality tier        |
| Deduplication misses functional duplicates| Manual review of high-similarity services, validate by department                   |
| Research time exceeds 120 hours           | Breadth-first ensures minimum coverage met, exhaustive phase continues as available |
| Service changes during research           | Timestamp all validations, plan for periodic re-validation post-deployment          |

## Next Steps

1. ✅ **Plan complete** - Review and approve this implementation plan
2. ⏭️ **Execute Phase 0** - Run research tasks to populate research.md
3. ⏭️ **Execute Phase 1** - Generate data-model.md, contracts/, quickstart.md
4. ⏭️ **Run /speckit.tasks** - Generate detailed task breakdown
5. ⏭️ **Begin discovery** - Execute breadth-first service discovery
6. ⏭️ **Validate and transform** - Convert discovered services to config.yaml entries
7. ⏭️ **Submit PR** - Add 9500+ services with validation evidence
