<!--
Sync Impact Report - Version 1.2.0
================================================================================
Version Change: 1.1.0 → 1.2.0
Rationale: MINOR version - Materially expanded Principle III (Test-Driven Development)
           to require 100% test pass rate (zero tolerance for failures)

Modified Principles:
- Principle III: Test-Driven Development (NON-NEGOTIABLE)
  OLD: 80% minimum code coverage requirement
  NEW: 100% test pass rate requirement + 80% minimum code coverage
  Impact: Stricter quality gate - no test failures tolerated in any context

Added Sections: None

Removed Sections: None

Templates Status:
✅ plan-template.md - Updated Constitution Check section to reflect 100% pass requirement
✅ spec-template.md - No changes required (testing requirements already comprehensive)
✅ tasks-template.md - Updated testing guidance to emphasize zero-failure requirement
✅ CLAUDE.md - Updated testing requirements and development workflow sections

Follow-up TODOs:
- RATIFICATION_DATE placeholder retained as TODO - requires project owner decision
- Update CI/CD pipeline documentation to emphasize zero-tolerance test gate
- Consider adding pre-commit hooks to run tests locally before push

Previous Amendment History:
- v1.1.0 (2025-10-22): Expanded CI/CD monitoring operations via gh CLI
- v1.0.0 (2025-10-22): Initial constitution with 8 core principles

================================================================================
-->

# GOV.UK Public Services Status Monitor Constitution

## Core Principles

### I. GDS Design System Compliance (NON-NEGOTIABLE)

All UI components, layouts, and design patterns MUST comply with the GOV.UK Design System without deviation. This principle is mandatory and cannot be overridden.

**Requirements**:
- Use `@x-govuk/govuk-eleventy-plugin` for all UI component integration
- Extend plugin-provided base layouts; do not create custom layouts from scratch
- Follow GOV.UK Design System patterns exactly for: buttons, forms, navigation, tags, error messages, page layouts, and typography
- Use GOV.UK Frontend toolkit color schemes, spacing, and responsive breakpoints
- Do NOT use Crown logo or official GOV.UK branding until hosted on gov.uk domain (per GDS guidance for services not yet on gov.uk)

**Rationale**: Government digital services must provide consistent user experience across all GOV.UK services. Design System compliance ensures accessibility, usability, and public trust in digital government services.

### II. Accessibility-First Development (NON-NEGOTIABLE)

All features MUST meet WCAG 2.2 Level AAA accessibility standard. This exceeds typical government requirements (Level AA) to ensure maximum inclusivity.

**Requirements**:
- Automated testing: Playwright with axe-core integration for continuous accessibility validation
- Manual testing: Keyboard navigation testing, screen reader compatibility (NVDA, JAWS, VoiceOver)
- Enhanced contrast ratios: 7:1 for normal text, 4.5:1 for large text/graphics
- Meta refresh tag for page auto-refresh (no JavaScript required)
- Comprehensive ARIA labels and landmarks
- Keyboard navigation support for all interactive elements
- Clear focus indicators meeting enhanced visibility standards
- Information conveyed through multiple channels (not color alone)

**Rationale**: Public services must be accessible to all citizens including those with disabilities. AAA standard demonstrates government commitment to digital inclusion.

### III. Test-Driven Development (NON-NEGOTIABLE)

All code MUST be developed using test-driven development methodology. Tests must be written before implementation code. **100% of tests MUST pass at all times - zero tolerance for test failures.**

**Requirements**:
- Write tests first, implement second - strict Red-Green-Refactor cycle
- `npm test` executes all test suites: unit, integration, e2e, accessibility, coverage, performance
- **100% test pass rate requirement - ZERO failures tolerated in any context (local development, CI/CD, production)**
- 80% minimum code coverage for both branch coverage AND line coverage
- All test suites run in CI/CD pipeline; any single test failure blocks PR merge
- Vitest for unit tests (fast feedback, native ESM/TypeScript support)
- Playwright for e2e tests validating complete user journeys (User Stories 1-7)
- Accessibility tests integrated via axe-core
- Performance tests validate benchmarked thresholds
- Test failures MUST be fixed immediately before any new work proceeds
- Skipped/ignored tests are treated as failures - all tests must run and pass

**Rationale**: TDD ensures code quality, prevents regressions, enables confident refactoring, and provides living documentation. 100% pass rate is critical for government service reliability and public trust. Test failures indicate broken functionality or incorrect assumptions that MUST be resolved immediately.

### IV. Progressive Enhancement

Core functionality MUST work without JavaScript. Enhanced features may require JavaScript but base functionality must be accessible to all users.

**Requirements**:
- HTML page auto-refreshes using meta refresh tag (JavaScript-free)
- Static HTML generation (no client-side routing required)
- Self-contained HTML works offline after initial page load
- All critical interactions accessible via keyboard/assistive technologies
- Forms submit via standard HTTP POST (no JavaScript form validation dependency)

**Rationale**: Users may have JavaScript disabled for security/privacy reasons, or use assistive technologies that don't fully support JavaScript. Progressive enhancement ensures service availability for all citizens.

### V. Performance Budgets (NON-NEGOTIABLE)

All features MUST meet defined performance benchmarks. Performance is a user experience and accessibility concern.

**Requirements**:
- Page load time: < 2 seconds on standard government network (1.6 Mbps down, 768 Kbps up, 300ms RTT)
- Health check completion: 95% within configured timeout under normal conditions
- Self-contained HTML file: < 5MB target after asset inlining
- Single HTTP request architecture (zero external dependencies)
- HTML generation completes within benchmarked thresholds (measured during development)
- Worker pool sized to 2x CPU cores for optimal concurrent health check execution
- Graceful shutdown: 30 seconds maximum wait for in-flight operations

