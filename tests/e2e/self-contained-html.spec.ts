/**
 * E2E test for self-contained HTML (User Story 1)
 * Per T044c: Validate HTML self-containment, asset inlining, and file size
 *
 * This test validates FR-021 (self-contained HTML requirement)
 *
 * Test Requirements:
 * - Use Playwright to load output/index.html
 * - Verify page loads with zero external network requests (monitor network tab)
 * - Verify all CSS inlined in <style> tags
 * - Verify all JavaScript inlined in <script> tags
 * - Verify all images base64-encoded as data URIs
 * - Verify GOV.UK Design System assets inlined (CSS, JS, images from plugin)
 * - Verify file size < 5MB
 * - Verify page still functional after disabling network
 *
 * This test MUST fail before T044 implementation (post-build asset inlining)
 */

import { test, expect, type Request } from '@playwright/test';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Helper to get the output HTML file path
 * Priority: output/index.html > _site/index.html
 */
function getOutputHtmlPath(): string {
  const outputPath = join(process.cwd(), 'output', 'index.html');
  const sitePath = join(process.cwd(), '_site', 'index.html');

  if (existsSync(outputPath)) {
    return outputPath;
  } else if (existsSync(sitePath)) {
    return sitePath;
  } else {
    throw new Error('No output HTML file found. Run build first.');
  }
}

/**
 * Helper to get file size in MB
 */
function getFileSizeInMB(filePath: string): number {
  const stats = statSync(filePath);
  return stats.size / (1024 * 1024);
}

/**
 * Helper to check if content is base64 data URI
 */
function isDataUri(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Helper to extract all CSS from HTML
 */
function extractInlineStyles(html: string): string[] {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const matches: string[] = [];
  let match;

  while ((match = styleRegex.exec(html)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }

  return matches;
}

/**
 * Helper to extract all JavaScript from HTML
 */
function extractInlineScripts(html: string): string[] {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const matches: string[] = [];
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    // Exclude scripts with actual src attribute (not data-inlined-from or other attributes containing "src=")
    if (!match[0].match(/\ssrc=["']/) && match[1]) {
      matches.push(match[1]);
    }
  }

  return matches;
}

/**
 * Helper to find all image src and CSS background-image URLs
 */
function extractImageUrls(html: string): string[] {
  const urls: string[] = [];

  // Extract img src
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) {
      urls.push(match[1]);
    }
  }

  // Extract CSS background-image from inline styles
  const bgImageRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgImageRegex.exec(html)) !== null) {
    if (match[1]) {
      urls.push(match[1]);
    }
  }

  return urls;
}

