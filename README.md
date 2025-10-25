# GOV.UK Public Services Status Monitor

A self-contained status monitoring application that performs periodic HTTP(S) health checks against
configured public services and generates static HTML/JSON assets compliant with the GOV.UK Design
System.

## Features

- **Automated Health Checks**: Concurrent HTTP/HTTPS health checks using worker thread pools
- **Self-Contained HTML**: Single-file output with inlined CSS/JS/images (< 5MB target)
- **GOV.UK Compliant**: Follows GOV.UK Design System patterns and WCAG 2.2 AAA accessibility
- **Historical Tracking**: CSV-based time-series data with GitHub Actions cache
- **Auto-Refresh**: Meta refresh tag for automatic page updates (no JavaScript required)
- **JSON API**: Machine-readable status endpoint at `/api/status.json`
- **Prometheus Metrics**: Built-in metrics server on port 9090
- **Security**: SSRF protection, path traversal prevention, input validation

## Quick Start

### Prerequisites

- **Node.js**: 22.0.0 or later
- **pnpm**: 9.0.0 or later
- **Operating System**: macOS, Linux, or Windows with WSL2

### Installation

```bash
# Clone the repository
git clone https://github.com/co-cddo/status-page.git
cd status-page

# Install dependencies
pnpm install

# Create configuration file
cp config.example.yaml config.yaml
```

### Configuration

Edit `config.yaml` to define the services you want to monitor:

```yaml
settings:
  check_interval: 60 # Default interval in seconds
  warning_threshold: 2 # Latency threshold for DEGRADED (seconds)
  timeout: 5 # HTTP timeout for FAILED (seconds)
  max_retries: 3 # Network error retries

pings:
  - name: 'GOV.UK Homepage'
    protocol: HTTPS
    method: GET
    resource: 'https://www.gov.uk/'
    expected:
      status: 200
    tags: ['public', 'critical']
```

See `specs/001-govuk-status-monitor/spec.md` for full configuration options.

### Development

```bash
# Run health checks once (useful for testing)
pnpm run check-once

# Run in daemon mode (continuous monitoring)
pnpm run dev

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Lint code
pnpm run lint
```

### Building

```bash
# Generate status page
pnpm run build

# Output files
#   _site/index.html - Self-contained HTML status page
#   _site/api/status.json - Machine-readable API
#   history.csv - Historical health check data
```

### Deployment

The application is designed to run on GitHub Actions with scheduled deployments every 5 minutes to
GitHub Pages.

See `.github/workflows/deploy.yml` for the deployment workflow.

## Architecture

**Type**: Hybrid Orchestrator Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   Node.js Orchestrator                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Scheduler   │  │ Worker Pool  │  │  CSV/JSON    │ │
│  │   (Queue)    │→ │ (Threads)    │→ │   Writers    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ Invokes
                         ↓
                ┌────────────────┐
                │  11ty Builder  │
                │   (Subprocess) │
                └────────┬───────┘
                         │ Generates
                         ↓
          ┌──────────────────────────────┐
          │   Post-Build Asset Inlining   │
          │  (Self-Contained HTML < 5MB)  │
          └──────────────────────────────┘
```

### Key Components

- **Orchestrator** (`src/index.ts`): Main entry point, coordinates all subsystems
- **Scheduler** (`src/orchestrator/scheduler.ts`): Priority queue for health checks
- **Worker Pool** (`src/orchestrator/pool-manager.ts`): Concurrent health check execution
- **Health Checks** (`src/health-checks/`): HTTP validation and retry logic
- **Storage** (`src/storage/`): CSV/JSON data persistence
- **11ty Templates** (`_includes/`, `pages/`): GOV.UK Design System layouts
- **Asset Inlining** (`src/inlining/`): Post-build self-contained HTML generation

## Testing

The project follows Test-Driven Development (TDD) with 100% test pass rate requirement:

```bash
# Unit tests (fast)
pnpm run test:unit

# Integration tests
pnpm run test:integration

# End-to-end tests
pnpm run test:e2e

# Accessibility tests (WCAG 2.2 AAA)
pnpm run test:accessibility

# Performance benchmarks
pnpm run test:performance

# All tests
pnpm test
```

**Test Coverage**: 80% minimum (branch + line coverage enforced in CI)

## Configuration Schema

Configuration files are validated against JSON Schema. See:

- Schema definition: `src/config/schema.ts`
- Example config: `config.example.yaml`
- Full specification: `specs/001-govuk-status-monitor/spec.md`

## Accessibility

This application meets **WCAG 2.2 Level AAA** standards:

- ✅ Enhanced contrast ratios (7:1 for normal text, 4.5:1 for large text)
- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ No JavaScript required for core functionality
- ✅ Automated testing with axe-core

## Performance Budgets

| Metric              | Target             |
| ------------------- | ------------------ |
| Page Load Time      | < 2s               |
| Self-Contained HTML | < 5MB              |
| Health Check Cycle  | 95% within timeout |
| Status Update       | < 2min             |

## Security

- **SSRF Protection**: Blocks private IP ranges, localhost, cloud metadata endpoints
- **Input Validation**: JSON Schema validation for config.yaml
- **Path Traversal Prevention**: Safe path resolution for all file operations
- **No Secrets in Code**: Environment variables for sensitive configuration
- **Structured Logging**: Correlation IDs (UUID v4) for security audit trails

## Troubleshooting

### Common Issues

**Problem**: Tests failing with "Worker not a constructor" **Solution**: Ensure you're using vitest
2.1.9 or compatible version

**Problem**: SSRF validation blocking localhost **Solution**: SSRF protection is automatically
disabled when `NODE_ENV=test`

**Problem**: Coverage tool version mismatch **Solution**: Run
`pnpm update vitest @vitest/coverage-v8` to sync versions

**Problem**: Dependabot security alert **Solution**: See `.github/workflows/dependency-update.yml`
for automated handling

### Debug Mode

Set environment variable for verbose logging:

```bash
DEBUG=* pnpm run dev
```

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Write tests first (TDD)
3. Implement feature
4. Ensure all tests pass: `pnpm test`
5. Run linting: `pnpm run lint:fix`
6. Commit with conventional commits: `feat:`, `fix:`, `docs:`, etc.
7. Create pull request

See `CLAUDE.md` for detailed development guidelines.

## Documentation

- **Specification**: `specs/001-govuk-status-monitor/spec.md` - 283 functional requirements
- **Implementation Plan**: `specs/001-govuk-status-monitor/plan.md`
- **Data Model**: `specs/001-govuk-status-monitor/data-model.md`
- **Research**: `specs/001-govuk-status-monitor/research.md`
- **Quick Start**: `specs/001-govuk-status-monitor/quickstart.md`
- **Tasks**: `specs/001-govuk-status-monitor/tasks.md`
- **Constitution**: `.specify/memory/constitution.md` - Governance principles

## License

MIT License with Crown (GDS) copyright. See `LICENSE` file for details.

## Support

- **Issues**: https://github.com/co-cddo/status-page/issues
- **Discussions**: https://github.com/co-cddo/status-page/discussions
- **Security**: Report security issues via GitHub Security Advisories

---

🤖 This project uses [Claude Code](https://claude.com/claude-code) for AI-assisted development.
