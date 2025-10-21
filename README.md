# GOV.UK Public Services Status Monitor

A WCAG 2.2 AAA compliant status page for monitoring UK government public service health and availability.

## Overview

This application provides real-time visibility into the operational status of UK government digital services and their underlying infrastructure. It resembles services like Downdetector but is specifically designed for government services with strict accessibility, performance, and design compliance requirements.

## Key Features

- **Real-time Health Monitoring**: HTTP(S) health checks with configurable intervals and validation
- **GOV.UK Design System**: Fully compliant with GDS design patterns and components
- **WCAG 2.2 AAA Accessibility**: Highest accessibility standard for maximum inclusivity
- **Static Site Generation**: High-performance static HTML pages using Eleventy
- **Historical Data Tracking**: CSV-based historical performance records
- **JSON API**: Machine-readable current status endpoint for integrations
- **Progressive Enhancement**: Works without JavaScript, enhanced with it
- **Extensible Architecture**: Pluggable health check probes and storage backends

## Project Status

🚧 **Work in Progress** - Currently in planning and design phase

**Current Phase**: Implementation planning (Phase 1 complete)
- ✅ Feature specification with comprehensive requirements
- ✅ Technology stack research and validation
- ✅ Data model and API contract design
- ✅ Constitution compliance verification
- ⏳ Task breakdown and implementation (next step)

## Technology Stack

- **Language**: TypeScript 5.x with Node.js 22+
- **Static Site Generator**: Eleventy v3+
- **GOV.UK Integration**: govuk-eleventy-plugin v4+
- **Health Checks**: Native Fetch API (zero dependencies)
- **Historical Storage**: CSV files (extensible to databases)
- **Logging**: Pino (structured JSON logging)
- **Testing**: Jest, Playwright, axe-core, Pa11y

## Documentation

### Planning Documents (Feature 001)

- [Feature Specification](specs/001-govuk-status-monitor/spec.md) - Requirements and user stories
- [Implementation Plan](specs/001-govuk-status-monitor/plan.md) - Architecture and design decisions
- [Technology Research](specs/001-govuk-status-monitor/research.md) - Stack validation and best practices
- [Data Model](specs/001-govuk-status-monitor/data-model.md) - Entity definitions and schemas
- [API Contract](specs/001-govuk-status-monitor/contracts/status-api.openapi.yaml) - OpenAPI specification
- [Developer Quickstart](specs/001-govuk-status-monitor/quickstart.md) - Setup and development guide

### Project Constitution

This project follows strict development principles defined in [.specify/memory/constitution.md](.specify/memory/constitution.md):

1. **GDS Design System Compliance** (NON-NEGOTIABLE)
2. **Accessibility-First Development** (WCAG 2.2 Level AA minimum, AAA target)
3. **Test-Driven Development** (TDD required, 80% coverage minimum)
4. **Progressive Enhancement** (must work without JavaScript)
5. **Performance Budgets** (FCP <1.8s, LCP <2.5s, page weight limits)
6. **Component Quality Standards** (code style, documentation, security)
7. **User Research & Data-Driven Decisions** (measurable success criteria)

## Configuration

Services are configured via YAML:

```yaml
settings:
  check_interval: 60        # Health check interval (seconds)
  warning_threshold: 2      # Latency threshold for DEGRADED state
  timeout: 5                # Timeout for FAILED state

pings:
  - name: "GOV.UK Homepage"
    protocol: HTTPS
    method: GET
    resource: "https://www.gov.uk"
    tags: ["central government", "core services"]
    expected:
      status: 200
      text: "Welcome to GOV.UK"
```

## Development Workflow

### Prerequisites

- Node.js 22.11.0+ (LTS)
- npm 10+
- TypeScript 5.8+

### Quick Start

```bash
# Install dependencies
npm install

# Validate configuration
npm run validate-config

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

See [Developer Quickstart Guide](specs/001-govuk-status-monitor/quickstart.md) for detailed instructions.

### Test-Driven Development

Following constitutional principle III, all development uses TDD:

```bash
# 1. Write failing test
npm run test:watch

# 2. Implement feature

