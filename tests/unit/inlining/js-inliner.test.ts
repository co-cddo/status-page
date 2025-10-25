/**
 * Unit tests for JavaScript Inliner
 *
 * Tests JavaScript file inlining, attribute preservation, and external script detection.
 */

import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { join } from 'path';
import {
  inlineJavaScript,
  verifyNoExternalScripts,
} from '../../../src/inlining/js-inliner.js';

const FIXTURES_DIR = 'tests/fixtures/inlining';

describe('JavaScript Inliner', () => {
  describe('inlineJavaScript()', () => {
    it('should inline single JavaScript file', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head></head>
          <body>
            <script src="js/app.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify <script src> replaced with inline <script>
      expect($('script[src]').length).toBe(0);
      expect($('script').length).toBe(1);

      // Verify JavaScript content inlined
      const scriptContent = $('script').html();
      expect(scriptContent).toContain('console.log');
      expect(scriptContent).toContain('Application loaded');

      // Verify data-inlined-from attribute
      expect($('script').attr('data-inlined-from')).toBe('js/app.js');
    });

    it('should inline multiple JavaScript files in order', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head></head>
          <body>
            <script src="js/app.js"></script>
            <script src="js/utils.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(2);
      expect($('script').length).toBe(2);

      // Verify order preserved
      const firstScript = $('script').eq(0).html();
      const secondScript = $('script').eq(1).html();
      expect(firstScript).toContain('Application loaded');
      expect(secondScript).toContain('formatDate');
    });

    it('should handle absolute paths from site root', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="/js/app.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'pages/index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should reject localhost URLs as external scripts', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="http://localhost:8080/js/app.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      // localhost URLs with http:// are treated as external
      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should preserve script attributes except src', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="js/app.js" type="module" defer async data-custom="value"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      const script = $('script');
      expect(script.attr('type')).toBe('module');
      expect(script.attr('defer')).toBe('defer'); // Boolean attributes get their name as value
      expect(script.attr('async')).toBe('async'); // Boolean attributes get their name as value
      expect(script.attr('data-custom')).toBe('value');
      expect(script.attr('src')).toBeUndefined();
    });

    it('should return empty result when no scripts found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should preserve inline scripts without src', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script>console.log('inline');</script>
            <script src="js/app.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1); // Only the src script
      expect($('script').length).toBe(2); // Both scripts remain
    });

    it('should skip scripts with missing src attribute', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src></script>
            <script src="js/app.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1); // Only valid script
    });

    it('should report errors for external scripts (http)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="http://example.com/script.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('external script');
      expect(result.errors[0]).toContain('example.com');
    });

    it('should report errors for external scripts (https)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="https://cdn.example.com/lib.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors[0]).toContain('Self-contained HTML');
    });

    it('should report errors for missing JavaScript files', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="js/nonexistent.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nonexistent.js');
    });

    it('should handle partial failures gracefully', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="js/app.js"></script>
            <script src="js/missing.js"></script>
            <script src="js/utils.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(2); // Two successful
      expect(result.errors.length).toBe(1); // One error
    });

    it('should calculate total size correctly', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="js/app.js"></script>
            <script src="js/utils.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineJavaScript($, htmlPath, FIXTURES_DIR);

      // Size should be positive and reasonable (combined size of both JS files)
      expect(result.totalSize).toBeGreaterThan(50);
      expect(result.totalSize).toBeLessThan(10000);
    });
  });

  describe('verifyNoExternalScripts()', () => {
    it('should return empty array when no external scripts found', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script>console.log('inline');</script>
          </body>
        </html>
      `;

      const $ = load(html);
      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });

    it('should detect external HTTP scripts', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="http://example.com/script.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toHaveLength(1);
      expect(externalScripts[0]).toBe('http://example.com/script.js');
    });

    it('should detect external HTTPS scripts', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="https://cdn.example.com/lib.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toHaveLength(1);
      expect(externalScripts[0]).toBe('https://cdn.example.com/lib.js');
    });

    it('should detect multiple external scripts', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="https://cdn1.example.com/lib.js"></script>
            <script>console.log('inline');</script>
            <script src="https://cdn2.example.com/lib.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toHaveLength(2);
      expect(externalScripts).toContain('https://cdn1.example.com/lib.js');
      expect(externalScripts).toContain('https://cdn2.example.com/lib.js');
    });

    it('should ignore local script paths', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script src="js/app.js"></script>
            <script src="/js/utils.js"></script>
          </body>
        </html>
      `;

      const $ = load(html);
      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });
  });
});
