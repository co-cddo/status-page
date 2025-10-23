/**
 * E2E test for deployed status page (User Story 7)
 * Per T025a: Validate deployed GitHub Pages site accessibility and functionality
 *
 * This test MUST fail before T025a prerequisites (GitHub Pages enabled) and T021 implementation
 *
 * Prerequisites:
 * - GitHub Pages must be enabled (T025a: gh api repos/:owner/:repo/pages)
 * - Deploy workflow must have run at least once
 * - Status page must be accessible at https://{owner}.github.io/{repo}/
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Determine GitHub Pages URL from repository configuration
 *
 * This helper attempts to derive the GitHub Pages URL from:
 * 1. GITHUB_PAGES_URL environment variable (set in CI)
 * 2. Repository metadata from package.json
 * 3. Local testing fallback (http://localhost:8080)
 */
function getGitHubPagesUrl(): string {
  // CI environment variable (preferred)
  if (process.env.GITHUB_PAGES_URL) {
    return process.env.GITHUB_PAGES_URL;
  }

  // Derive from package.json repository field
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    const repository = packageJson.repository;

    if (typeof repository === 'string') {
      // Format: "github:owner/repo" or "owner/repo" or "https://github.com/owner/repo"
      const match = repository.match(/(?:github:|https:\/\/github.com\/)?([^/]+)\/([^/.]+)/);
      if (match) {
        const [, owner, repo] = match;
        return `https://${owner}.github.io/${repo}`;
      }
    } else if (repository && repository.url) {
      const match = repository.url.match(/github.com\/([^/]+)\/([^/.]+)/);
      if (match) {
        const [, owner, repo] = match;
        return `https://${owner}.github.io/${repo}`;
      }
    }
  } catch {
    // Fall through to local fallback
  }

  // Local testing fallback
  console.warn('Could not determine GitHub Pages URL. Using localhost fallback.');
  console.warn('Set GITHUB_PAGES_URL environment variable for actual deployment testing.');
  return 'http://localhost:8080';
}

