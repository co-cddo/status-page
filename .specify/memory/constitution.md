<!--
Sync Impact Report - Version 1.5.0
================================================================================
Version Change: 1.4.0 → 1.5.0
Rationale: MINOR version - Added new Principle XII regarding efficient context
           usage through subagent delegation for polling operations

Modified Principles: None

Added Sections:
- Principle XII: Efficient Context Management via Subagents (NON-NEGOTIABLE)
  Impact: Requires delegation of polling/monitoring operations to subagents
  to preserve main agent context for productive work

Removed Sections: None

Templates Status:
✅ plan-template.md - No changes required (subagent usage is execution detail)
✅ spec-template.md - No changes required (testing requirements comprehensive)
✅ tasks-template.md - No changes required (task execution strategy implicit)
✅ CLAUDE.md - Should reference new subagent principle for gh CLI monitoring

Follow-up TODOs:
- RATIFICATION_DATE placeholder retained as TODO - requires project owner decision
- Update CLAUDE.md to reference Principle XII for CI/CD monitoring guidance
- Update CI/CD operations section in constitution (lines 440-517) to recommend
  subagent delegation for gh run watch and gh pr checks --watch operations

Previous Amendment History:
- v1.4.0 (2025-10-23): Added Principle XI for CI/CD workflow with regular pushes
- v1.3.0 (2025-10-23): Added Principles IX and X for test discipline
- v1.2.0 (2025-10-23): Expanded Principle III with 100% test pass requirement
- v1.1.0 (2025-10-22): Expanded CI/CD monitoring operations via gh CLI
- v1.0.0 (2025-10-22): Initial constitution with 8 core principles

================================================================================
-->

# GOV.UK Public Services Status Monitor Constitution

## Core Principles

### I. GDS Design System Compliance (NON-NEGOTIABLE)

All UI components, layouts, and design patterns MUST comply with the GOV.UK Design System without
deviation. This principle is mandatory and cannot be overridden.

**Requirements**:

- Use `@x-govuk/govuk-eleventy-plugin` for all UI component integration
- Extend plugin-provided base layouts; do not create custom layouts from scratch
- Follow GOV.UK Design System patterns exactly for: buttons, forms, navigation, tags, error
  messages, page layouts, and typography
- Use GOV.UK Frontend toolkit color schemes, spacing, and responsive breakpoints
- Do NOT use Crown logo or official GOV.UK branding until hosted on gov.uk domain (per GDS guidance
  for services not yet on gov.uk)

**Rationale**: Government digital services must provide consistent user experience across all GOV.UK
services. Design System compliance ensures accessibility, usability, and public trust in digital
government services.

### II. Accessibility-First Development (NON-NEGOTIABLE)

All features MUST meet WCAG 2.2 Level AAA accessibility standard. This exceeds typical government
requirements (Level AA) to ensure maximum inclusivity.

**Requirements**:

- Automated testing: Playwright with axe-core integration for continuous accessibility validation
- Manual testing: Keyboard navigation testing, screen reader compatibility (NVDA, JAWS, VoiceOver)
- Enhanced contrast ratios: 7:1 for normal text, 4.5:1 for large text/graphics
- Meta refresh tag for page auto-refresh (no JavaScript required)
- Comprehensive ARIA labels and landmarks
- Keyboard navigation support for all interactive elements
- Clear focus indicators meeting enhanced visibility standards
- Information conveyed through multiple channels (not color alone)

**Rationale**: Public services must be accessible to all citizens including those with disabilities.
AAA standard demonstrates government commitment to digital inclusion.

### III. Test-Driven Development (NON-NEGOTIABLE)

All code MUST be developed using test-driven development methodology. Tests must be written before
implementation code. **100% of tests MUST pass at all times - zero tolerance for test failures.**

**Requirements**:

- Write tests first, implement second - strict Red-Green-Refactor cycle
- `npm test` executes all test suites: unit, integration, e2e, accessibility, coverage, performance
- **100% test pass rate requirement - ZERO failures tolerated in any context (local development,
  CI/CD, production)**
- 80% minimum code coverage for both branch coverage AND line coverage
- All test suites run in CI/CD pipeline; any single test failure blocks PR merge
- Vitest for unit tests (fast feedback, native ESM/TypeScript support)
- Playwright for e2e tests validating complete user journeys (User Stories 1-7)
- Accessibility tests integrated via axe-core
- Performance tests validate benchmarked thresholds
- Test failures MUST be fixed immediately before any new work proceeds
- Skipped/ignored tests are treated as failures - all tests must run and pass