test.describe('Self-Contained HTML (US1 - T044c)', () => {
  let htmlPath: string;
  let htmlContent: string;

  test.beforeAll(() => {
    // Ensure HTML file exists before running tests
    htmlPath = getOutputHtmlPath();
    htmlContent = readFileSync(htmlPath, 'utf-8');
  });

  test('output HTML file exists and is readable', () => {
    expect(existsSync(htmlPath)).toBe(true);
    expect(htmlContent.length).toBeGreaterThan(0);
  });

  test('HTML file size is under 5MB target', () => {
    const sizeInMB = getFileSizeInMB(htmlPath);

    console.log('HTML file size: ' + sizeInMB.toFixed(2) + ' MB');
    console.log('HTML file path: ' + htmlPath);

    // Per FR-021 constraint: < 5MB target
    expect(sizeInMB).toBeLessThan(5);

    // Warn if approaching limit (> 4MB = 80% of limit)
    if (sizeInMB > 4) {
      console.warn(
        'WARNING: HTML file size is ' + sizeInMB.toFixed(2) + ' MB, approaching 5MB limit'
      );
    }
  });

  test('HTML contains inlined CSS in <style> tags', () => {
    const inlineStyles = extractInlineStyles(htmlContent);

    expect(inlineStyles.length).toBeGreaterThan(0);

    // Should contain GOV.UK Frontend CSS
    const hasGovukCss = inlineStyles.some(
      (style) =>
        style.includes('govuk-') || style.includes('.govuk-tag') || style.includes('.govuk-button')
    );

    expect(hasGovukCss).toBe(true);

    // Total CSS should be substantial (GOV.UK Design System is comprehensive)
    const totalCssLength = inlineStyles.reduce((sum, style) => sum + style.length, 0);
    expect(totalCssLength).toBeGreaterThan(1000); // At least 1KB of CSS
  });

  test('HTML contains inlined JavaScript in <script> tags', () => {
    const inlineScripts = extractInlineScripts(htmlContent);

    expect(inlineScripts.length).toBeGreaterThan(0);

    // Should contain GOV.UK Frontend JavaScript (check for component module names)
    const hasGovukJs = inlineScripts.some(
      (script) =>
        script.includes('govuk-accordion') ||
        script.includes('govuk-button') ||
        script.includes('govuk-frontend-supported')
    );

    expect(hasGovukJs).toBe(true);
  });

  test('HTML has NO external CSS links', () => {
    // Should not have <link rel="stylesheet" href="..."> (except data URIs)
    const externalCssLinks = htmlContent.match(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?!data:)([^"']+)["']/gi
    );

    expect(externalCssLinks).toBeNull();
  });

  test('HTML has NO external JavaScript scripts', () => {
    // Should not have <script src="..."> (except data URIs)
    const externalScripts = htmlContent.match(/<script[^>]+src=["'](?!data:)([^"']+)["']/gi);

    expect(externalScripts).toBeNull();
  });

  test('all images are base64-encoded as data URIs', () => {
    const imageUrls = extractImageUrls(htmlContent);

    if (imageUrls.length === 0) {
      // No images is acceptable for minimal status page
      console.log('No images found in HTML');
      return;
    }

    // All images should be data URIs
    const allDataUris = imageUrls.every((url) => isDataUri(url));

    if (!allDataUris) {
      const externalImages = imageUrls.filter((url) => !isDataUri(url));
      console.error('External images found:', externalImages);
    }

    expect(allDataUris).toBe(true);
  });

  test('HTML contains NO external resource references', () => {
    // Check for common external resource patterns (excluding data: URIs)
    const externalPatterns = [
      /href=["'](?!data:|#|\/|mailto:)https?:\/\//gi, // External links in href (allow anchors, relative, mailto)
      /src=["'](?!data:|\/|#)https?:\/\//gi, // External src (allow relative, data URIs)
      /url\(["']?(?!data:)https?:\/\//gi, // External URLs in CSS
    ];

    const violations: string[] = [];

    for (const pattern of externalPatterns) {
      const matches = htmlContent.match(pattern);
      if (matches) {
        violations.push(...matches);
      }
    }

    // Filter out acceptable external links (e.g., footer links to GitHub)
    const unacceptableViolations = violations.filter(
      (v) =>
        !v.includes('github.com/alphagov') && // GOV.UK Design System link in footer is acceptable
        !v.includes('mailto:') // Email links are acceptable
    );

    if (unacceptableViolations.length > 0) {
      console.error('External resources found:', unacceptableViolations);
    }

    expect(unacceptableViolations.length).toBe(0);
  });

  test('GOV.UK Design System CSS is inlined', () => {
    const inlineStyles = extractInlineStyles(htmlContent);
    const allCss = inlineStyles.join('\n');

    // Verify GOV.UK Frontend core CSS is present
    const govukComponents = [
      '.govuk-header',
      '.govuk-footer',
      '.govuk-tag',
      '.govuk-button',
      '.govuk-heading',
      '.govuk-body',
      '.govuk-summary-list',
      '.govuk-notification-banner',
    ];

    const missingComponents = govukComponents.filter((component) => !allCss.includes(component));

    if (missingComponents.length > 0) {
      console.error('Missing GOV.UK CSS components:', missingComponents);
    }

    expect(missingComponents.length).toBe(0);
  });

  test('GOV.UK Design System JavaScript is inlined', () => {
    const inlineScripts = extractInlineScripts(htmlContent);
    const allJs = inlineScripts.join('\n');

    // Verify GOV.UK Frontend JavaScript is present (check for component module names and classes)
    const govukJsPatterns = [
      /govuk-accordion/,
      /govuk-button/,
      /govuk-frontend-supported/,
      /js-enabled/
    ];

    const missingPatterns = govukJsPatterns.filter((pattern) => !pattern.test(allJs));

    if (missingPatterns.length > 0) {
      console.error('Missing GOV.UK JavaScript patterns:', missingPatterns);
    }

    expect(missingPatterns.length).toBe(0);
  });

  test('HTML is valid HTML5', () => {
    // Basic HTML5 validation checks
    expect(htmlContent).toMatch(/<!DOCTYPE html>/i);
    expect(htmlContent).toMatch(/<html[^>]*>/i);
    expect(htmlContent).toMatch(/<head>/i);
    expect(htmlContent).toMatch(/<body[^>]*>/i); // Match opening body tag with attributes
    expect(htmlContent).toMatch(/<\/html>/i);

    // Verify charset is specified
    expect(htmlContent).toMatch(/<meta[^>]+charset=["']?utf-8["']?/i);

    // Verify viewport is specified (responsive design)
    expect(htmlContent).toMatch(/<meta[^>]+name=["']viewport["']/i);
  });

  test('HTML contains meta refresh tag for auto-update', () => {
    // Per FR-029: Meta refresh tag must be present
    expect(htmlContent).toMatch(/<meta[^>]+http-equiv=["']refresh["']/i);
  });
});

test.describe('Self-Contained HTML Network Isolation (US1 - T044c)', () => {
  const htmlPath = getOutputHtmlPath();
  const fileUrl = 'file://' + htmlPath;

  test('page loads with zero external network requests', async ({ page }) => {
    const externalRequests: Request[] = [];

    // Monitor all network requests
    page.on('request', (request) => {
      const url = request.url();

      // Track non-data-URI and non-file-protocol requests
      if (!url.startsWith('data:') && !url.startsWith('file://')) {
        externalRequests.push(request);
      }
    });

    // Load page
    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Verify zero external requests
    if (externalRequests.length > 0) {
      console.error('External network requests detected:');
      externalRequests.forEach((req) => {
        console.error('  - ' + req.method() + ' ' + req.url());
      });
    }

    expect(externalRequests.length).toBe(0);
  });

  test('page is functional when loaded from file:// protocol', async ({ page }) => {
    await page.goto(fileUrl);

    // Verify page renders
    await expect(page.locator('body')).toBeVisible();

    // Verify main content is visible
    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible();

    // Verify page title
    await expect(page).toHaveTitle(/GOV\.UK.*service status/i);

    // Verify GOV.UK Design System styles applied
    const govukElements = await page.locator('[class*="govuk-"]').count();
    expect(govukElements).toBeGreaterThan(0);
  });

  test('page is functional with JavaScript disabled', async ({ browser }) => {
    // Create context with JavaScript disabled
    const context = await browser.newContext({
      javaScriptEnabled: false,
    });

    const page = await context.newPage();
    await page.goto(fileUrl);

    // Page should still be visible and functional (progressive enhancement)
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // Meta refresh should still work (no JavaScript required)
    const metaRefresh = page.locator('meta[http-equiv="refresh"]');
    await expect(metaRefresh).toHaveCount(1);

    await context.close();
  });

  test('page is functional without network connectivity', async ({ context }) => {
    // Simulate offline mode
    await context.setOffline(true);

    const page = await context.newPage();

    // Load from file:// should work offline
    await page.goto(fileUrl);

    // Verify page loads and is interactive
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // Restore online mode
    await context.setOffline(false);
  });

  test('GOV.UK Design System components render correctly', async ({ page }) => {
    await page.goto(fileUrl);

    // Verify GOV.UK header renders
    const header = page.locator('.govuk-header');
    await expect(header).toBeVisible();

    // Verify GOV.UK footer renders
    const footer = page.locator('.govuk-footer');
    await expect(footer).toBeVisible();

    // Verify GOV.UK tags render (if services present)
    const tags = page.locator('.govuk-tag');
    const tagCount = await tags.count();

    if (tagCount > 0) {
      // Verify tag has proper styles
      const firstTag = tags.first();
      await expect(firstTag).toBeVisible();

      // Verify tag has background color (CSS applied)
      const backgroundColor = await firstTag.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
    }
  });

  test('inlined CSS provides proper styling', async ({ page }) => {
    await page.goto(fileUrl);

    // Verify GOV.UK width container is constrained
    const container = page.locator('.govuk-width-container').first();

    if ((await container.count()) > 0) {
      const width = await container.evaluate((el) => {
        return window.getComputedStyle(el).maxWidth;
      });

      // GOV.UK width container should have max-width
      expect(width).not.toBe('none');
    }

    // Verify heading styles applied
    const h1 = page.locator('h1');
    const fontSize = await h1.evaluate((el) => window.getComputedStyle(el).fontSize);

    // H1 should have larger font size than body
    const parsedSize = parseFloat(fontSize);
    expect(parsedSize).toBeGreaterThan(20); // At least 20px
  });

  test('inlined JavaScript initializes GOV.UK components', async ({ page }) => {
    // Track JavaScript errors
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    await page.goto(fileUrl);

    // Verify JavaScript classes are enabled (from body class)
    const hasJsEnabled = await page.evaluate(() => {
      return document.body.classList.contains('js-enabled');
    });

    expect(hasJsEnabled).toBe(true);

    // Verify GOV.UK Frontend support class is present
    const hasFrontendSupport = await page.evaluate(() => {
      return document.body.classList.contains('govuk-frontend-supported');
    });

    expect(hasFrontendSupport).toBe(true);

    // Wait for JavaScript execution and module initialization
    await page.waitForTimeout(500);

    // Verify no JavaScript errors occurred during initialization
    expect(jsErrors.length).toBe(0);
  });

  test('page can be saved and reopened without modification', async ({ page }) => {
    // Load once
    await page.goto(fileUrl);
    const originalContent = await page.content();

    // Reload
    await page.reload({ waitUntil: 'networkidle' });
    const reloadedContent = await page.content();

    // Content should be identical (no dynamic fetching)
    // Note: Some whitespace differences may occur, so we check key elements
    expect(reloadedContent).toContain('GOV.UK service status');
    expect(reloadedContent.length).toBeCloseTo(originalContent.length, -2); // Within 100 chars
  });

  test('all CSS is in <style> tags (not external stylesheets)', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceType === 'stylesheet' && !url.startsWith('data:')) {
        requests.push(url);
      }
    });

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // No external stylesheet requests
    expect(requests.length).toBe(0);
  });

  test('all JavaScript is in <script> tags (not external scripts)', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceType === 'script' && !url.startsWith('data:') && !url.startsWith('file://')) {
        requests.push(url);
      }
    });

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // No external script requests
    expect(requests.length).toBe(0);
  });

  test('all images are embedded (not external)', async ({ page }) => {
    const imageRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceType === 'image' && !url.startsWith('data:') && !url.startsWith('file://')) {
        imageRequests.push(url);
      }
    });

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // No external image requests
    expect(imageRequests.length).toBe(0);
  });

  test('all fonts are embedded (not external)', async ({ page }) => {
    const fontRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceType === 'font' && !url.startsWith('data:') && !url.startsWith('file://')) {
        fontRequests.push(url);
      }
    });

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // No external font requests
    // Note: GOV.UK Design System may use system fonts, so this should be 0
    expect(fontRequests.length).toBe(0);
  });
});

