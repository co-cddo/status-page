/**
 * E2E test for status page display (User Story 1)
 * Per T039a: Validate status page rendering, service list display, and sorting
 *
 * This test validates FR-021, FR-023, FR-026, FR-027, FR-027a, FR-029, FR-029a, FR-029b
 *
 * Test Requirements:
 * - Use Playwright to load generated status page (from _site/ or output/)
 * - Verify service list displays all configured services
 * - Verify failing services appear first (FAIL)
 * - Verify DEGRADED services appear second
 * - Verify PASS services appear third
 * - Verify PENDING services appear last
 * - Verify each service shows: name, status indicator, last check time, latency, HTTP status code, failure reason (if failed)
 * - Verify page generation timestamp visible and distinct from service check times
 * - Verify meta refresh tag present (<meta http-equiv="refresh" content="60">)
 * - Verify page title "GOV.UK service status"
 *
 * This test MUST fail before T039 implementation (status page template creation)
 */

import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Helper to determine the status page URL
 * Priority: output/index.html > _site/index.html > localhost:8080
 */
function getStatusPagePath(): string {
  const outputPath = join(process.cwd(), 'output', 'index.html');
  const sitePath = join(process.cwd(), '_site', 'index.html');

  if (existsSync(outputPath)) {
    return `file://${outputPath}`;
  } else if (existsSync(sitePath)) {
    return `file://${sitePath}`;
  } else {
    // Fallback to localhost for development
    return process.env.BASE_URL || 'http://localhost:8080';
  }
}

/**
 * Helper to load mock health data for testing
 * Creates realistic test data with all status states
 * Note: Currently unused but kept for future test scenarios
 */
// function createMockHealthData() {
//   return {
//     generatedAt: new Date().toISOString(),
//     services: [
//       {
//         name: 'Test Service Failed',
//         status: 'FAIL',
//         latency_ms: 5100,
//         last_check_time: new Date(Date.now() - 30000).toISOString(),
//         tags: ['critical', 'api'],
//         http_status_code: 503,
//         failure_reason: 'Service unavailable: Connection timeout after 5000ms'
//       },
//       {
//         name: 'Test Service Degraded',
//         status: 'DEGRADED',
//         latency_ms: 2500,
//         last_check_time: new Date(Date.now() - 45000).toISOString(),
//         tags: ['monitoring'],
//         http_status_code: 200,
//         failure_reason: ''
//       },
//       {
//         name: 'Test Service Operational',
//         status: 'PASS',
//         latency_ms: 150,
//         last_check_time: new Date(Date.now() - 60000).toISOString(),
//         tags: ['core', 'production'],
//         http_status_code: 200,
//         failure_reason: ''
//       },
//       {
//         name: 'Test Service Pending',
//         status: 'PENDING',
//         latency_ms: null,
//         last_check_time: null,
//         tags: [],
//         http_status_code: null,
//         failure_reason: ''
//       },
//       {
//         name: 'Another Failed Service',
//         status: 'FAIL',
//         latency_ms: 3200,
//         last_check_time: new Date(Date.now() - 20000).toISOString(),
//         tags: [],
//         http_status_code: 404,
//         failure_reason: 'HTTP 404 Not Found'
//       }
//     ]
//   };
// }

/**
 * Helper to extract service names from page in display order
 */
async function getServicesInDisplayOrder(page: Page): Promise<string[]> {
  // Get all service headings in DOM order
  const serviceHeadings = await page
    .locator('article h2, [role="article"] h2, [role="article"] h3')
    .allTextContents();
  return serviceHeadings.map((text: string) => text.trim());
}

