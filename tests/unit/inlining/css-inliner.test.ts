/**
 * Unit tests for CSS Inliner
 *
 * Tests: src/inlining/css-inliner.ts
 * Coverage: inlineCSS(), inlineCSSUrls(), getMimeType()
 * Requirements: FR-021 (self-contained HTML)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import * as fs from 'fs/promises';
import { inlineCSS, inlineCSSUrls } from '@/inlining/css-inliner.js';
import * as urlUtils from '@/utils/url.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('@/logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock url utilities
vi.mock('@/utils/url.js', async () => {
  const actual = await vi.importActual<typeof urlUtils>('@/utils/url.js');
  return {
    ...actual,
    extractPathFromUrl: vi.fn((url: string) => actual.extractPathFromUrl(url)),
    safeResolvePath: vi.fn((base: string, path: string) => actual.safeResolvePath(base, path)),
  };
});

describe('CSS Inliner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('inlineCSS()', () => {
    describe('Successful CSS inlining', () => {
      it('should inline single CSS file from link tag', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/assets/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = 'body { margin: 0; padding: 0; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
        expect(result.totalSize).toBe(Buffer.byteLength(cssContent, 'utf-8'));
        expect(result.errors).toHaveLength(0);

        // Verify link tag was replaced with style tag
        expect($('link[rel="stylesheet"]').length).toBe(0);
        expect($('style').length).toBe(1);
        expect($('style').attr('type')).toBe('text/css');
        expect($('style').attr('data-inlined-from')).toBe('/assets/main.css');
        expect($('style').text()).toBe(cssContent);
      });

      it('should inline multiple CSS files in order', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/assets/reset.css">
              <link rel="stylesheet" href="/assets/main.css">
              <link rel="stylesheet" href="/assets/theme.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce('/* reset.css */ * { margin: 0; }')
          .mockResolvedValueOnce('/* main.css */ body { font-size: 16px; }')
          .mockResolvedValueOnce('/* theme.css */ .dark { background: black; }');

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(3);
        expect(result.errors).toHaveLength(0);

        // Verify all link tags replaced
        expect($('link[rel="stylesheet"]').length).toBe(0);
        expect($('style').length).toBe(3);

        // Verify order maintained
        const styles = $('style');
        expect(styles.eq(0).attr('data-inlined-from')).toBe('/assets/reset.css');
        expect(styles.eq(1).attr('data-inlined-from')).toBe('/assets/main.css');
        expect(styles.eq(2).attr('data-inlined-from')).toBe('/assets/theme.css');
      });

      it('should handle relative CSS paths correctly', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="assets/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.container { width: 100%; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/pages/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        // Verify safeResolvePath was called with correct arguments for relative path
        expect(urlUtils.safeResolvePath).toHaveBeenCalledWith(
          '_site/pages',
          'assets/main.css'
        );
      });

      it('should handle absolute CSS paths (starting with /)', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/assets/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.header { height: 60px; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/pages/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        // Verify safeResolvePath was called with site root for absolute path
        expect(urlUtils.safeResolvePath).toHaveBeenCalledWith('_site', 'assets/main.css');
      });

      it('should extract path from absolute URL (http://localhost)', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="http://localhost:8080/assets/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.nav { display: flex; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        // Verify extractPathFromUrl was called
        expect(urlUtils.extractPathFromUrl).toHaveBeenCalledWith(
          'http://localhost:8080/assets/main.css'
        );
      });

      it('should calculate total size correctly for multiple files', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/small.css">
              <link rel="stylesheet" href="/large.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const smallCss = 'a{}'; // 3 bytes
        const largeCss = 'body { background: linear-gradient(to right, red, blue); }'; // 57 bytes

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce(smallCss)
          .mockResolvedValueOnce(largeCss);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(2);
        expect(result.totalSize).toBe(
          Buffer.byteLength(smallCss, 'utf-8') + Buffer.byteLength(largeCss, 'utf-8')
        );
      });

      it('should preserve existing style tags when inlining', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>/* existing */ .inline { color: red; }</style>
              <link rel="stylesheet" href="/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.new { color: blue; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        // Verify both style tags exist
        expect($('style').length).toBe(2);
        expect($('style').eq(0).text()).toContain('.inline { color: red; }');
        expect($('style').eq(1).text()).toBe(cssContent);
      });
    });

    describe('Edge cases', () => {
      it('should handle HTML with no CSS files', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>No CSS</title>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(result.totalSize).toBe(0);
        expect(result.errors).toHaveLength(0);

        // Verify no fs.readFile calls
        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it('should skip link tags with missing href attribute', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet">
              <link rel="stylesheet" href="/valid.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.valid { display: block; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/index.html', '_site');

        // Should inline only the valid link
        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        // First link should still exist (skipped), second replaced
        expect($('link[rel="stylesheet"]').length).toBe(1);
        expect($('style').length).toBe(1);
      });

      it('should handle empty CSS file', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/empty.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue('');

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
        expect(result.totalSize).toBe(0);
        expect($('style').length).toBe(1);
        expect($('style').text()).toBe('');
      });

      it('should handle CSS with special characters', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/special.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.emoji::before { content: "🎨"; } .quote { content: "it\'s"; }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
        expect($('style').text()).toBe(cssContent);
      });

      it('should use custom siteRoot parameter', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/assets/main.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const cssContent = '.custom-root { }';

        vi.mocked(fs.readFile).mockResolvedValue(cssContent);

        const result = await inlineCSS($, 'custom-output/index.html', 'custom-output');

        expect(result.success).toBe(true);
        expect(urlUtils.safeResolvePath).toHaveBeenCalledWith('custom-output', 'assets/main.css');
      });
    });

    describe('Error handling', () => {
      it('should handle file not found error', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/missing.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const error = new Error('ENOENT: no such file or directory');
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        vi.mocked(fs.readFile).mockRejectedValue(error);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(false);
        expect(result.inlinedCount).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Failed to inline CSS file "/missing.css"');
        expect(result.errors[0]).toContain('ENOENT');

        // Link tag should remain (not replaced)
        expect($('link[rel="stylesheet"]').length).toBe(1);
      });

      it('should handle permission denied error', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/forbidden.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const error = new Error('EACCES: permission denied');
        (error as NodeJS.ErrnoException).code = 'EACCES';
        vi.mocked(fs.readFile).mockRejectedValue(error);

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('EACCES');
      });

      it('should continue processing other files after one fails', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/first.css">
              <link rel="stylesheet" href="/fails.css">
              <link rel="stylesheet" href="/third.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce('.first { }')
          .mockRejectedValueOnce(new Error('File read error'))
          .mockResolvedValueOnce('.third { }');

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(false); // Overall failure due to one error
        expect(result.inlinedCount).toBe(2); // But 2 files succeeded
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('/fails.css');

        // Two style tags created, one link remains
        expect($('style').length).toBe(2);
        expect($('link[rel="stylesheet"]').length).toBe(1);
      });

      it('should handle path traversal errors from safeResolvePath', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="../../etc/passwd">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(urlUtils.safeResolvePath).mockImplementation(() => {
          throw new Error('Path traversal attempt detected');
        });

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('Path traversal attempt detected');
      });

      it('should accumulate multiple errors from multiple failures', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <link rel="stylesheet" href="/error1.css">
              <link rel="stylesheet" href="/error2.css">
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockRejectedValueOnce(new Error('First error'))
          .mockRejectedValueOnce(new Error('Second error'));

        const result = await inlineCSS($, '_site/index.html', '_site');

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain('error1.css');
        expect(result.errors[0]).toContain('First error');
        expect(result.errors[1]).toContain('error2.css');
        expect(result.errors[1]).toContain('Second error');
      });
    });
  });

  describe('inlineCSSUrls()', () => {
    describe('Successful CSS URL inlining', () => {
      it('should inline url() references in style tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                @font-face {
                  font-family: 'MyFont';
                  src: url('fonts/myfont.woff2') format('woff2');
                }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const fontData = Buffer.from('fake-font-data');

        vi.mocked(fs.readFile).mockResolvedValue(fontData);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
        expect(result.totalSize).toBe(fontData.length);
        expect(result.errors).toHaveLength(0);

        // Verify url() was replaced with data URI
        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('url(\'data:font/woff2;base64,');
        expect(styleContent).not.toContain('url(\'fonts/myfont.woff2\')');
      });

      it('should handle multiple url() references in single style tag', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .bg1 { background: url('img/bg1.png'); }
                .bg2 { background: url('img/bg2.jpg'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce(Buffer.from('png-data'))
          .mockResolvedValueOnce(Buffer.from('jpg-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(2);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:image/png;base64,');
        expect(styleContent).toContain('data:image/jpeg;base64,');
      });

      it('should process multiple style tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>.icon { background: url('icons/star.svg'); }</style>
              <style>.font { font: url('fonts/main.woff'); }</style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce(Buffer.from('svg-data'))
          .mockResolvedValueOnce(Buffer.from('font-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(2);
      });

      it('should handle url() with double quotes', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .bg { background: url("images/bg.png"); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('image-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
      });

      it('should handle url() without quotes', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .bg { background: url(images/bg.png); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('image-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);
      });

      it('should correctly identify MIME types for different file extensions', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .woff { font: url('f.woff'); }
                .woff2 { font: url('f.woff2'); }
                .ttf { font: url('f.ttf'); }
                .eot { font: url('f.eot'); }
                .svg { background: url('i.svg'); }
                .png { background: url('i.png'); }
                .jpg { background: url('i.jpg'); }
                .jpeg { background: url('i.jpeg'); }
                .gif { background: url('i.gif'); }
                .webp { background: url('i.webp'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(10);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:font/woff;base64,');
        expect(styleContent).toContain('data:font/woff2;base64,');
        expect(styleContent).toContain('data:font/ttf;base64,');
        expect(styleContent).toContain('data:application/vnd.ms-fontobject;base64,');
        expect(styleContent).toContain('data:image/svg+xml;base64,');
        expect(styleContent).toContain('data:image/png;base64,');
        expect(styleContent).toContain('data:image/jpeg;base64,');
        expect(styleContent).toContain('data:image/gif;base64,');
        expect(styleContent).toContain('data:image/webp;base64,');
      });

      it('should use fallback MIME type for unknown extensions', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .unknown { background: url('file.unknown'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:application/octet-stream;base64,');
      });

      it('should handle files without extensions', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .no-ext { background: url('file-no-ext'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:application/octet-stream;base64,');
      });

      it('should handle uppercase file extensions', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .upper { background: url('IMAGE.PNG'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:image/png;base64,');
      });

      it('should correctly base64 encode binary data', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .img { background: url('test.png'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);
        const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

        vi.mocked(fs.readFile).mockResolvedValue(binaryData);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);

        const styleContent = $('style').html() || '';
        const expectedBase64 = binaryData.toString('base64');
        expect(styleContent).toContain(`data:image/png;base64,${expectedBase64}`);
      });
    });

    describe('Edge cases', () => {
      it('should return success with zero count when no style tags exist', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>No styles</title>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(result.totalSize).toBe(0);
        expect(result.errors).toHaveLength(0);

        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it('should skip data URIs (already inlined)', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .already { background: url('data:image/png;base64,iVBORw0KGgo='); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();

        // Data URI should remain unchanged
        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('url(\'data:image/png;base64,iVBORw0KGgo=\')');
      });

      it('should skip absolute HTTP URLs', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .external { background: url('http://example.com/image.png'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('url(\'http://example.com/image.png\')');
      });

      it('should skip absolute HTTPS URLs', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .cdn { background: url('https://cdn.example.com/font.woff2'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it('should handle empty style tags', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style></style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
      });

      it('should handle style tags with no url() references', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { margin: 0; padding: 0; }
                .container { display: flex; }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it('should handle mixed local and external URLs', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .local { background: url('local.png'); }
                .external { background: url('https://cdn.example.com/ext.png'); }
                .data { background: url('data:image/png;base64,ABC='); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('local-image-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(1); // Only local file

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:image/png;base64,'); // Local inlined
        expect(styleContent).toContain('url(\'https://cdn.example.com/ext.png\')'); // External unchanged
      });

      it('should preserve CSS content outside url() references', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                /* Comment before */
                .class {
                  color: red;
                  background: url('bg.png') no-repeat center;
                  padding: 10px;
                }
                /* Comment after */
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('bg-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('/* Comment before */');
        expect(styleContent).toContain('color: red;');
        expect(styleContent).toContain('padding: 10px;');
        expect(styleContent).toContain('/* Comment after */');
        expect(styleContent).toContain('no-repeat center');
      });
    });

    describe('Error handling', () => {
      it('should not fail overall if url() file cannot be read', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .missing { background: url('missing.png'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        const result = await inlineCSSUrls($, '_site/index.html');

        // Success is still true - url() failures don't fail the process
        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(result.errors).toHaveLength(0);

        // Original url() should remain unchanged
        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('url(\'missing.png\')');
      });

      it('should continue processing other urls after one fails', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .first { background: url('first.png'); }
                .fails { background: url('fails.png'); }
                .third { background: url('third.png'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(fs.readFile)
          .mockResolvedValueOnce(Buffer.from('first-data'))
          .mockRejectedValueOnce(new Error('Read error'))
          .mockResolvedValueOnce(Buffer.from('third-data'));

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(2); // First and third succeeded

        const styleContent = $('style').html() || '';
        expect(styleContent).toContain('data:image/png;base64,'); // Successful inlines
        expect(styleContent).toContain('url(\'fails.png\')'); // Failed one unchanged
      });

      it('should handle path traversal errors gracefully', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .attack { background: url('../../etc/passwd'); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        vi.mocked(urlUtils.safeResolvePath).mockImplementation(() => {
          throw new Error('Path traversal attempt detected');
        });

        const result = await inlineCSSUrls($, '_site/index.html');

        // Should not fail overall, just skip the problematic url
        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
      });

      it('should handle empty url() value', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                .empty { background: url(''); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it('should handle malformed url() with undefined capture group', async () => {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                /* This malformed url() should be skipped */
                .malformed { background: url(); }
              </style>
            </head>
            <body></body>
          </html>
        `;
        const $: CheerioAPI = load(html);

        const result = await inlineCSSUrls($, '_site/index.html');

        expect(result.success).toBe(true);
        expect(result.inlinedCount).toBe(0);
        expect(fs.readFile).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work with typical GOV.UK Design System page', async () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>GOV.UK Status</title>
            <link rel="stylesheet" href="/assets/govuk-frontend.min.css">
            <link rel="stylesheet" href="/assets/application.css">
            <style>
              .custom-icon { background: url('icons/check.svg'); }
            </style>
          </head>
          <body class="govuk-template__body">
            <main class="govuk-main-wrapper">
              <h1 class="govuk-heading-xl">Status</h1>
            </main>
          </body>
        </html>
      `;
      const $: CheerioAPI = load(html);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('/* govuk-frontend.min.css */ .govuk-body { font-family: sans-serif; }')
        .mockResolvedValueOnce('/* application.css */ .status-page { padding: 20px; }')
        .mockResolvedValueOnce(Buffer.from('<svg>...</svg>'));

      // First inline CSS files
      const cssResult = await inlineCSS($, '_site/index.html', '_site');
      expect(cssResult.success).toBe(true);
      expect(cssResult.inlinedCount).toBe(2);

      // Then inline CSS urls
      const urlsResult = await inlineCSSUrls($, '_site/index.html');
      expect(urlsResult.success).toBe(true);
      expect(urlsResult.inlinedCount).toBe(1);

      // Verify final state
      expect($('link[rel="stylesheet"]').length).toBe(0);
      expect($('style').length).toBe(3); // 2 from CSS files + 1 existing
    });

    it('should handle large files efficiently', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/large.css">
          </head>
          <body></body>
        </html>
      `;
      const $: CheerioAPI = load(html);

      // Create large CSS content (100KB)
      const largeCss = 'a'.repeat(100 * 1024);
      vi.mocked(fs.readFile).mockResolvedValue(largeCss);

      const result = await inlineCSS($, '_site/index.html', '_site');

      expect(result.success).toBe(true);
      expect(result.totalSize).toBe(Buffer.byteLength(largeCss, 'utf-8'));
      expect($('style').text()).toBe(largeCss);
    });
  });
});
