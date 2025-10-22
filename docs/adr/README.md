# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the GOV.UK Public Services Status Monitor project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

ADRs help teams:
- **Understand the reasoning** behind past decisions
- **Onboard new team members** by providing historical context
- **Avoid revisiting** already-decided topics
- **Document trade-offs** explicitly

## ADR Process

### When to Create an ADR

Create an ADR when making a decision that:
- Affects the project's architecture or technical direction
- Has long-term implications
- Involves trade-offs between multiple options
- May be questioned or revisited in the future
- Requires research or evaluation of alternatives

### How to Create an ADR

1. **Copy the template**: `cp template.md NNNN-title-with-dashes.md`
2. **Number sequentially**: Use leading zeros (0001, 0002, etc.)
3. **Use kebab-case**: Lowercase with hyphens (e.g., `0001-worker-threads-for-health-checks.md`)
4. **Fill out all sections**: Context, Decision, Consequences, Alternatives, References
5. **Cite sources**: Include links to Context7 docs, research.md, official documentation
6. **Set status**: Start with "Proposed", change to "Accepted" after review
7. **Commit with ADR**: Include ADR in the same PR as the implementation

### ADR Naming Convention

Format: `####-title-with-dashes.md`

Examples:
- `0001-worker-threads-for-health-checks.md`
- `0002-eleventy-static-site-generator.md`
- `0015-migration-from-csv-to-postgresql.md`

## ADR Statuses

- **Proposed**: Decision is under discussion
- **Accepted**: Decision has been approved and is active
- **Deprecated**: Decision is no longer recommended but still in use
- **Superseded**: Decision has been replaced by a newer ADR (reference the new ADR)

## Index of Decisions

### Active ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-worker-threads-for-health-checks.md) | Worker Threads for Concurrency | Accepted | 2025-10-22 |
| [0002](0002-eleventy-static-site-generator.md) | Eleventy for Static Site Generation | Accepted | 2025-10-22 |
| [0003](0003-post-build-asset-inlining.md) | Post-Build Asset Inlining | Accepted | 2025-10-22 |
| [0004](0004-github-actions-cache-csv-storage.md) | GitHub Actions Cache for CSV Persistence | Accepted | 2025-10-22 |
| [0005](0005-csv-consecutive-failure-derivation.md) | CSV Format for Consecutive Failure Tracking | Accepted | 2025-10-22 |
| [0006](0006-prometheus-cardinality-limits.md) | Prometheus Metrics Cardinality Management | Accepted | 2025-10-22 |

### Superseded ADRs

(None yet)

## Related Documentation

- **Feature Specification**: [specs/001-govuk-status-monitor/spec.md](../../specs/001-govuk-status-monitor/spec.md)
- **Implementation Plan**: [specs/001-govuk-status-monitor/plan.md](../../specs/001-govuk-status-monitor/plan.md)
- **Technology Research**: [specs/001-govuk-status-monitor/research.md](../../specs/001-govuk-status-monitor/research.md)
- **Project Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

## Resources

- [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (original article by Michael Nygard)