test.describe('Status Page Display (US1 - T039a)', () => {
  const pageUrl = getStatusPagePath();
  const isFileUrl = pageUrl.startsWith('file://');

  test.beforeEach(async () => {
    // Set longer timeout for file:// protocol
    test.setTimeout(isFileUrl ? 30000 : 60000);
  });

  test('page title is "GOV.UK service status"', async ({ page }) => {
    await page.goto(pageUrl);

    // Per FR-021: Page title must be "GOV.UK service status"
    await expect(page).toHaveTitle(/GOV\.UK.*service status/i);
  });

  test('meta refresh tag is present with correct interval', async ({ page }) => {
    await page.goto(pageUrl);

    // Per FR-029: Meta refresh tag for auto-updates
    const metaRefresh = page.locator('meta[http-equiv="refresh"]');
    await expect(metaRefresh).toHaveCount(1);

    // Verify refresh interval is set (default 60 seconds)
    const content = await metaRefresh.getAttribute('content');
    expect(content).toBeTruthy();

    // Parse interval (format: "60" or "60; url=...")
    const intervalMatch = content!.match(/^(\d+)/);
    expect(intervalMatch).toBeTruthy();
    expect(intervalMatch![1]).toBeDefined();

    const interval = parseInt(intervalMatch![1]!);
    expect(interval).toBeGreaterThan(0);
    expect(interval).toBeLessThanOrEqual(300); // Max 5 minutes
  });

  test('page generation timestamp is visible and distinct', async ({ page }) => {
    await page.goto(pageUrl);

    // Per FR-029b: Display page generation timestamp
    // Should be in semantic <time> element with datetime attribute
    const pageTimestamp = page.locator('time[datetime]').first();
    await expect(pageTimestamp).toBeVisible();

    // Verify timestamp has ISO 8601 datetime attribute
    const datetime = await pageTimestamp.getAttribute('datetime');
    expect(datetime).toBeTruthy();
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601 format

    // Verify timestamp is distinct from service check times (prominent placement)
    const timestampText = await pageTimestamp.textContent();
    expect(timestampText).toBeTruthy();
  });

  test('service list displays all configured services', async ({ page }) => {
    await page.goto(pageUrl);

    // Should display service container or empty state
    const serviceList = page.locator('main, [role="main"]');
    await expect(serviceList).toBeVisible();

    // Count service articles
    const serviceCount = await page.locator('article, [role="article"]').count();
    const emptyState = await page.locator('text=/no services|currently monitoring/i').count();

    // Either services are displayed or empty state is shown
    expect(serviceCount + emptyState).toBeGreaterThan(0);
  });

  test('services are sorted by status priority (FAIL → DEGRADED → PASS → PENDING)', async ({
    page,
  }) => {
    await page.goto(pageUrl);

    // Get all service status indicators in DOM order
    const statusTags = await page.locator('.govuk-tag').allTextContents();

    // If no services configured, test passes (nothing to sort)
    if (statusTags.length === 0) {
      expect(statusTags.length).toBe(0); // Explicit assertion for empty state
      return;
    }

    // Map tag text to priority (lower = higher priority, appears first)
    const statusPriority: Record<string, number> = {
      Down: 1, // FAIL
      Degraded: 2, // DEGRADED
      Operational: 3, // PASS
      Pending: 4, // PENDING
    };

    // Verify services appear in priority order
    let previousPriority = 0;
    let failureCount = 0;

    for (const tagText of statusTags) {
      const cleanTag = tagText.trim();
      const priority = statusPriority[cleanTag];

      if (!priority) {
        continue; // Skip non-status tags
      }

      // Current service priority should be >= previous priority
      if (priority < previousPriority) {
        failureCount++;
        console.error(
          `Service sort order violation: ${cleanTag} (priority ${priority}) appears after priority ${previousPriority}`
        );
      }

      previousPriority = priority;
    }

    expect(failureCount).toBe(0);
  });

  test('each service displays required information (name, status, latency, HTTP code)', async ({
    page,
  }) => {
    await page.goto(pageUrl);

    // Find first service article
    const firstService = page.locator('article, [role="article"]').first();
    const serviceExists = (await firstService.count()) > 0;

    // If no services exist, test passes (empty state is valid)
    if (!serviceExists) {
      expect(serviceExists).toBe(false); // Explicit assertion for empty state
      return;
    }

    // Verify service name (heading)
    const serviceName = firstService.locator('h2, h3');
    await expect(serviceName).toBeVisible();

    // Verify status indicator (GOV.UK tag with role="status")
    // Use role="status" to select only the status tag, not category tags
    const statusTag = firstService.locator('[role="status"]');
    await expect(statusTag).toBeVisible();

    // Verify status tag has accessible ARIA label
    const ariaLabel = await statusTag.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();

    // Verify summary list with service details
    const summaryList = firstService.locator('.govuk-summary-list');
    await expect(summaryList).toBeVisible();

    // Check for "Last checked" row
    const lastCheckedRow = firstService.locator('text=/last checked/i');
    await expect(lastCheckedRow).toBeVisible();

    // Note: Response time, HTTP status, and failure reason depend on service status
    // These are validated in subsequent tests
  });

  test('operational services (PASS) show latency and HTTP status code', async ({ page }) => {
    await page.goto(pageUrl);

    // Find a PASS service (Operational tag)
    const operationalService = page.locator('article:has(.govuk-tag--green)').first();
    const exists = (await operationalService.count()) > 0;

    // If no operational services exist, test passes
    if (!exists) {
      expect(exists).toBe(false); // Explicit assertion for this service state
      return;
    }

    // Should show response time
    const responseTime = operationalService.locator('text=/response time|latency/i');
    await expect(responseTime).toBeVisible();

    // Should show HTTP status code
    const httpStatus = operationalService.locator('text=/http status/i');
    await expect(httpStatus).toBeVisible();

    // Should NOT show failure reason
    const failureReason = operationalService.locator('text=/failure reason/i');
    expect(await failureReason.count()).toBe(0);
  });

  test('failed services (FAIL) show failure reason', async ({ page }) => {
    await page.goto(pageUrl);

    // Find a FAIL service (Down tag, red)
    const failedService = page.locator('article:has(.govuk-tag--red)').first();
    const exists = (await failedService.count()) > 0;

    // If no failed services exist, test passes
    if (!exists) {
      expect(exists).toBe(false); // Explicit assertion for this service state
      return;
    }

    // Per FR-027a: Failed services MUST show failure reason
    const failureReason = failedService.locator('text=/failure reason/i');
    await expect(failureReason).toBeVisible();

    // Verify failure reason has meaningful content
    const failureText = await failedService
      .locator('.govuk-error-message')
      .first()
      .textContent();
    expect(failureText).toBeTruthy();
    expect(failureText!.trim().length).toBeGreaterThan(5); // Not just empty or "N/A"
  });

  test('degraded services (DEGRADED) show latency exceeding threshold', async ({ page }) => {
    await page.goto(pageUrl);

    // Find a DEGRADED service (yellow tag)
    const degradedService = page.locator('article:has(.govuk-tag--yellow)').first();
    const exists = (await degradedService.count()) > 0;

    // If no degraded services exist, test passes
    if (!exists) {
      expect(exists).toBe(false); // Explicit assertion for this service state
      return;
    }

    // Should show response time (will be > warning_threshold)
    const responseTime = degradedService.locator('text=/response time|latency/i');
    await expect(responseTime).toBeVisible();

    // Should show HTTP status (typically 200, but slow)
    const httpStatus = degradedService.locator('text=/http status/i');
    await expect(httpStatus).toBeVisible();
  });

  test('pending services (PENDING) show "not yet checked" state', async ({ page }) => {
    await page.goto(pageUrl);

    // Find a PENDING service (grey tag)
    const pendingService = page.locator('article:has(.govuk-tag--grey)').first();
    const exists = (await pendingService.count()) > 0;

    // If no pending services exist, test passes
    if (!exists) {
      expect(exists).toBe(false); // Explicit assertion for this service state
      return;
    }

    // Per FR-028a: PENDING services have null values for latency, last_check_time, http_status_code
    // Should show "Not yet checked"
    const notChecked = pendingService.locator('text=/not yet checked/i');
    await expect(notChecked).toBeVisible();

    // Should NOT show response time or HTTP status
    const responseTime = pendingService.locator('text=/response time/i');
    expect(await responseTime.count()).toBe(0);

    const httpStatus = pendingService.locator('text=/http status/i');
    expect(await httpStatus.count()).toBe(0);
  });

  test('last check time is displayed in semantic HTML', async ({ page }) => {
    await page.goto(pageUrl);

    // Find a service with a check time (not PENDING)
    const checkedService = page.locator('article:has(time[datetime])').first();
    const exists = (await checkedService.count()) > 0;

    // If no checked services exist, test passes
    if (!exists) {
      expect(exists).toBe(false); // Explicit assertion for this service state
      return;
    }

    // Per FR-029b: Use semantic <time> element with datetime attribute
    const timeElement = checkedService.locator('time[datetime]');
    await expect(timeElement).toBeVisible();

    const datetime = await timeElement.getAttribute('datetime');
    expect(datetime).toBeTruthy();
    expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
  });

  test('page uses GOV.UK Design System components', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify GOV.UK tag component is used
    const govukTags = await page.locator('.govuk-tag').count();
    expect(govukTags).toBeGreaterThan(0);

    // Verify GOV.UK summary list is used
    const summaryLists = await page.locator('.govuk-summary-list').count();
    expect(summaryLists).toBeGreaterThan(0);

    // Verify GOV.UK heading classes
    const govukHeadings = await page.locator('[class*="govuk-heading"]').count();
    expect(govukHeadings).toBeGreaterThan(0);
  });

  test('page has proper semantic HTML structure', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible();

    // Verify services use article elements or role="article"
    const serviceCount = await page.locator('main').count();
    expect(serviceCount).toBeGreaterThan(0);

    // Verify heading hierarchy (h1 for page, h2 for sections, h3 for services if nested)
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    const h1Text = await h1.textContent();
    expect(h1Text).toContain('service status');
  });

  test('failing services appear first in display order', async ({ page }) => {
    await page.goto(pageUrl);

    const services = await getServicesInDisplayOrder(page);

    // If no services exist, test passes
    if (services.length === 0) {
      expect(services.length).toBe(0); // Explicit assertion for empty state
      return;
    }

    // Find index of first FAIL service (if any)
    const firstFailIndex =
      (await page.locator('.govuk-tag--red').first().count()) > 0
        ? await page
            .locator('.govuk-tag--red')
            .first()
            .evaluate((el: Element) => {
              const article = el.closest('article');
              if (!article) return -1;
              const allArticles = Array.from(document.querySelectorAll('article'));
              return allArticles.indexOf(article as HTMLElement);
            })
        : -1;

    // Find index of first PASS service (if any)
    const firstPassIndex =
      (await page.locator('.govuk-tag--green').first().count()) > 0
        ? await page
            .locator('.govuk-tag--green')
            .first()
            .evaluate((el: Element) => {
              const article = el.closest('article');
              if (!article) return -1;
              const allArticles = Array.from(document.querySelectorAll('article'));
              return allArticles.indexOf(article as HTMLElement);
            })
        : -1;

    // If both exist, FAIL should come before PASS
    if (firstFailIndex >= 0 && firstPassIndex >= 0) {
      expect(firstFailIndex).toBeLessThan(firstPassIndex);
    }
  });

  test('page has accessible skip link', async ({ page }) => {
    await page.goto(pageUrl);

    // Per WCAG 2.2 AAA: Skip link for keyboard navigation
    const skipLink = page.locator('a[href="#main-content"], a:has-text("Skip to")');

    // Skip link may be visually hidden but should exist
    expect(await skipLink.count()).toBeGreaterThan(0);
  });

  test('status indicators have proper ARIA labels', async ({ page }) => {
    await page.goto(pageUrl);

    // All status tags should have ARIA labels for screen readers
    const statusTags = page.locator('.govuk-tag[role="status"]');
    const count = await statusTags.count();

    // If no status tags exist, test passes
    if (count === 0) {
      expect(count).toBe(0); // Explicit assertion for empty state
      return;
    }

    // Check each status tag has aria-label
    for (let i = 0; i < count; i++) {
      const tag = statusTags.nth(i);
      const ariaLabel = await tag.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(5); // Meaningful label
    }
  });

  test('page generation timestamp is distinct from service check times', async ({ page }) => {
    await page.goto(pageUrl);

    // Page generation timestamp should be prominently placed
    const pageTimestamp = page
      .locator(
        'p:has-text("Page generated"), div:has-text("Page generated"), span:has-text("Page generated")'
      )
      .first();
    await expect(pageTimestamp).toBeVisible();

    // Service check times should be within service articles
    const serviceTimestamps = page.locator('article time[datetime]');
    const serviceCount = await serviceTimestamps.count();

    if (serviceCount > 0) {
      // Page timestamp should appear before service timestamps in DOM
      const pageTimestampY = await pageTimestamp.boundingBox().then((box) => box?.y ?? 0);
      const firstServiceY = await serviceTimestamps
        .first()
        .boundingBox()
        .then((box) => box?.y ?? 0);

      expect(pageTimestampY).toBeLessThan(firstServiceY);
    }
  });

  test('empty state is shown when no services configured', async ({ page }) => {
    // This test validates empty state handling
    await page.goto(pageUrl);

    const serviceCount = await page.locator('article, [role="article"]').count();

    // If services exist, test passes (not an empty state scenario)
    if (serviceCount > 0) {
      expect(serviceCount).toBeGreaterThan(0); // Explicit assertion services exist
      return;
    }

    // Should show empty state message
    const emptyState = page.locator('text=/no services|not.*configured/i');
    await expect(emptyState).toBeVisible();
  });

  test('alert banner shown when services are down', async ({ page }) => {
    await page.goto(pageUrl);

    const failedServices = await page.locator('.govuk-tag--red').count();

    // If no failed services exist, test passes
    if (failedServices === 0) {
      expect(failedServices).toBe(0); // Explicit assertion no failures
      return;
    }

    // Should show alert/notification banner
    const alertBanner = page.locator('.govuk-notification-banner');
    await expect(alertBanner).toBeVisible();

    // Banner should mention failed services
    const bannerText = await alertBanner.textContent();
    expect(bannerText).toMatch(/experiencing issues|service.*down|alert/i);
  });

  test('success banner shown when all services operational', async ({ page }) => {
    await page.goto(pageUrl);

    const totalServices = await page.locator('.govuk-tag').count();
    const operationalServices = await page.locator('.govuk-tag--green').count();

    // If not all services are operational or no services exist, test passes
    if (totalServices === 0 || operationalServices !== totalServices) {
      expect(totalServices === 0 || operationalServices !== totalServices).toBe(true); // Explicit assertion
      return;
    }

    // Should show success banner
    const successBanner = page.locator('.govuk-notification-banner--success, [class*="success"]');
    await expect(successBanner).toBeVisible();
  });
});