**Rationale**: TDD ensures code quality, prevents regressions, enables confident refactoring, and
provides living documentation. 100% pass rate is critical for government service reliability and
public trust. Test failures indicate broken functionality or incorrect assumptions that MUST be
resolved immediately.

### IV. Progressive Enhancement

Core functionality MUST work without JavaScript. Enhanced features may require JavaScript but base
functionality must be accessible to all users.

**Requirements**:

- HTML page auto-refreshes using meta refresh tag (JavaScript-free)
- Static HTML generation (no client-side routing required)
- Self-contained HTML works offline after initial page load
- All critical interactions accessible via keyboard/assistive technologies
- Forms submit via standard HTTP POST (no JavaScript form validation dependency)

**Rationale**: Users may have JavaScript disabled for security/privacy reasons, or use assistive
technologies that don't fully support JavaScript. Progressive enhancement ensures service
availability for all citizens.

### V. Performance Budgets (NON-NEGOTIABLE)

All features MUST meet defined performance benchmarks. Performance is a user experience and
accessibility concern.

**Requirements**:

- Page load time: < 2 seconds on standard government network (1.6 Mbps down, 768 Kbps up, 300ms RTT)
- Health check completion: 95% within configured timeout under normal conditions
- Self-contained HTML file: < 5MB target after asset inlining
- Single HTTP request architecture (zero external dependencies)
- HTML generation completes within benchmarked thresholds (measured during development)
- Worker pool sized to 2x CPU cores for optimal concurrent health check execution
- Graceful shutdown: 30 seconds maximum wait for in-flight operations

**Rationale**: Performance affects accessibility (users on slow connections, mobile devices,
assistive technologies). Government services must be performant for all citizens regardless of
network conditions.

### VI. Component Quality Standards

All components MUST meet defined quality standards for validation, security, and operational
observability.

**Requirements**:

- Configuration validation: Formal JSON Schema validation with detailed error messages
- Security practices: OWASP Top 10 compliance, least-privilege GitHub Actions permissions, no
  secrets in code
- Structured logging: JSON format with correlation IDs (UUID v4), timestamp, service_name,
  event_type, context
- Verbose debug logging: Controlled by DEBUG environment variable, full HTTP request/response
  capture
- Metrics telemetry: Prometheus metrics endpoint (port 9090, path /metrics) with health_checks_total
  counter, health_check_latency_seconds histogram, services_failing gauge
- Error handling: Fail-fast on configuration errors, storage failures, asset generation failures
- Graceful degradation: Retry logic for network errors (max 3 immediate retries), buffer metrics
  when telemetry unavailable

**Rationale**: Government services require enterprise-grade quality, security, and operational
visibility for 24/7 reliability and incident response.

### VII. User Research & Data-Driven Decisions

All design decisions MUST be validated against defined success criteria and user needs.

**Requirements**:

- 13 measurable success criteria defined (SC-001 through SC-013 in spec.md)
- 7 user stories with acceptance scenarios capturing user needs
- Prometheus metrics for operational monitoring (health check latency, failure rates, service
  availability)
- User feedback mechanisms integrated into status page (future enhancement)

**Rationale**: Government digital services must be designed around user needs, not internal
processes. Data-driven decisions prevent building features users don't need or can't use.

### VIII. Research-Driven Technical Decisions (NON-NEGOTIABLE)

All technical implementation decisions MUST be based on documented research using available tools,
not assumptions or memory.

**Requirements**:

- **Before implementing**, MUST research using (in priority order):
  1. **Context7 MCP** (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`):
     Official library documentation (no token cost - use extensively)
  2. **WebSearch**: Best practices, community consensus, architectural patterns (no token cost - use
     extensively)
  3. **WebFetch**: Official documentation, changelogs, migration guides (no token cost - use
     extensively)
  4. **Perplexity MCP** (`mcp__perplexity-researcher__perplexity_ask`): Complex architectural
     decisions requiring synthesis (token cost - use judiciously)
- Decision documents (e.g., research.md) MUST cite sources with URLs/references
- Do NOT implement API integrations, library usage patterns, or framework configurations from memory
- Library selections MUST be justified with: community adoption, maintenance status, security track
  record, GDS compatibility

**Rationale**: Government services require audit trails for technical decisions. Research-driven
decisions prevent security vulnerabilities, maintenance issues, and technical debt from undocumented
assumptions.

### IX. No Test Skipping or TODOs (NON-NEGOTIABLE)

Tests MUST NOT be skipped or marked as todo except during active Test-Driven Development (TDD) red
phase. This is a production application, not an MVP.

**Requirements**:

- Prohibited in production code: `test.skip()`, `test.todo()`, `it.skip()`, `it.todo()`,
  `describe.skip()`, `describe.todo()`
- Prohibited in CI/CD: Any form of test exclusion, filtering, or conditional execution
- Exception ONLY during active TDD red phase: Test may be marked todo while actively writing the
  test, but MUST be implemented before PR
- All tests MUST execute on every test run - no conditional test execution based on environment
- Flaky tests MUST be fixed immediately, not skipped or disabled
- Tests that cannot be made reliable MUST be removed entirely, not left as skipped
- Test suite MUST fail with non-zero exit code if any skipped/todo tests are detected

**Rationale**: Skipped tests create false confidence in code quality and hide potential issues.
Government services require complete test coverage with all tests actively validating functionality.
There is no MVP phase - this is production software from day one.

### X. Mock Services for Testing (NON-NEGOTIABLE)

Tests MUST NOT call external services. All external dependencies MUST be mocked to ensure reliable,
deterministic, and fast test execution.

**Requirements**:

- Integration tests MUST use mock HTTP servers to simulate external services
- Mock services MUST simulate: successful responses, error responses (4xx, 5xx), timeouts, network
  failures, slow responses, flaky behavior
- Test environment MUST NOT require internet connectivity
- Mock services MUST be configurable to test all edge cases: good services, bad services, flaky
  services, slow services
- Use tools like MSW (Mock Service Worker) or similar for HTTP mocking
- Database interactions MUST use in-memory databases or test fixtures
- File system operations MUST use virtual file systems or temp directories
- Time-based tests MUST use controllable clock mocking
- No real API keys, credentials, or external service endpoints in test code

**Rationale**: External service dependencies make tests unreliable (network issues, service
downtime), slow (network latency), and expensive (API costs). Government services require
deterministic testing that can run in isolated environments. Mock services ensure tests are fast,
reliable, and comprehensive in coverage of edge cases.

### XI. Continuous Integration Workflow (NON-NEGOTIABLE)

All development work MUST follow continuous integration practices with regular GitHub pushes and
active CI monitoring. Code stays on developer machines for hours, not days.

**Requirements**:

- Push to GitHub regularly throughout development session (minimum: after each completed task or
  every 2-4 hours)
- Use `gh` CLI to monitor CI status after each push
- MUST check CI status before ending work session - never leave broken builds
- MUST fix failing CI checks immediately or revert the breaking commit
- Feature branches MUST be kept up-to-date with main branch (regular merges/rebases)
- Work-in-progress commits are acceptable and encouraged (use conventional commit prefixes: `wip:`,
  `test:`, `fix:`)
- Use `gh pr checks <pr-number>` to monitor PR status before requesting review
- Use `gh run watch` to monitor workflow execution in real-time
- CI failures MUST NOT be ignored or deferred - treat as blocking issues
- Push frequency increases during active debugging or when making breaking changes

**CI Monitoring Commands**:

```bash
# After pushing code
git push

# Check latest workflow run status
gh run list --limit 5

# Watch specific workflow run
gh run watch <run-id>

# Check PR CI status
gh pr checks <pr-number>

# View failed workflow logs
gh run view <run-id> --log-failed
```

**Rationale**: Regular pushes with CI monitoring provide early feedback on integration issues,
prevent massive merge conflicts, create audit trail of progress, enable team visibility, and reduce
risk of data loss. Government services require disciplined CI/CD practices to maintain code quality
and deployment reliability. Broken CI builds represent integration failures that MUST be addressed
immediately.

### XII. Efficient Context Management via Subagents (NON-NEGOTIABLE)

When monitoring long-running operations (CI builds, deployments, polling operations), MUST delegate
to specialized subagents to preserve main agent context for productive work.

**Requirements**:

- When using `gh` CLI with polling commands (`gh run watch`, `gh pr checks --watch`) that require
  repeated checking or sleep intervals, MUST delegate to a subagent using the Task tool
- Subagent MUST be configured to aggressively poll the operation until completion
- Subagent MUST return comprehensive results (status, logs, errors, duration) to main agent context
  only when operation completes
- Main agent MUST continue productive work while subagent polls in background
- Subagent MUST use appropriate timeout parameters on bash commands to fail fast on stalled
  operations
- Apply to operations including but not limited to:
  - GitHub Actions workflow monitoring (`gh run watch`)
  - PR status checking with waiting (`gh pr checks --watch`)
  - Deployment status monitoring with polling
  - Any operation requiring repeated checks with sleep/delay intervals

**Implementation Pattern**:

```markdown
# Main agent delegates polling to subagent
Task tool with subagent_type=general-purpose:
  "Monitor GitHub Actions workflow run <run-id> using 'gh run watch' and 'gh run view --log-failed' until completion. Poll aggressively with appropriate timeouts. Return final status, execution time, and any error logs. Do not return until operation completes or fails definitively."

# Main agent continues with other tasks while subagent polls
# Later, main agent retrieves results when needed
```

**Rationale**: Long-running polling operations consume main agent context with repetitive status
checks and sleep intervals, reducing capacity for productive implementation work. Delegating to
subagents maximizes context efficiency, enables parallel work, and ensures comprehensive monitoring
without blocking progress. This is critical for government services requiring efficient resource
usage and rapid iteration during CI/CD operations.

## Development Standards

### Code Review Requirements

All code MUST pass peer review before merge to main branch.

**Requirements**:

- Minimum 2 reviewers for critical paths (health check logic, asset generation, deployment
  workflows)
- Minimum 1 reviewer for non-critical changes
- Reviewers MUST verify: GDS Design System compliance, accessibility (WCAG 2.2 AAA), test coverage
  (80% minimum), **100% test pass rate**, performance budget compliance, constitution principle
  adherence
- Protected main branch: Requires passing CI + code review approval
- Conventional Commits format: feat:, fix:, docs:, test:, refactor:, chore:, wip:

### Branching Strategy

**Requirements**:

- Feature branches: `###-feature-name` from `main` (e.g., `001-govuk-status-monitor`)
- Merge via pull requests only
- Delete feature branches after merge
- No direct commits to main branch
- Push feature branch regularly (see Principle XI)

### Testing Requirements

**Requirements**:

- All test suites run in CI/CD pipeline on every PR
- **100% test pass rate required - any single failure blocks PR merge (non-negotiable gate)**
- Test failures MUST be resolved before any new work proceeds
- 80% minimum coverage enforced in CI (both branch and line coverage)
- Test categories: unit, integration, e2e (Playwright), accessibility (axe-core), performance
  (benchmarked thresholds), contract (API validation)
- npm test MUST exit with non-zero code on any test failure
- Skipped/ignored tests are not permitted - all tests must execute and pass
- Flaky tests MUST be fixed immediately or removed (not skipped)
- All tests MUST use mock services - no external service calls permitted

### Documentation Requirements

**Requirements**:

- All configuration options documented in config.yaml with inline comments
- API contracts defined in OpenAPI 3.0.3 format (contracts/ directory)
- Technical decisions documented in research.md with cited sources
- Core entities and data structures documented in data-model.md
- Development setup documented in quickstart.md
- Agent/AI assistant instructions in CLAUDE.md (or AGENTS.md for multi-assistant projects)

## GitHub Repository Configuration

### One-Time Setup (via gh CLI)

The following repository configuration MUST be performed once during project initialization using gh
CLI commands:

**Branch Protection** (main branch):

```bash
# Enable branch protection with required status checks
gh api repos/co-cddo/status-page/branches/main/protection --method PUT --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test", "smoke-test"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null
}
EOF
```

**GitHub Pages**:

```bash
# Enable GitHub Pages with GitHub Actions deployment source
gh api repos/co-cddo/status-page/pages \
  --method POST \
  --field build_type=workflow
```

**Repository Settings**:

```bash
# Configure repository settings
gh api repos/co-cddo/status-page \
  --method PATCH \
  --field has_issues=true \
  --field has_projects=false \
  --field has_wiki=false \
  --field allow_squash_merge=true \
  --field allow_merge_commit=false \
  --field allow_rebase_merge=false \
  --field delete_branch_on_merge=true
```

**Dependabot**:

```bash
# Dependabot is configured via .github/dependabot.yml in repository
# No gh CLI command required - file-based configuration
```

### GitHub Actions Workflow Permissions

All workflows MUST use principle of least privilege for permissions:

**test.yml** (PR tests):

```yaml
permissions:
  contents: read
  pull-requests: read
```

**smoke-test.yml** (Config PR smoke tests):

```yaml
permissions:
  contents: read
  pull-requests: write # Required for posting comment
```

**deploy.yml** (Scheduled deployment):

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

**dependency-update.yml** (Dependabot handling):

```yaml
permissions:
  contents: write
  pull-requests: write
```

### CI/CD Monitoring and Operations (via gh CLI)

Use gh CLI commands for monitoring and troubleshooting CI/CD workflows. These commands provide
real-time visibility into build status, test results, and deployment health.

**IMPORTANT**: For operations requiring polling or repeated checks (marked with ⚠️ DELEGATE),
follow Principle XII and delegate to a subagent to preserve main agent context.

**Check workflow runs status**:

```bash
# List recent workflow runs across all workflows
gh run list --limit 20

# List runs for specific workflow
gh run list --workflow=test.yml --limit 10
gh run list --workflow=deploy.yml --limit 10

# ⚠️ DELEGATE: Watch a workflow run in real-time
# Use Task tool with subagent to monitor until completion
gh run watch <run-id>

# View workflow run details and logs
gh run view <run-id>
gh run view <run-id> --log
gh run view <run-id> --log-failed  # Only failed job logs
```

**Check PR status and required checks**:

```bash
# View PR status including CI checks
gh pr view <pr-number>
gh pr checks <pr-number>

# List all open PRs with status
gh pr list --state open

# ⚠️ DELEGATE: View specific PR CI check details with watching
# Use Task tool with subagent to monitor until completion
gh pr checks <pr-number> --watch  # Watch checks in real-time
```

**Troubleshoot failed workflows**:

```bash
# View failed workflow run logs
gh run view <run-id> --log-failed

# Download workflow run logs for offline analysis
gh run download <run-id>

# Re-run failed workflow
gh run rerun <run-id>
gh run rerun <run-id> --failed  # Re-run only failed jobs
```

**Monitor deployment status**:

```bash
# Check GitHub Pages deployment status
gh api repos/co-cddo/status-page/pages/builds --jq '.[0] | {status, commit: .commit[0:7], created_at, updated_at}'

# List recent deployments
gh api repos/co-cddo/status-page/deployments --jq '.[] | {id, ref, environment, created_at, updated_at}'

# Check deployment status by ID
gh api repos/co-cddo/status-page/deployments/<deployment-id>/statuses
```

**Check workflow status programmatically** (for scripts/automation):

```bash
# Exit with non-zero if any workflow is failing
gh run list --workflow=test.yml --limit 1 --json conclusion --jq '.[0].conclusion' | grep -q success || exit 1

# Get latest deploy workflow status
gh run list --workflow=deploy.yml --limit 1 --json status,conclusion --jq '.[0]'
```

**Rationale**: CI/CD visibility is critical for maintaining service reliability. gh CLI provides
standardized, scriptable access to workflow status without requiring web UI access, enabling
automated monitoring, alerting, and troubleshooting. Subagent delegation for polling operations
(Principle XII) maximizes context efficiency while maintaining comprehensive monitoring.

## Governance

### Amendment Procedure

Constitution amendments require:

1. Proposal documented in PR with rationale and impact analysis
2. Review by minimum 2 project maintainers
3. Version bump following semantic versioning rules:
   - **MAJOR**: Backward-incompatible governance changes, principle removals, principle
     redefinitions
   - **MINOR**: New principle added, materially expanded guidance, new mandatory sections
   - **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic refinements
4. Update Sync Impact Report (HTML comment at top of constitution file)
5. Propagate changes to dependent templates (plan-template.md, spec-template.md, tasks-template.md)
6. Update runtime guidance (CLAUDE.md, README.md, docs/)

### Compliance Review

**Requirements**:

- All PRs MUST verify compliance with applicable principles
- Code reviewers MUST explicitly check constitution compliance
- Complexity or deviations MUST be explicitly justified in PR description
- Constitution supersedes all other development practices and guidelines
- Use CLAUDE.md for detailed runtime development guidance (AI assistant instructions)

### Versioning Policy

**Current Version**: 1.5.0

- **MAJOR** version: Backward-incompatible governance changes
- **MINOR** version: New principles or expanded guidance
- **PATCH** version: Clarifications and non-semantic refinements

**Version**: 1.5.0 | **Ratified**: TODO(RATIFICATION_DATE): Requires project owner decision | **Last
Amended**: 2025-10-26