**Rationale**: Performance affects accessibility (users on slow connections, mobile devices, assistive technologies). Government services must be performant for all citizens regardless of network conditions.

### VI. Component Quality Standards

All components MUST meet defined quality standards for validation, security, and operational observability.

**Requirements**:
- Configuration validation: Formal JSON Schema validation with detailed error messages
- Security practices: OWASP Top 10 compliance, least-privilege GitHub Actions permissions, no secrets in code
- Structured logging: JSON format with correlation IDs (UUID v4), timestamp, service_name, event_type, context
- Verbose debug logging: Controlled by DEBUG environment variable, full HTTP request/response capture
- Metrics telemetry: Prometheus metrics endpoint (port 9090, path /metrics) with health_checks_total counter, health_check_latency_seconds histogram, services_failing gauge
- Error handling: Fail-fast on configuration errors, storage failures, asset generation failures
- Graceful degradation: Retry logic for network errors (max 3 immediate retries), buffer metrics when telemetry unavailable

**Rationale**: Government services require enterprise-grade quality, security, and operational visibility for 24/7 reliability and incident response.

### VII. User Research & Data-Driven Decisions

All design decisions MUST be validated against defined success criteria and user needs.

**Requirements**:
- 13 measurable success criteria defined (SC-001 through SC-013 in spec.md)
- 7 user stories with acceptance scenarios capturing user needs
- Prometheus metrics for operational monitoring (health check latency, failure rates, service availability)
- User feedback mechanisms integrated into status page (future enhancement)

**Rationale**: Government digital services must be designed around user needs, not internal processes. Data-driven decisions prevent building features users don't need or can't use.

### VIII. Research-Driven Technical Decisions (NON-NEGOTIABLE)

All technical implementation decisions MUST be based on documented research using available tools, not assumptions or memory.

**Requirements**:
- **Before implementing**, MUST research using (in priority order):
  1. **Context7 MCP** (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`): Official library documentation (no token cost - use extensively)
  2. **WebSearch**: Best practices, community consensus, architectural patterns (no token cost - use extensively)
  3. **WebFetch**: Official documentation, changelogs, migration guides (no token cost - use extensively)
  4. **Perplexity MCP** (`mcp__perplexity-researcher__perplexity_ask`): Complex architectural decisions requiring synthesis (token cost - use judiciously)
- Decision documents (e.g., research.md) MUST cite sources with URLs/references
- Do NOT implement API integrations, library usage patterns, or framework configurations from memory
- Library selections MUST be justified with: community adoption, maintenance status, security track record, GDS compatibility

**Rationale**: Government services require audit trails for technical decisions. Research-driven decisions prevent security vulnerabilities, maintenance issues, and technical debt from undocumented assumptions.

## Development Standards

### Code Review Requirements

All code MUST pass peer review before merge to main branch.

**Requirements**:
- Minimum 2 reviewers for critical paths (health check logic, asset generation, deployment workflows)
- Minimum 1 reviewer for non-critical changes
- Reviewers MUST verify: GDS Design System compliance, accessibility (WCAG 2.2 AAA), test coverage (80% minimum), **100% test pass rate**, performance budget compliance, constitution principle adherence
- Protected main branch: Requires passing CI + code review approval
- Conventional Commits format: feat:, fix:, docs:, test:, refactor:, chore:

### Branching Strategy

**Requirements**:
- Feature branches: `###-feature-name` from `main` (e.g., `001-govuk-status-monitor`)
- Merge via pull requests only
- Delete feature branches after merge
- No direct commits to main branch

### Testing Requirements

**Requirements**:
- All test suites run in CI/CD pipeline on every PR
- **100% test pass rate required - any single failure blocks PR merge (non-negotiable gate)**
- Test failures MUST be resolved before any new work proceeds
- 80% minimum coverage enforced in CI (both branch and line coverage)
- Test categories: unit, integration, e2e (Playwright), accessibility (axe-core), performance (benchmarked thresholds), contract (API validation)
- npm test MUST exit with non-zero code on any test failure
- Skipped/ignored tests are not permitted - all tests must execute and pass
- Flaky tests MUST be fixed immediately or removed (not skipped)

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

The following repository configuration MUST be performed once during project initialization using gh CLI commands:

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
  pull-requests: write  # Required for posting comment
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

Use gh CLI commands for monitoring and troubleshooting CI/CD workflows. These commands provide real-time visibility into build status, test results, and deployment health.

**Check workflow runs status**:
```bash
# List recent workflow runs across all workflows
gh run list --limit 20

# List runs for specific workflow
gh run list --workflow=test.yml --limit 10
gh run list --workflow=deploy.yml --limit 10

# Watch a workflow run in real-time
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

# View specific PR CI check details
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

**Rationale**: CI/CD visibility is critical for maintaining service reliability. gh CLI provides standardized, scriptable access to workflow status without requiring web UI access, enabling automated monitoring, alerting, and troubleshooting.

## Governance

### Amendment Procedure

Constitution amendments require:
1. Proposal documented in PR with rationale and impact analysis
2. Review by minimum 2 project maintainers
3. Version bump following semantic versioning rules:
   - **MAJOR**: Backward-incompatible governance changes, principle removals, principle redefinitions
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

**Current Version**: 1.2.0
- **MAJOR** version: Backward-incompatible governance changes
- **MINOR** version: New principles or expanded guidance
- **PATCH** version: Clarifications and non-semantic refinements

**Version**: 1.2.0 | **Ratified**: TODO(RATIFICATION_DATE): Requires project owner decision | **Last Amended**: 2025-10-23