# 3. Test passes - refactor
```

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     Background Service                       │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐     │
│  │   YAML     │───▶│   Health    │───▶│   CSV File   │     │
│  │   Config   │    │   Checker   │    │   Writer     │     │
│  └────────────┘    └─────────────┘    └──────────────┘     │
│                            │                                 │
│                            ▼                                 │
│                    ┌──────────────┐                          │
│                    │  _data/      │                          │
│                    │services.json │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Eleventy Static Generator                  │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐     │
│  │  Nunjucks  │───▶│  GOV.UK     │───▶│  _site/      │     │
│  │ Templates  │    │  Plugin     │    │  *.html      │     │
│  └────────────┘    └─────────────┘    │  api/*.json  │     │
│                                        └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
├── src/                 # TypeScript source code
│   ├── models/          # Data models
│   ├── services/        # Business logic
│   ├── lib/             # Utilities
│   └── cli/             # CLI entry point
├── _includes/           # Eleventy templates (Nunjucks)
├── _data/               # Eleventy data files
├── _site/               # Generated static site (output)
├── tests/               # Test files (unit, integration, E2E)
├── specs/               # Feature specifications and planning
└── config.yaml          # Service configuration
```

## API

### JSON Status API

**Endpoint**: `GET /api/status.json`

Returns current health status for all monitored services.

**Response** (example):
```json
[
  {
    "name": "GOV.UK Verify",
    "status": "PASS",
    "latency_ms": 120,
    "last_check_time": "2025-10-21T14:30:00.000Z",
    "tags": ["authentication", "identity"],
    "http_status_code": 200,
    "failure_reason": ""
  }
]
```

Full API specification: [OpenAPI Contract](specs/001-govuk-status-monitor/contracts/status-api.openapi.yaml)

### Historical Data

Access via CSV file:
```csv
timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-10-21T14:30:00.000Z,GOV.UK Verify,PASS,120,200,,uuid
```

## Accessibility

This project targets **WCAG 2.2 Level AAA** compliance:

- ✅ Enhanced color contrast ratios (7:1 for normal text, 4.5:1 for large text)
- ✅ Comprehensive ARIA labels and landmarks
- ✅ Full keyboard navigation support
- ✅ Screen reader compatibility (NVDA, JAWS, VoiceOver)
- ✅ Clear focus indicators
- ✅ No reliance on color alone for information

Automated testing with axe-core and Pa11y ensures continuous compliance.

## Performance

Performance budgets enforced via Lighthouse CI:

- **First Contentful Paint (FCP)**: < 1.8 seconds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Time to Interactive (TTI)**: < 3.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Total Blocking Time (TBT)**: < 300ms

Page weight limits:
- HTML: < 14KB (compressed)
- CSS: < 50KB (compressed)
- JavaScript: < 100KB (compressed, optional enhancement only)

## Security

- Server-side validation of all configuration
- No user input in initial version
- Automated security scanning (npm audit)
- Content Security Policy (CSP) headers
- OWASP Top 10 mitigation strategies
- Structured logging with correlation IDs for audit trails

## Contributing

This project follows the [Specify framework](https://github.com/specify-systems/specify) for systematic feature development.

### Development Process

1. **Specification**: Feature requirements documented in `specs/`
2. **Planning**: Research, design, and architecture in `plan.md`
3. **Implementation**: Test-driven development following constitution
4. **Review**: Code review, accessibility audit, performance testing
5. **Deployment**: Merge to main after all gates pass

## License

MIT License - Copyright (c) 2025 Crown (GDS)

See [LICENSE](LICENSE) for full details.

## Support

For issues, questions, or contributions:
- **GitHub Issues**: https://github.com/co-cddo/status-page/issues
- **Documentation**: See `specs/` directory for detailed planning docs
- **Constitution**: [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Roadmap

### Phase 0: Planning ✅
- [x] Feature specification
- [x] Technology research
- [x] Constitution compliance verification

### Phase 1: Design ✅
- [x] Data model definition
- [x] API contract (OpenAPI)
- [x] Developer quickstart guide
- [x] Project structure

### Phase 2: Implementation 🚧
- [ ] Task breakdown generation
- [ ] Core health check service
- [ ] Eleventy static site generation
- [ ] CSV historical data storage
- [ ] GOV.UK compliant HTML templates
- [ ] JSON API endpoint

### Phase 3: Testing & Refinement
- [ ] Unit test suite (80%+ coverage)
- [ ] Integration tests
- [ ] E2E tests (Playwright)
- [ ] Accessibility audit (WCAG 2.2 AAA)
- [ ] Performance optimization
- [ ] Security review

### Phase 4: Deployment
- [ ] Production configuration
- [ ] CI/CD pipeline setup
- [ ] Monitoring and observability
- [ ] Documentation finalization
- [ ] Initial service launch

---

**Built with** ❤️ **for public service by Crown (GDS)**
