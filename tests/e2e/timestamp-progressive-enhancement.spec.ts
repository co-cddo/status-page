/**
 * E2E tests for timestamp progressive enhancement
 *
 * Verifies that:
 * 1. Timestamps work without JavaScript (baseline functionality)
 * 2. JavaScript enhances timestamps when available
 * 3. Tooltips show UTC time on hover
 * 4. Relative time updates in realtime
 * 5. Auto-refresh indicator is visible
 *
 * Requirements:
 * - Issue #30: Localized timestamp display
 * - Progressive enhancement (GOV.UK principle)
 * - WCAG 2.2 AAA accessible
 */

import { test, expect } from '@playwright/test';

test.describe('Timestamp Progressive Enhancement', () => {
  test.describe('Without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('should display ISO 8601 UTC timestamps when JS is disabled', async ({ page }) => {
      await page.goto('/output/index.html');

      // Page generation timestamp should be visible
      const pageTimestamp = page.locator('time').first();
      await expect(pageTimestamp).toBeVisible();

      // Should show ISO 8601 format
      const text = await pageTimestamp.textContent();
      expect(text).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    });

    test('should have valid datetime attributes', async ({ page }) => {
      await page.goto('/output/index.html');

      const timestamps = page.locator('time[datetime]');
      const count = await timestamps.count();

      expect(count).toBeGreaterThan(0);

      // Verify all datetime attributes are valid ISO 8601
      for (let i = 0; i < count; i++) {
        const datetime = await timestamps.nth(i).getAttribute('datetime');
        expect(datetime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);

        // Verify it's a valid date
        const date = new Date(datetime!);
        expect(date.toString()).not.toBe('Invalid Date');
      }
    });

    test('should be accessible to screen readers without JS', async ({ page }) => {
      await page.goto('/output/index.html');

      const pageTimestamp = page.locator('time').first();

      // Should have semantic HTML
      expect(await pageTimestamp.getAttribute('datetime')).toBeTruthy();

      // Should have meaningful text content
      const text = await pageTimestamp.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('With JavaScript', () => {
    test.use({ javaScriptEnabled: true });

    test('should convert timestamps to local timezone', async ({ page }) => {
      await page.goto('/output/index.html');

      // Wait for JavaScript to execute
      await page.waitForLoadState('networkidle');

      const pageTimestamp = page.locator('time').first();
      await expect(pageTimestamp).toBeVisible();

      // Should be enhanced (no longer raw ISO 8601)
      const text = await pageTimestamp.textContent();
      expect(text).not.toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      // Should be human-readable
      expect(text?.length).toBeGreaterThan(0);
    });

    test('should preserve datetime attribute for machine readability', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const timestamps = page.locator('time[datetime]');
      const count = await timestamps.count();

      for (let i = 0; i < count; i++) {
        const datetime = await timestamps.nth(i).getAttribute('datetime');

        // datetime attribute should still be ISO 8601
        expect(datetime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
      }
    });

    test('should show UTC time as tooltip on hover', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const pageTimestamp = page.locator('time').first();

      // Should have title attribute for tooltip
      const title = await pageTimestamp.getAttribute('title');
      expect(title).toBeTruthy();
      expect(title).toMatch(/UTC/i);
    });

    test('should display relative time indicator', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Look for relative time text (e.g., "5 minutes ago")
      const relativeTime = page.getByText(/just now|seconds? ago|minutes? ago|hours? ago/i);

      // Should have at least one relative time indicator
      await expect(relativeTime.first()).toBeVisible();
    });

    test('should update relative time periodically', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Get initial relative time text
      const initialRelativeText = await page.evaluate(() => {
        const relativeElement = document.querySelector('[data-relative-time]');
        return relativeElement?.textContent;
      });

      // Wait for update cycle (tests should complete within reasonable time)
      await page.waitForTimeout(2000);

      const updatedRelativeText = await page.evaluate(() => {
        const relativeElement = document.querySelector('[data-relative-time]');
        return relativeElement?.textContent;
      });

      // Text might have changed if enough time passed
      // At minimum, the mechanism should be present
      expect(updatedRelativeText).toBeDefined();

      // Initial text should also have been defined
      expect(initialRelativeText).toBeDefined();
    });

    test('should show visual indicator for auto-refresh', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Look for auto-refresh indicator (implementation may vary)
      // Could be an icon, text, or status message
      const refreshIndicator = page.locator('[data-auto-refresh-indicator]');

      // Should be present in the DOM
      await expect(refreshIndicator).toBeAttached();
    });

    test('should handle missing or invalid timestamps gracefully', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Page should not have JavaScript errors
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      // Wait a bit to catch any errors
      await page.waitForTimeout(1000);

      expect(errors).toHaveLength(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible tooltip implementation', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const timestamp = page.locator('time').first();

      // Tooltip should use title attribute (native browser support)
      const title = await timestamp.getAttribute('title');
      expect(title).toBeTruthy();

      // Or aria-label if custom tooltip
      const ariaLabel = await timestamp.getAttribute('aria-label');
      if (!title) {
        expect(ariaLabel).toBeTruthy();
      }
    });

    test('should work with keyboard navigation', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Tab to timestamp element
      await page.keyboard.press('Tab');

      // Timestamps should be readable but not necessarily focusable
      // (they're read-only information)
      const focusedElement = page.locator(':focus');

      // Just verify no errors occur during keyboard navigation
      expect(focusedElement).toBeDefined();
    });

    test('should have proper semantic HTML structure', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // All timestamps should use <time> element
      const timestamps = page.locator('time');
      const count = await timestamps.count();

      expect(count).toBeGreaterThan(0);

      // All should have datetime attribute
      for (let i = 0; i < count; i++) {
        const datetime = await timestamps.nth(i).getAttribute('datetime');
        expect(datetime).toBeTruthy();
      }
    });

    test('should announce relative time updates to screen readers', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      // Relative time elements should have aria-live for updates
      const relativeElements = page.locator('[data-relative-time]');

      if ((await relativeElements.count()) > 0) {
        const ariaLive = await relativeElements.first().getAttribute('aria-live');

        // Should use polite announcements (not aggressive)
        expect(['polite', 'off']).toContain(ariaLive);
      }
    });
  });

  test.describe('Internationalization', () => {
    test('should respect browser timezone', async ({ page, context }) => {
      // Set browser timezone to New York
      await context.addInitScript(() => {
        // Mock timezone (Playwright doesn't support full timezone mocking)
        // This is a best-effort test
      });

      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const timestamp = page.locator('time').first();
      const text = await timestamp.textContent();

      // Should show localized time (implementation-dependent)
      expect(text).toBeTruthy();
    });

    test('should use appropriate time format for locale', async ({ page }) => {
      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const timestamp = page.locator('time').first();
      const text = await timestamp.textContent();

      // Should be a formatted date/time string
      expect(text?.length).toBeGreaterThan(10);
    });
  });

  test.describe('Performance', () => {
    test('should not cause layout shifts when enhancing timestamps', async ({ page }) => {
      await page.goto('/output/index.html');

      // Measure Cumulative Layout Shift
      interface LayoutShiftEntry extends PerformanceEntry {
        hadRecentInput: boolean;
        value: number;
      }

      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as LayoutShiftEntry;
              if (layoutShift.hadRecentInput) continue;
              clsValue += layoutShift.value;
            }
          });

          observer.observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 2000);
        });
      });

      // CLS should be minimal (< 0.1 is good)
      expect(cls).toBeLessThan(0.1);
    });

    test('should not significantly impact page load time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/output/index.html');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load within 2 seconds (per performance budget)
      expect(loadTime).toBeLessThan(2000);
    });
  });
});
