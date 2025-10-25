# E2E Tests for User Story 1 (Status Page)

This directory contains comprehensive end-to-end tests for the GOV.UK Status Monitor application
using Playwright.

## Test Files

### 1. `status-page.spec.ts` (T039a)

**Purpose**: Validate status page display, service list rendering, and sorting

**Coverage**:

- Page title verification ("GOV.UK service status")
- Meta refresh tag presence and configuration
- Page generation timestamp display (semantic HTML with `<time>` elements)
- Service list display with all configured services
- Service sorting by status priority (FAIL → DEGRADED → PASS → PENDING)
- Service information display (name, status indicator, latency, HTTP code, failure reason)
- Status-specific displays:
  - FAIL: Shows failure reason
  - DEGRADED: Shows latency exceeding threshold
  - PASS: Shows latency and HTTP status
  - PENDING: Shows "not yet checked" state
- GOV.UK Design System component usage
- Semantic HTML structure with ARIA landmarks
- Accessibility features (skip links, ARIA labels, proper heading hierarchy)
- Responsive design (mobile, tablet, desktop viewports)
- Alert banners for failed/operational services

**Test Count**: 30+ test cases across 3 describe blocks

**Requirements Validated**:

- FR-021: Page title and branding
- FR-023: Service sorting by status
- FR-026: Service display priority
- FR-027: Service information display
- FR-027a: Failure reason display
- FR-029: Meta refresh tag
- FR-029a: Accessibility compliance
- FR-029b: Timestamp display formats

### 2. `self-contained-html.spec.ts` (T044c)

**Purpose**: Validate HTML self-containment, asset inlining, and network isolation

**Coverage**:

- HTML file size validation (< 5MB target)
- CSS inlining verification (all styles in `<style>` tags)
- JavaScript inlining verification (all scripts in `<script>` tags)
- Image embedding as base64 data URIs
- Zero external resource references
- GOV.UK Design System asset inlining
- Network isolation testing (zero external requests)
- Functionality without network connectivity
- Functionality with JavaScript disabled
- Progressive enhancement verification
- HTML5 validity
- Resource type verification (no external stylesheets, scripts, images, fonts)
- Compression ratio estimation

**Test Count**: 25+ test cases across 3 describe blocks

**Requirements Validated**:

- FR-021: Self-contained HTML requirement
- Single HTTP request architecture
- Offline functionality
- Progressive enhancement

### 3. `deployment.spec.ts` (T025a - US7)

**Purpose**: Validate deployed GitHub Pages site accessibility and functionality

**Coverage**:

- GitHub Pages URL accessibility
- Page load performance (< 2 seconds)
- Self-contained HTML (no external requests)
- API endpoints (status.json, history.csv)
- Service list display
- GOV.UK Design System styling
- Responsive design
- JavaScript-free functionality
- Security headers
- HTML file size
- MIME types
- Recovery scenarios (missing CSV, empty services)

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run Specific Test File

```bash
pnpm test:e2e tests/e2e/status-page.spec.ts
pnpm test:e2e tests/e2e/self-contained-html.spec.ts
pnpm test:e2e tests/e2e/deployment.spec.ts
```

### Run in Headed Mode (for debugging)

```bash
pnpm exec playwright test tests/e2e/status-page.spec.ts --headed
```

### Run with UI Mode

```bash
pnpm exec playwright test tests/e2e/status-page.spec.ts --ui
```

## Test Environment

### Prerequisites

- **Build required**: Tests expect `_site/index.html` or `output/index.html` to exist
- **Local server**: Some tests use `http://localhost:8080` as fallback
- **GitHub Pages**: Deployment tests use `GITHUB_PAGES_URL` environment variable

### Test Data

Tests use file:// protocol to load generated HTML directly, ensuring tests validate the actual build
output.

## TDD Workflow

**IMPORTANT**: These tests were written BEFORE implementation (Test-Driven Development).

1. **Tests written first** (T039a, T044c) ✅
2. **Tests MUST fail** before implementation ✅
3. **Implementation** (T039, T044) ⏳
4. **Tests MUST pass** after implementation ⏳

Current status: **Tests failing as expected** (implementation not yet complete)

## Browser Coverage

Tests run against multiple browsers per `playwright.config.ts`:

- **Chromium** (Desktop Chrome)
- **Firefox** (Desktop Firefox)
- **WebKit** (Desktop Safari)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 13)

## Accessibility Testing

Status page tests include basic accessibility checks:

- Semantic HTML structure
- ARIA labels and landmarks
- Skip links for keyboard navigation
- Proper heading hierarchy
- Time elements with datetime attributes

**Note**: Comprehensive WCAG 2.2 AAA testing is in `tests/accessibility/wcag-aaa.spec.ts` (T039b)

## Performance Considerations

Self-contained HTML tests verify:

- File size < 5MB (critical threshold)
- Compression ratio > 2x (gzip/brotli)
- Whitespace ratio < 30%
- No excessive bloat from inlined assets

## Network Isolation

Key validation: Self-contained HTML works without network access

- Loads from `file://` protocol
- Zero external HTTP requests
- Functions with JavaScript disabled
- Functions offline (network disconnected)

## Troubleshooting

### Tests Fail with "No output HTML file found"

**Solution**: Run build first:

```bash
pnpm run build:eleventy
```

### Tests Timeout

**Solution**: Increase timeout in test file or command:

```bash
pnpm exec playwright test --timeout=60000
```

### WebServer Errors

**Solution**: Playwright config tries to start dev server. Ensure `src/index.ts` exists or disable
webServer in config.

## Future Enhancements

- [ ] Add visual regression testing (Playwright screenshots)
- [ ] Add network throttling tests (3G simulation)
- [ ] Add performance budgets with Lighthouse CI integration
- [ ] Add comprehensive keyboard navigation tests
- [ ] Add screen reader compatibility tests

## Related Documentation

- [Playwright Configuration](../../playwright.config.ts)
- [Tasks.md - Phase 4A](../../specs/001-govuk-status-monitor/tasks.md#phase-4a-user-story-1-tests-tdd---write-first-)
- [Specification](../../specs/001-govuk-status-monitor/spec.md)
- [Constitution](../../.specify/memory/constitution.md)

## Test Metrics

- **Total test files**: 3
- **Total test cases**: 80+
- **Coverage**: Status page display, self-containment, deployment
- **Browser compatibility**: 5 browsers
- **TDD compliance**: 100% (tests written first)
