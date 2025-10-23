# Quickstart: GOV.UK Status Monitor Development

**Feature**: 001-govuk-status-monitor **Last Updated**: 2025-10-21

This guide helps developers quickly set up, run, and test the GOV.UK Public Services Status Monitor
application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Testing](#testing)
6. [Development Workflow](#development-workflow)
7. [Project Structure](#project-structure)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: v22.11.0 or later (LTS recommended)

  ```bash
  node --version  # Should be >= 22.11.0
  ```

- **npm**: v10+ (comes with Node.js 22)
  ```bash
  npm --version
  ```

### Recommended Tools

- **TypeScript**: 5.8+ (installed as dev dependency)
- **Git**: For version control
- **VS Code**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

### System Requirements

- **Operating System**: Linux, macOS, or Windows (WSL recommended)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for dependencies

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/status-monitor.git
cd status-monitor
```

### 2. Checkout Feature Branch

```bash
git checkout 001-govuk-status-monitor
```

### 3. Install Dependencies

```bash
npm install
```

This installs:

- Eleventy v3+ (static site generator)
- govuk-eleventy-plugin v4+ (GOV.UK Design System integration)
- TypeScript v5.8+ (type safety)
- Jest (testing framework)
- Playwright (E2E testing)
- Pino (structured logging)
- fast-csv (CSV file handling)
- yaml (YAML configuration parsing)

### 4. Verify Installation

```bash
npm run verify
```

Expected output:

```
✓ Node.js version: 22.11.0
✓ npm version: 10.x.x
✓ TypeScript version: 5.8.x
✓ Eleventy version: 3.x.x
✓ All dependencies installed
```

## Configuration

### 1. Review Configuration File

The application uses `config.yaml` to define monitored services:

```yaml
# config.yaml (already exists in repo root)
settings:
  check_interval: 60 # Default check interval (seconds)
  warning_threshold: 2 # Latency threshold for DEGRADED state (seconds)
  timeout: 5 # HTTP timeout for FAILED state (seconds)
  page_refresh: 60 # Browser auto-refresh interval (seconds)
  worker_pool_size: 0 # 0 = auto (2x CPU cores)
  history_file: 'history.csv'
  output_dir: '_site'

pings:
  - name: 'GOV.UK Homepage'
    protocol: HTTPS
    method: GET
    resource: 'https://www.gov.uk'
    tags: ['central government', 'core services']
    expected:
      status: 200
      text: 'Welcome to GOV.UK'
```

### 2. Validate Configuration

```bash
npm run validate-config
```

This checks:

- Valid YAML syntax
- Required fields present
- Unique service names
- Valid HTTP methods and protocols
- Proper expected validation criteria

### 3. Environment Variables

Create a `.env` file for optional settings:

```bash
# .env
DEBUG=info                    # Logging level: info, error, debug
METRICS_BUFFER_SIZE=1000      # Max metrics to buffer when telemetry unavailable
```

**Security Note**: When `DEBUG=debug`, full HTTP request/response bodies are logged. Only use in
secure troubleshooting environments.

## Running the Application

### Development Mode

Run the health check service and Eleventy in watch mode:

```bash
npm run dev
```

This starts:

1. **Health check service**: Executes checks every 60 seconds (configurable)
2. **Eleventy dev server**: Auto-regenerates HTML on data changes
3. **Browser**: Opens `http://localhost:8080` with live reload

Expected output:

```
[INFO] Starting GOV.UK Status Monitor
[INFO] Loaded 3 services from config.yaml
[INFO] Starting health check service (60s interval)
[INFO] Eleventy dev server running at http://localhost:8080
```

### Production Mode

Build and run for production:

```bash
# Build static site
npm run build

# Start health check service (background)
npm start
```

Production deployment uses systemd or similar process managers.

### Manual Health Check (Single Run)

Execute one health check cycle without starting the service:

```bash
npm run check-once
```

## Testing

### Run All Tests

```bash
npm test
```

This executes:

- Unit tests (Jest)
- Integration tests (Jest)
- Contract tests (JSON API schema validation)
- E2E tests (Playwright)
- Accessibility tests (axe-core, Pa11y)

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Accessibility tests only
npm run test:a11y

# Contract tests only
npm run test:contract
```

### Test Coverage

```bash
npm run test:coverage
```

Target: 80% minimum coverage (per constitution).

### Watch Mode (TDD)

```bash
npm run test:watch
```

Automatically re-runs tests when files change.

## Development Workflow

### TDD Workflow (Required)

Following constitution principle III (Test-Driven Development):

1. **Write test** for new feature (test fails)
2. **Implement feature** (test passes)
3. **Refactor** code (tests still pass)

Example:

```bash
# 1. Create failing test
cat > tests/unit/services/health-checker.test.ts << 'EOF'
describe('HealthChecker', () => {
  it('should mark service as DEGRADED when latency exceeds warning threshold', async () => {
    // Test implementation
  });
});
EOF

# 2. Run test (should fail)
npm run test:watch

# 3. Implement feature in src/services/health-checker.ts

# 4. Test passes - refactor if needed
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Run Prettier
npm run format

# Check formatting without changes
npm run format:check
```

### Type Checking

```bash
# Check TypeScript types
npm run type-check
```

### Pre-commit Checks

Automatically runs before each commit:

- Linting
- Type checking
- Unit tests
- Formatting check

```bash
# Manual pre-commit check
npm run pre-commit
```

## Project Structure

```
├── src/                     # Source code
│   ├── models/              # Data models (Service, HealthCheckResult)
│   ├── services/            # Business logic (HealthChecker, FileWriter)
│   ├── lib/                 # Utilities (logger, yaml-parser, csv-writer)
│   └── cli/                 # CLI entry point
├── _includes/               # Eleventy templates (Nunjucks)
│   ├── layouts/
│   │   └── status-page.njk  # Main GOV.UK status page layout
│   └── components/
│       ├── service-list.njk # Service status list
│       └── service-tag.njk  # GOV.UK tag component
├── _data/                   # Eleventy data files
│   ├── services.json        # Current service status (generated)
│   └── config.json          # Eleventy config data
├── _site/                   # Generated static site (output)
│   ├── index.html           # Status page
│   └── api/
│       └── status.json      # JSON API
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── specs/                   # Feature specifications
│   └── 001-govuk-status-monitor/
│       ├── spec.md          # Feature spec
│       ├── plan.md          # Implementation plan
│       ├── research.md      # Technology research
│       ├── data-model.md    # Data model documentation
│       ├── quickstart.md    # This file
│       └── contracts/       # API contracts (OpenAPI)
├── config.yaml              # Service configuration
├── history.csv              # Historical health check data (generated)
├── package.json
├── tsconfig.json
├── .eleventy.js             # Eleventy configuration
└── jest.config.js
```

## Common Tasks

### Add a New Service to Monitor

1. Edit `config.yaml`:

```yaml
pings:
  - name: 'New Service'
    protocol: HTTPS
    method: GET
    resource: 'https://new-service.gov.uk/health'
    tags: ['new category']
    expected:
      status: 200
      text: 'OK'
```

2. Validate configuration:

```bash
npm run validate-config
```

3. Restart service:

```bash
npm restart
```

### View Generated Status Page

```bash
# Development mode (with live reload)
npm run dev

# Production build (view static file)
npm run build
npx serve _site
```

Access: `http://localhost:8080`

### Access JSON API

```bash
# View current status JSON
curl http://localhost:8080/api/status.json | jq

# Or visit in browser
open http://localhost:8080/api/status.json
```

### View Historical Data

```bash
# View CSV file
cat history.csv

# View last 10 records
tail -n 10 history.csv

# Filter by service name
grep "example" history.csv
```

### Debug Health Checks

Enable debug logging:

```bash
DEBUG=debug npm run dev
```

This logs:

- Full HTTP request headers and bodies
- Response headers and bodies
- Detailed timing information
- Correlation IDs for tracing

**Security Warning**: Debug mode logs sensitive data (API keys, tokens). Only use in secure
environments.

### Run Accessibility Audit

```bash
# Automated accessibility tests
npm run test:a11y

# Manual audit with Lighthouse
npx lighthouse http://localhost:8080 --view

# Screen reader testing (manual)
# - NVDA (Windows): https://www.nvaccess.org/download/
# - VoiceOver (macOS): Cmd+F5
# - JAWS (Windows): https://www.freedomscientific.com/products/software/jaws/
```

### Performance Testing

```bash
# Lighthouse performance audit
npx lighthouse http://localhost:8080 --only-categories=performance --view

# Check performance budgets
npm run test:perf

# Expected metrics:
# - FCP < 1.8s
# - LCP < 2.5s
# - TTI < 3.5s
# - CLS < 0.1
```

### Generate API Documentation

```bash
# Interactive API docs with Redoc
npx @redocly/cli build-docs specs/001-govuk-status-monitor/contracts/status-api.openapi.yaml --output api-docs.html

# Open in browser
open api-docs.html
```

## Troubleshooting

### Configuration Validation Fails

**Error**: `Configuration validation failed: Duplicate service name 'example'`

**Solution**: Ensure all service names in `config.yaml` are unique.

```bash
# Check for duplicates
grep "name:" config.yaml | sort | uniq -d
```

---

### CSV Write Failures

**Error**: `EACCES: permission denied, open 'history.csv'`

**Solution**: Check file permissions:

```bash
chmod 644 history.csv
```

---

### Eleventy Build Fails

**Error**: `Error: Cannot find module 'govuk-eleventy-plugin'`

**Solution**: Reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

### Health Checks Timing Out

**Error**: All services showing "Connection timeout"

**Solutions**:

1. **Check network connectivity**:

   ```bash
   curl https://example.com
   ```

2. **Increase timeout in config.yaml**:

   ```yaml
   settings:
     timeout: 10 # Increase from 5 to 10 seconds
   ```

3. **Check firewall/proxy settings**

---

### Accessibility Tests Failing

**Error**: `WCAG 2.2 AAA violations detected`

**Solution**: Review violations and fix:

```bash
npm run test:a11y -- --verbose

# Common issues:
# - Color contrast < 7:1 (AAA requirement)
# - Missing ARIA labels
# - Keyboard navigation broken
# - Focus indicators not visible
```

---

### TypeScript Type Errors

**Error**: `Property 'foo' does not exist on type 'Service'`

**Solution**: Regenerate types from data model:

```bash
npm run type-check

# Fix type definitions in src/models/
```

---

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::8080`

**Solution**: Kill existing process or use different port:

```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use different port
PORT=8081 npm run dev
```

## Next Steps

1. **Read the feature specification**: [spec.md](./spec.md)
2. **Understand the data model**: [data-model.md](./data-model.md)
3. **Review the implementation plan**: [plan.md](./plan.md)
4. **Explore the API contract**:
   [contracts/status-api.openapi.yaml](./contracts/status-api.openapi.yaml)
5. **Review the constitution**:
   [../.specify/memory/constitution.md](../../.specify/memory/constitution.md)

## Additional Resources

- **Eleventy Documentation**: https://www.11ty.dev/docs/
- **govuk-eleventy-plugin**: https://x-govuk.github.io/govuk-eleventy-plugin/
- **GOV.UK Design System**: https://design-system.service.gov.uk/
- **GOV.UK Frontend**: https://frontend.design-system.service.gov.uk/
- **WCAG 2.2 Guidelines**: https://www.w3.org/WAI/WCAG22/quickref/
- **GDS Service Manual**: https://www.gov.uk/service-manual
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

## Support

For issues or questions:

- Create an issue in the project repository
- Contact the development team
- Review the troubleshooting section above

**Version**: 1.0.0 | **Last Updated**: 2025-10-21
