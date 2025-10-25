/**
 * Unit tests for CSS Inliner
 *
 * Tests CSS file inlining, url() reference conversion, and error handling.
 */

import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { join } from 'path';
import { inlineCSS, inlineCSSUrls } from '../../../src/inlining/css-inliner.js';

const FIXTURES_DIR = 'tests/fixtures/inlining';

describe('CSS Inliner', () => {
  describe('inlineCSS()', () => {
    it('should inline single CSS file', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/styles.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify <link> tag replaced with <style>
      expect($('link[rel="stylesheet"]').length).toBe(0);
      expect($('style').length).toBe(1);

      // Verify CSS content inlined
      const styleContent = $('style').html();
      expect(styleContent).toContain('font-family');
      expect(styleContent).toContain('background-color');

      // Verify data-inlined-from attribute
      expect($('style').attr('data-inlined-from')).toBe('css/styles.css');
    });

    it('should inline multiple CSS files in order', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/styles.css">
            <link rel="stylesheet" href="css/theme.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(2);
      expect($('style').length).toBe(2);

      // Verify order preserved
      const firstStyle = $('style').eq(0).html();
      const secondStyle = $('style').eq(1).html();
      expect(firstStyle).toContain('font-family');
      expect(secondStyle).toContain('.button');
    });

    it('should handle absolute paths from site root', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/css/styles.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'pages/index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should handle localhost URLs by extracting path', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="http://localhost:8080/css/styles.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should return empty result when no stylesheets found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip stylesheet links with missing href', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet">
            <link rel="stylesheet" href="css/styles.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1); // Only one valid stylesheet
    });

    it('should report errors for missing CSS files', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/nonexistent.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nonexistent.css');
    });

    it('should handle partial failures gracefully', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/styles.css">
            <link rel="stylesheet" href="css/missing.css">
            <link rel="stylesheet" href="css/theme.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(2); // Two successful
      expect(result.errors.length).toBe(1); // One error
      expect($('style').length).toBe(2); // Two inlined
    });

    it('should preserve CSS type attribute', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/styles.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      await inlineCSS($, htmlPath, FIXTURES_DIR);

      expect($('style').attr('type')).toBe('text/css');
    });

    it('should calculate total size correctly', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="css/styles.css">
            <link rel="stylesheet" href="css/theme.css">
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSS($, htmlPath, FIXTURES_DIR);

      // Size should be positive and reasonable (combined size of both CSS files)
      expect(result.totalSize).toBeGreaterThan(50);
      expect(result.totalSize).toBeLessThan(10000);
    });
  });

  describe('inlineCSSUrls()', () => {
    it('should inline url() references in style tags', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .logo {
                background-image: url('images/logo.svg');
              }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);

      // Verify url() converted to data URI
      const styleContent = $('style').html();
      expect(styleContent).toContain('data:image/svg+xml;base64,');
      expect(styleContent).not.toContain('images/logo.svg');
    });

    it('should skip data URIs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .icon {
                background: url('data:image/png;base64,iVBORw0KGgoAAAANS');
              }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0); // Already inlined
    });

    it('should skip external URLs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .bg {
                background: url('https://example.com/image.png');
              }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });

    it('should handle multiple url() references', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .logo1 { background: url('images/logo.svg'); }
              .logo2 { background: url('images/test.png'); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(2);
    });

    it('should handle missing files gracefully', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .missing { background: url('images/nonexistent.png'); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      // Should not fail entirely for CSS url() failures
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });

    it('should return empty result when no style tags found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should handle various url() quote styles', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .single { background: url('images/logo.svg'); }
              .double { background: url("images/logo.svg"); }
              .none { background: url(images/logo.svg); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSUrls($, htmlPath);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);
    });

    it('should determine correct MIME types', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .svg { background: url('images/logo.svg'); }
              .png { background: url('images/test.png'); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      await inlineCSSUrls($, htmlPath);

      const styleContent = $('style').html();
      expect(styleContent).toContain('data:image/svg+xml;base64,');
      expect(styleContent).toContain('data:image/png;base64,');
    });
  });
});
