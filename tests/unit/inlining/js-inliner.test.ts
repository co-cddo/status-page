/**
 * Unit tests for JavaScript Inliner (T043 - Code Coverage Tests)
 *
 * Constitutional Compliance:
 * - Principle III: Tests validate existing implementation
 * - Principle X: No external services - Mock filesystem operations
 *
 * Test Requirements (per T043):
 * - Test inline JS from script tags
 * - Handle relative/absolute URLs
 * - Handle file reading errors
 * - Preserve existing inline scripts
 * - Process multiple scripts
 * - Verify no external scripts remain
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  inlineJavaScript,
  verifyNoExternalScripts,
  type JSInlineResult,
} from '../../../src/inlining/js-inliner.ts';
import { readFile } from 'fs/promises';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

// Mock fs/promises
vi.mock('fs/promises');

// Mock utility modules
vi.mock('../../../src/utils/url.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/url.ts')>(
    '../../../src/utils/url.ts'
  );
  return {
    ...actual,
    extractPathFromUrl: vi.fn((url: string) => {
      // Default implementation: extract pathname from URL or return as-is
      try {
        const urlObj = new URL(url);
        return urlObj.pathname;
      } catch {
        return url;
      }
    }),
    safeResolvePath: vi.fn((basePath: string, userPath: string) => {
      // Default implementation: simple path join
      return `${basePath}/${userPath}`;
    }),
  };
});

vi.mock('../../../src/utils/error.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/error.ts')>(
    '../../../src/utils/error.ts'
  );
  return {
    ...actual,
    getErrorMessage: vi.fn((error: unknown) => {
      if (error instanceof Error) {
        return error.message;
      }
      return 'Unknown error';
    }),
  };
});

describe('JavaScript Inliner (T043)', () => {
  let $: CheerioAPI;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('No Scripts to Inline', () => {
    it('should return success with zero count when no script tags exist', async () => {
      $ = cheerio.load('<html><head></head><body><p>No scripts</p></body></html>');

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should return success when only inline scripts exist (no src)', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script>console.log('inline');</script>
          </head>
          <body></body>
        </html>
      `);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should preserve existing inline scripts unchanged', async () => {
      const inlineCode = "console.log('existing inline script');";
      $ = cheerio.load(`
        <html>
          <head>
            <script>${inlineCode}</script>
          </head>
          <body></body>
        </html>
      `);

      await inlineJavaScript($, '/test/index.html');

      const scripts = $('script');
      expect(scripts.length).toBe(1);
      expect(scripts.first().text()).toBe(inlineCode);
      expect(scripts.first().attr('src')).toBeUndefined();
    });
  });

  describe('Single Script Inlining', () => {
    it('should inline a single JavaScript file successfully', async () => {
      const jsContent = "console.log('Hello, world!');";
      $ = cheerio.load('<html><head><script src="/js/app.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue(jsContent);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBe(Buffer.byteLength(jsContent, 'utf-8'));
      expect(result.errors).toEqual([]);

      const script = $('script').first();
      expect(script.attr('src')).toBeUndefined();
      expect(script.text()).toBe(jsContent);
      expect(script.attr('data-inlined-from')).toBe('/js/app.js');
    });

    it('should preserve script attributes except src', async () => {
      $ = cheerio.load(
        '<html><head><script src="/js/app.js" type="module" defer async></script></head><body></body></html>'
      );

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      await inlineJavaScript($, '/test/index.html');

      const script = $('script').first();
      expect(script.attr('type')).toBe('module');
      expect(script.attr('defer')).toBeDefined();
      expect(script.attr('async')).toBeDefined();
      expect(script.attr('src')).toBeUndefined();
      expect(script.attr('data-inlined-from')).toBe('/js/app.js');
    });

    it('should calculate file size correctly in bytes', async () => {
      const jsContent = 'a'.repeat(1024); // 1KB of 'a'
      $ = cheerio.load('<html><head><script src="/js/large.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue(jsContent);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.totalSize).toBe(1024);
    });

    it('should handle multi-byte UTF-8 characters correctly', async () => {
      const jsContent = 'console.log("你好世界");'; // Multi-byte characters
      $ = cheerio.load('<html><head><script src="/js/i18n.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue(jsContent);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.totalSize).toBe(Buffer.byteLength(jsContent, 'utf-8'));
      expect(result.totalSize).toBeGreaterThan(jsContent.length); // Multi-byte chars take more bytes
    });
  });

  describe('Multiple Scripts Inlining', () => {
    it('should inline multiple JavaScript files in order', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="/js/first.js"></script>
            <script src="/js/second.js"></script>
            <script src="/js/third.js"></script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile)
        .mockResolvedValueOnce('// First script')
        .mockResolvedValueOnce('// Second script')
        .mockResolvedValueOnce('// Third script');

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);

      const scripts = $('script');
      expect(scripts.length).toBe(3);
      expect(scripts.eq(0).text()).toBe('// First script');
      expect(scripts.eq(1).text()).toBe('// Second script');
      expect(scripts.eq(2).text()).toBe('// Third script');
    });

    it('should accumulate total size across multiple files', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="/js/a.js"></script>
            <script src="/js/b.js"></script>
          </head>
          <body></body>
        </html>
      `);

      const script1 = 'a'.repeat(100); // 100 bytes
      const script2 = 'b'.repeat(200); // 200 bytes

      vi.mocked(readFile).mockResolvedValueOnce(script1).mockResolvedValueOnce(script2);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.totalSize).toBe(300);
    });

    it('should preserve order of mixed inline and external scripts', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script>console.log('inline1');</script>
            <script src="/js/external.js"></script>
            <script>console.log('inline2');</script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile).mockResolvedValue('console.log("external");');

      await inlineJavaScript($, '/test/index.html');

      const scripts = $('script');
      expect(scripts.length).toBe(3);
      expect(scripts.eq(0).text()).toContain('inline1');
      expect(scripts.eq(1).text()).toContain('external');
      expect(scripts.eq(2).text()).toContain('inline2');
    });
  });

  describe('Relative and Absolute Path Handling', () => {
    it('should handle relative paths from HTML directory', async () => {
      const { extractPathFromUrl, safeResolvePath } = await import('../../../src/utils/url.ts');

      $ = cheerio.load('<html><head><script src="js/app.js"></script></head><body></body></html>');

      vi.mocked(extractPathFromUrl).mockReturnValue('js/app.js');
      vi.mocked(safeResolvePath).mockReturnValue('/test/js/app.js');
      vi.mocked(readFile).mockResolvedValue("console.log('relative');");

      const result = await inlineJavaScript($, '/test/index.html', '_site');

      expect(result.success).toBe(true);
      expect(safeResolvePath).toHaveBeenCalledWith('/test', 'js/app.js');
    });

    it('should handle absolute paths from site root', async () => {
      const { extractPathFromUrl, safeResolvePath } = await import('../../../src/utils/url.ts');

      $ = cheerio.load('<html><head><script src="/assets/app.js"></script></head><body></body></html>');

      vi.mocked(extractPathFromUrl).mockReturnValue('/assets/app.js');
      vi.mocked(safeResolvePath).mockReturnValue('_site/assets/app.js');
      vi.mocked(readFile).mockResolvedValue("console.log('absolute');");

      const result = await inlineJavaScript($, '/test/index.html', '_site');

      expect(result.success).toBe(true);
      expect(safeResolvePath).toHaveBeenCalledWith('_site', 'assets/app.js');
    });

    it('should extract path from localhost URLs', async () => {
      const { extractPathFromUrl } = await import('../../../src/utils/url.ts');

      $ = cheerio.load(
        '<html><head><script src="http://localhost:8080/js/app.js"></script></head><body></body></html>'
      );

      vi.mocked(extractPathFromUrl).mockReturnValue('/js/app.js');
      vi.mocked(readFile).mockResolvedValue("console.log('localhost');");

      const result = await inlineJavaScript($, '/test/index.html');

      // Should skip external scripts starting with http://
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle custom site root parameter', async () => {
      const { safeResolvePath } = await import('../../../src/utils/url.ts');

      $ = cheerio.load('<html><head><script src="/js/app.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue("console.log('custom root');");

      await inlineJavaScript($, '/test/index.html', 'custom_output');

      expect(safeResolvePath).toHaveBeenCalledWith('custom_output', 'js/app.js');
    });
  });

  describe('External Script Handling', () => {
    it('should skip external HTTP scripts and report error', async () => {
      $ = cheerio.load(
        '<html><head><script src="http://example.com/app.js"></script></head><body></body></html>'
      );

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatch(/Cannot inline external script/i);
      expect(result.errors[0]).toContain('http://example.com/app.js');
    });

    it('should skip external HTTPS scripts and report error', async () => {
      $ = cheerio.load(
        '<html><head><script src="https://cdn.example.com/lib.js"></script></head><body></body></html>'
      );

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatch(/https:\/\/cdn\.example\.com\/lib\.js/);
    });

    it('should explain self-contained HTML requirement in error', async () => {
      $ = cheerio.load(
        '<html><head><script src="https://external.com/script.js"></script></head><body></body></html>'
      );

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.errors[0]).toMatch(/self-contained HTML/i);
      expect(result.errors[0]).toMatch(/local/i);
    });

    it('should process local scripts after skipping external ones', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="https://external.com/lib.js"></script>
            <script src="/js/local.js"></script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile).mockResolvedValue("console.log('local');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false); // Failed due to external script
      expect(result.inlinedCount).toBe(1); // But local script was inlined
      expect(result.errors.length).toBe(1);
    });
  });

  describe('File Reading Errors', () => {
    it('should handle ENOENT (file not found) errors', async () => {
      $ = cheerio.load('<html><head><script src="/js/missing.js"></script></head><body></body></html>');

      const error = new Error('ENOENT: no such file or directory');
      Object.assign(error, { code: 'ENOENT' });
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toMatch(/Failed to inline JavaScript file/i);
      expect(result.errors[0]).toContain('/js/missing.js');
    });

    it('should handle EACCES (permission denied) errors', async () => {
      $ = cheerio.load('<html><head><script src="/js/protected.js"></script></head><body></body></html>');

      const error = new Error('EACCES: permission denied');
      Object.assign(error, { code: 'EACCES' });
      vi.mocked(readFile).mockRejectedValue(error);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('permission denied');
    });

    it('should continue processing after file read error', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="/js/missing.js"></script>
            <script src="/js/valid.js"></script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce("console.log('valid');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false); // Failed due to first error
      expect(result.inlinedCount).toBe(1); // But second script was inlined
      expect(result.errors.length).toBe(1);
    });

    it('should accumulate multiple errors', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="/js/error1.js"></script>
            <script src="/js/error2.js"></script>
            <script src="https://external.com/script.js"></script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(3); // Two read errors + one external script
    });
  });

  describe('Edge Cases', () => {
    it('should handle script tag without src attribute gracefully', async () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script></script>
            <script src="/js/app.js"></script>
          </head>
          <body></body>
        </html>
      `);

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should handle empty JavaScript files', async () => {
      $ = cheerio.load('<html><head><script src="/js/empty.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue('');

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBe(0);

      const script = $('script').first();
      expect(script.text()).toBe('');
    });

    it('should handle very large JavaScript files', async () => {
      const largeJs = 'a'.repeat(1024 * 1024); // 1MB
      $ = cheerio.load('<html><head><script src="/js/large.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue(largeJs);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      expect(result.totalSize).toBe(1024 * 1024);
    });

    it('should handle JavaScript with special characters', async () => {
      const jsWithSpecialChars = 'var str = "</script><script>alert(1)</script>";';
      $ = cheerio.load('<html><head><script src="/js/special.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue(jsWithSpecialChars);

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      const script = $('script').first();
      expect(script.text()).toContain('</script>');
    });

    it('should handle script tags with query parameters in src', async () => {
      $ = cheerio.load(
        '<html><head><script src="/js/app.js?v=1.0.0"></script></head><body></body></html>'
      );

      vi.mocked(readFile).mockResolvedValue("console.log('versioned');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
      const script = $('script').first();
      expect(script.attr('data-inlined-from')).toBe('/js/app.js?v=1.0.0');
    });

    it('should handle script tags with hash fragments', async () => {
      $ = cheerio.load('<html><head><script src="/js/app.js#section"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue("console.log('fragment');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(true);
    });

    it('should handle missing or undefined src attribute', async () => {
      // Create script tag with src that cheerio returns as undefined
      $ = cheerio.load('<html><head><script src=""></script></head><body></body></html>');
      $('script').first().removeAttr('src').attr('src', ''); // Force empty src

      const result = await inlineJavaScript($, '/test/index.html');

      // Should skip scripts with empty src
      expect(result.inlinedCount).toBe(0);
    });
  });

  describe('Script Attributes Preservation', () => {
    it('should preserve type attribute', async () => {
      $ = cheerio.load(
        '<html><head><script src="/js/module.js" type="module"></script></head><body></body></html>'
      );

      vi.mocked(readFile).mockResolvedValue('export default {};');

      await inlineJavaScript($, '/test/index.html');

      const script = $('script').first();
      expect(script.attr('type')).toBe('module');
    });

    it('should preserve multiple boolean attributes', async () => {
      $ = cheerio.load(
        '<html><head><script src="/js/app.js" defer async nomodule></script></head><body></body></html>'
      );

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      await inlineJavaScript($, '/test/index.html');

      const script = $('script').first();
      expect(script.attr('defer')).toBeDefined();
      expect(script.attr('async')).toBeDefined();
      expect(script.attr('nomodule')).toBeDefined();
    });

    it('should preserve custom data attributes', async () => {
      $ = cheerio.load(
        '<html><head><script src="/js/app.js" data-custom="value" data-test="123"></script></head><body></body></html>'
      );

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      await inlineJavaScript($, '/test/index.html');

      const script = $('script').first();
      expect(script.attr('data-custom')).toBe('value');
      expect(script.attr('data-test')).toBe('123');
    });

    it('should handle script with no attributes except src', async () => {
      $ = cheerio.load('<html><head><script src="/js/plain.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue("console.log('plain');");

      await inlineJavaScript($, '/test/index.html');

      const script = $('script').first();
      expect(script.attr('src')).toBeUndefined();
      expect(script.attr('data-inlined-from')).toBe('/js/plain.js');
    });
  });

  describe('verifyNoExternalScripts', () => {
    it('should return empty array when no external scripts exist', () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script>console.log('inline');</script>
            <script data-inlined-from="/js/app.js">console.log('inlined');</script>
          </head>
          <body></body>
        </html>
      `);

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });

    it('should detect HTTP external scripts', () => {
      $ = cheerio.load(
        '<html><head><script src="http://example.com/lib.js"></script></head><body></body></html>'
      );

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual(['http://example.com/lib.js']);
    });

    it('should detect HTTPS external scripts', () => {
      $ = cheerio.load(
        '<html><head><script src="https://cdn.example.com/bundle.js"></script></head><body></body></html>'
      );

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual(['https://cdn.example.com/bundle.js']);
    });

    it('should detect multiple external scripts', () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="http://example.com/lib1.js"></script>
            <script src="https://cdn.example.com/lib2.js"></script>
            <script>console.log('inline');</script>
            <script src="https://another.com/lib3.js"></script>
          </head>
          <body></body>
        </html>
      `);

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toHaveLength(3);
      expect(externalScripts).toContain('http://example.com/lib1.js');
      expect(externalScripts).toContain('https://cdn.example.com/lib2.js');
      expect(externalScripts).toContain('https://another.com/lib3.js');
    });

    it('should ignore local absolute paths', () => {
      $ = cheerio.load('<html><head><script src="/js/app.js"></script></head><body></body></html>');

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });

    it('should ignore relative paths', () => {
      $ = cheerio.load('<html><head><script src="js/app.js"></script></head><body></body></html>');

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });

    it('should handle scripts in body as well as head', () => {
      $ = cheerio.load(`
        <html>
          <head>
            <script src="https://head-external.com/script.js"></script>
          </head>
          <body>
            <script src="http://body-external.com/script.js"></script>
          </body>
        </html>
      `);

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toHaveLength(2);
      expect(externalScripts).toContain('https://head-external.com/script.js');
      expect(externalScripts).toContain('http://body-external.com/script.js');
    });

    it('should return empty array for HTML with no scripts at all', () => {
      $ = cheerio.load('<html><head></head><body><p>No scripts</p></body></html>');

      const externalScripts = verifyNoExternalScripts($);

      expect(externalScripts).toEqual([]);
    });
  });

  describe('Result Structure', () => {
    it('should return correct JSInlineResult structure', async () => {
      $ = cheerio.load('<html><head><script src="/js/app.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('inlinedCount');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('errors');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.inlinedCount).toBe('number');
      expect(typeof result.totalSize).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should include error details in errors array', async () => {
      $ = cheerio.load('<html><head><script src="/js/missing.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockRejectedValue(new Error('Custom error message'));

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('/js/missing.js');
      expect(result.errors[0]).toContain('Custom error message');
    });
  });

  describe('Integration with Path Security', () => {
    it('should call safeResolvePath for security validation', async () => {
      const { safeResolvePath } = await import('../../../src/utils/url.ts');

      $ = cheerio.load('<html><head><script src="/js/app.js"></script></head><body></body></html>');

      vi.mocked(readFile).mockResolvedValue("console.log('test');");

      await inlineJavaScript($, '/test/index.html');

      expect(safeResolvePath).toHaveBeenCalled();
    });

    it('should handle path traversal rejection gracefully', async () => {
      const { safeResolvePath } = await import('../../../src/utils/url.ts');

      $ = cheerio.load('<html><head><script src="../../../etc/passwd.js"></script></head><body></body></html>');

      vi.mocked(safeResolvePath).mockImplementation(() => {
        throw new Error('Path traversal attempt detected');
      });

      const result = await inlineJavaScript($, '/test/index.html');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Path traversal attempt detected');
    });
  });
});