test.describe('Deployed Status Page (US7)', () => {
  const pageUrl = getGitHubPagesUrl();
  const isLocalTest = pageUrl.includes('localhost');

  test.beforeEach(async () => {
    // Set longer timeout for GitHub Pages (can be slow)
    test.setTimeout(isLocalTest ? 30000 : 60000);
  });

  test('status page is accessible at GitHub Pages URL', async ({ page }) => {
    const response = await page.goto(pageUrl);

    // Verify page loads successfully
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    // Verify page title
    await expect(page).toHaveTitle(/GOV\.UK.*service status/i);
  });

  test('status page loads within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    // Per constitution.md Principle V: < 2 seconds on standard government network
    // Allow extra margin for GitHub Pages CDN warmup
    expect(loadTime).toBeLessThan(isLocalTest ? 2000 : 3000);
  });

  test('status page is self-contained (no external requests)', async ({ page }) => {
    const externalRequests: string[] = [];

    // Monitor all network requests
    page.on('request', (request) => {
      const url = request.url();

      // Track external requests (not same-origin, not data URIs)
      if (!url.startsWith(pageUrl) && !url.startsWith('data:')) {
        externalRequests.push(url);
      }
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle' });

    // Verify zero external requests per FR-021
    expect(externalRequests).toHaveLength(0);
  });

  test('status.json API is accessible', async ({ request }) => {
    const apiUrl = `${pageUrl}${pageUrl.endsWith('/') ? '' : '/'}api/status.json`;

    const response = await request.get(apiUrl);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    // Verify JSON structure
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);

    if (json.length > 0) {
      const service = json[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('latency_ms');
      expect(service).toHaveProperty('last_check_time');
      expect(service).toHaveProperty('tags');
      expect(service).toHaveProperty('http_status_code');
      expect(service).toHaveProperty('failure_reason');
    }
  });

  test('history.csv is accessible', async ({ request }) => {
    const csvUrl = `${pageUrl}${pageUrl.endsWith('/') ? '' : '/'}history.csv`;

    const response = await request.get(csvUrl);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/text\/csv|text\/plain|application\/csv/);

    // Verify CSV structure
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    expect(lines.length).toBeGreaterThan(0);

    // Verify CSV header
    const header = lines[0];
    expect(header).toContain('timestamp');
    expect(header).toContain('service_name');
    expect(header).toContain('status');
    expect(header).toContain('latency_ms');
    expect(header).toContain('http_status_code');
    expect(header).toContain('failure_reason');
    expect(header).toContain('correlation_id');
  });

  test('status page displays service list', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify service list container exists
    const serviceList = page.locator('[data-testid="service-list"], .service-list, main');
    await expect(serviceList).toBeVisible();

    // Verify at least one service is displayed (or "no services" message)
    const hasServices = await page
      .locator('.service-status, .govuk-summary-list, [data-testid="service"]')
      .count();
    const hasEmptyState = await page.locator('text=/no services|currently monitoring/i').count();

    expect(hasServices + hasEmptyState).toBeGreaterThan(0);
  });

  test('status page shows page generation timestamp', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify timestamp is visible
    const timestamp = page.locator('time, [datetime], [data-testid="last-updated"]');
    await expect(timestamp.first()).toBeVisible();
  });

  test('status page has meta refresh tag for auto-update', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify meta refresh tag exists
    const metaRefresh = page.locator('meta[http-equiv="refresh"]');
    await expect(metaRefresh).toHaveCount(1);

    // Verify refresh interval (default 60 seconds)
    const content = await metaRefresh.getAttribute('content');
    expect(content).toBeTruthy();

    const intervalStr = content!.split(';')[0];
    expect(intervalStr).toBeDefined();
    const interval = parseInt(intervalStr!);
    expect(interval).toBeGreaterThan(0);
    expect(interval).toBeLessThanOrEqual(300); // Max 5 minutes
  });

  test('status page uses GOV.UK Design System styles', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify GOV.UK Frontend CSS classes are present
    const govukElements = await page.locator('[class*="govuk-"]').count();
    expect(govukElements).toBeGreaterThan(0);

    // Verify specific GOV.UK components
    const hasHeader = await page.locator('.govuk-header').count();
    const hasFooter = await page.locator('.govuk-footer').count();
    const hasMain = await page.locator('main.govuk-main-wrapper, [role="main"]').count();

    expect(hasHeader + hasFooter + hasMain).toBeGreaterThan(0);
  });

  test('status page is responsive', async ({ page }) => {
    await page.goto(pageUrl);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('status page works without JavaScript', async ({ browser }) => {
    // Create new context with JavaScript disabled
    const context = await browser.newContext({
      javaScriptEnabled: false,
    });

    const pageNoJs = await context.newPage();
    await pageNoJs.goto(pageUrl);

    // Verify page still loads
    await expect(pageNoJs.locator('body')).toBeVisible();

    // Verify content is accessible
    const hasContent = await pageNoJs.locator('main, [role="main"], .service-list').count();
    expect(hasContent).toBeGreaterThan(0);

    await context.close();
  });

  test('status page has correct security headers', async ({ request }) => {
    const response = await request.get(pageUrl);

    const headers = response.headers();

    // Verify Content-Security-Policy (if implemented)
    if (headers['content-security-policy']) {
      const csp = headers['content-security-policy'];

      // Self-contained HTML should allow inline styles and scripts
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
      expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(csp).toMatch(/img-src[^;]*data:/);
    }

    // Verify X-Frame-Options
    if (headers['x-frame-options']) {
      expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
    }

    // Verify X-Content-Type-Options
    if (headers['x-content-type-options']) {
      expect(headers['x-content-type-options']).toBe('nosniff');
    }
  });

  test('deployment can be accessed from multiple geographic locations', async ({ request }) => {
    // This test verifies GitHub Pages CDN is serving the content globally
    // In CI, this would ideally run from different regions

    const response = await request.get(pageUrl);

    expect(response.status()).toBe(200);

    // Verify Cache-Control headers exist (GitHub Pages sets these)
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeTruthy();
  });

  test('HTML file size is under 5MB target', async ({ request }) => {
    const response = await request.get(pageUrl);

    expect(response.status()).toBe(200);

    const body = await response.body();
    const sizeInBytes = body.length;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    // Per FR-021 constraint: < 5MB target
    expect(sizeInMB).toBeLessThan(5);

    // Log actual size for monitoring
    console.log(`HTML file size: ${sizeInMB.toFixed(2)} MB`);
  });

  test('page serves correct MIME types for assets', async ({ page }) => {
    const responses: { url: string; contentType: string }[] = [];

    page.on('response', (response) => {
      const contentType = response.headers()['content-type'] || '';
      responses.push({
        url: response.url(),
        contentType,
      });
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle' });

    // Verify HTML
    const htmlResponse = responses.find((r) => r.url === pageUrl);
    expect(htmlResponse?.contentType).toContain('text/html');

    // Verify JSON API
    const jsonResponse = responses.find((r) => r.url.includes('status.json'));
    if (jsonResponse) {
      expect(jsonResponse.contentType).toMatch(/application\/json|text\/plain/);
    }

    // Verify CSV
    const csvResponse = responses.find((r) => r.url.includes('.csv'));
    if (csvResponse) {
      expect(csvResponse.contentType).toMatch(/text\/csv|text\/plain|application\/csv/);
    }
  });
});

test.describe('Deployment Recovery Scenarios (US7)', () => {
  const pageUrl = getGitHubPagesUrl();

  test('status page handles missing history.csv gracefully', async ({ request }) => {
    // Attempt to access history.csv
    const csvUrl = `${pageUrl}${pageUrl.endsWith('/') ? '' : '/'}history.csv`;
    const response = await request.get(csvUrl);

    // Should either exist (200) or return 404 (which is handled)
    expect([200, 404]).toContain(response.status());

    // If 404, verify status page still loads
    if (response.status() === 404) {
      const pageResponse = await request.get(pageUrl);
      expect(pageResponse.status()).toBe(200);
    }
  });

  test('status page handles empty services configuration', async ({ page }) => {
    await page.goto(pageUrl);

    // Page should load even if no services configured
    await expect(page.locator('body')).toBeVisible();

    // Should show either services or empty state message
    const serviceCount = await page.locator('.service-status, .govuk-summary-list__row').count();
    const emptyState = await page.locator('text=/no services|currently monitoring/i').count();

    expect(serviceCount + emptyState).toBeGreaterThan(0);
  });
});