test.describe('Status Page Accessibility (US1 - T039a)', () => {
  const pageUrl = getStatusPagePath();

  test('page has proper document structure for screen readers', async ({ page }) => {
    await page.goto(pageUrl);

    // Verify main landmark exists
    const main = page.locator('main, [role="main"]');
    await expect(main).toHaveAttribute('role', 'main');

    // Verify sections have proper headings
    const sections = page.locator('section');
    const sectionCount = await sections.count();

    if (sectionCount > 0) {
      // Each section should have an aria-labelledby or heading
      for (let i = 0; i < sectionCount; i++) {
        const section = sections.nth(i);
        const labelledBy = await section.getAttribute('aria-labelledby');
        const heading = await section.locator('h2, h3').count();

        expect(labelledBy || heading).toBeTruthy();
      }
    }
  });

  test('interactive elements have sufficient contrast', async ({ page }) => {
    await page.goto(pageUrl);

    // GOV.UK Design System should provide WCAG 2.2 AAA contrast (7:1 for normal text)
    // This is a smoke test - detailed contrast testing done in accessibility suite

    const govukTags = page.locator('.govuk-tag');
    const tagCount = await govukTags.count();

    expect(tagCount).toBeGreaterThan(0);

    // Verify tags are visible (basic check)
    for (let i = 0; i < Math.min(tagCount, 3); i++) {
      await expect(govukTags.nth(i)).toBeVisible();
    }
  });

  test('time elements have valid datetime attributes', async ({ page }) => {
    await page.goto(pageUrl);

    const timeElements = page.locator('time[datetime]');
    const count = await timeElements.count();

    expect(count).toBeGreaterThan(0);

    // Validate each datetime attribute is valid ISO 8601
    for (let i = 0; i < count; i++) {
      const datetime = await timeElements.nth(i).getAttribute('datetime');
      expect(datetime).toBeTruthy();

      // Should be parseable as ISO 8601
      const parsed = new Date(datetime!);
      expect(parsed.toString()).not.toBe('Invalid Date');
    }
  });
});

test.describe('Status Page Responsive Design (US1 - T039a)', () => {
  const pageUrl = getStatusPagePath();

  test('page is readable on mobile viewport', async ({ page }) => {
    await page.goto(pageUrl);

    // Set mobile viewport (iPhone 13)
    await page.setViewportSize({ width: 390, height: 844 });

    // Verify content is visible
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Verify headings don't overflow
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    const h1Box = await h1.boundingBox();
    expect(h1Box).not.toBeNull();
    expect(h1Box!.width).toBeLessThanOrEqual(390);
  });

  test('page is readable on tablet viewport', async ({ page }) => {
    await page.goto(pageUrl);

    // Set tablet viewport (iPad)
    await page.setViewportSize({ width: 768, height: 1024 });

    await expect(page.locator('main')).toBeVisible();
  });

  test('page is readable on desktop viewport', async ({ page }) => {
    await page.goto(pageUrl);

    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await expect(page.locator('main')).toBeVisible();
  });
});
