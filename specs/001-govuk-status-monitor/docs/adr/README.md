# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting significant technical decisions made during the development of the GOV.UK Public Services Status Monitor.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. ADRs provide:
- Historical context for future maintainers
- Rationale for technical choices
- Trade-off analysis with alternatives considered
- Research citations per constitution.md Principle VIII

## Format

ADRs follow the [MADR](https://adr.github.io/madr/) (Markdown Architecture Decision Records) format. See `template.md` for the structure.

## Naming Convention

ADRs use the format: `####-title-with-dashes.md` where:
- `####` is a sequential number with leading zeros (0001, 0002, etc.)
- `title-with-dashes` describes the decision in kebab-case

## When to Write an ADR

Write an ADR when:
- Selecting a major dependency or framework
- Choosing between architectural patterns
- Making a decision that affects multiple components
- Establishing a development practice or standard
- Making a trade-off with significant consequences

## Index of Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-worker-threads-for-health-checks.md) | Worker Threads for Concurrency | Accepted | 2025-10-22 |
| [0002](0002-eleventy-static-site-generator.md) | Eleventy for Static Site Generation | Accepted | 2025-10-22 |
| [0003](0003-post-build-asset-inlining.md) | Post-Build Asset Inlining | Accepted | 2025-10-22 |
| [0004](0004-github-actions-cache-csv-storage.md) | GitHub Actions Cache for CSV Persistence | Accepted | 2025-10-22 |

## Process

1. Copy `template.md` to new file with next sequential number
2. Fill in all sections, especially research citations
3. Commit ADR with implementation PR or as standalone doc
4. Update this README index