test.describe('Self-Contained HTML Compression (US1 - T044c)', () => {
  const htmlPath = getOutputHtmlPath();

  test('HTML can be compressed for efficient transfer', () => {
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    const uncompressedSize = htmlContent.length;

    console.log('Uncompressed HTML size: ' + (uncompressedSize / 1024).toFixed(2) + ' KB');

    // Verify HTML is compressible (contains repeated patterns)
    const estimatedCompressionRatio = estimateCompressionRatio(htmlContent);

    console.log('Estimated compression ratio: ' + estimatedCompressionRatio.toFixed(2) + 'x');

    // Should achieve at least 2x compression (typical for HTML with CSS/JS)
    expect(estimatedCompressionRatio).toBeGreaterThan(2);
  });

  test('HTML does not contain excessive whitespace', () => {
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    // Count whitespace characters
    const whitespaceCount = (htmlContent.match(/\s/g) || []).length;
    const totalChars = htmlContent.length;
    const whitespaceRatio = whitespaceCount / totalChars;

    console.log('Whitespace ratio: ' + (whitespaceRatio * 100).toFixed(2) + '%');

    // Whitespace should be < 30% of total content (minified but readable)
    expect(whitespaceRatio).toBeLessThan(0.3);
  });
});

/**
 * Helper to estimate compression ratio using simple pattern analysis
 * (approximates gzip/brotli compression)
 */
function estimateCompressionRatio(content: string): number {
  // Count unique substrings of length 10
  const substringLength = 10;
  const substrings = new Set<string>();
  let totalSubstrings = 0;

  for (let i = 0; i <= content.length - substringLength; i++) {
    const substring = content.substring(i, i + substringLength);
    substrings.add(substring);
    totalSubstrings++;
  }

  // Compression ratio estimate: total / unique
  // More repeated patterns = higher compression ratio
  const uniqueRatio = substrings.size / totalSubstrings;
  const estimatedRatio = 1 / uniqueRatio;

  return estimatedRatio;
}
