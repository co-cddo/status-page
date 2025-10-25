/**
 * Unit tests for Image Inliner
 *
 * Tests image file inlining, data URI conversion, CSS url() handling, and MIME type detection.
 */

import { describe, it, expect } from 'vitest';
import { load } from 'cheerio';
import { join } from 'path';
import {
  inlineImages,
  inlineCSSImages,
  verifyNoExternalImages,
} from '../../../src/inlining/image-inliner.js';

const FIXTURES_DIR = 'tests/fixtures/inlining';

describe('Image Inliner', () => {
  describe('inlineImages()', () => {
    it('should inline single image file as data URI', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="Test">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify src converted to data URI
      const src = $('img').attr('src');
      expect(src).toMatch(/^data:image\/png;base64,/);
      expect(src).not.toContain('images/test.png');

      // Verify data-original-src attribute preserved
      expect($('img').attr('data-original-src')).toBe('images/test.png');
    });

    it('should inline multiple images', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="PNG">
            <img src="images/logo.svg" alt="SVG">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(2);

      // Verify both converted to data URIs
      const img1Src = $('img').eq(0).attr('src');
      const img2Src = $('img').eq(1).attr('src');
      expect(img1Src).toMatch(/^data:image\/png;base64,/);
      expect(img2Src).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should handle absolute paths from site root', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="/images/test.png" alt="Test">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'pages/index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should reject localhost URLs as external images', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="http://localhost:8080/images/test.png" alt="Test">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      // localhost URLs with http:// are treated as external
      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip images already inlined as data URIs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="data:image/png;base64,iVBORw0KGgo=" alt="Already inlined">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0); // Already inlined
    });

    it('should report errors for external images (http)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="http://example.com/image.png" alt="External">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('external image');
      expect(result.errors[0]).toContain('example.com');
    });

    it('should report errors for external images (https)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="https://cdn.example.com/logo.svg" alt="External">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors[0]).toContain('Self-contained HTML');
    });

    it('should report errors for missing image files', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/nonexistent.png" alt="Missing">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nonexistent.png');
    });

    it('should return empty result when no images found', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body><p>No images</p></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip images with missing src attribute', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img alt="No src">
            <img src="images/test.png" alt="Valid">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1); // Only valid image
    });

    it('should handle partial failures gracefully', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="Valid">
            <img src="images/missing.jpg" alt="Missing">
            <img src="images/logo.svg" alt="Valid">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(2); // Two successful
      expect(result.errors.length).toBe(1); // One error
    });

    it('should use correct MIME types for different formats', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="PNG">
            <img src="images/logo.svg" alt="SVG">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      await inlineImages($, htmlPath, FIXTURES_DIR);

      const pngSrc = $('img').eq(0).attr('src');
      const svgSrc = $('img').eq(1).attr('src');

      expect(pngSrc).toMatch(/^data:image\/png;base64,/);
      expect(svgSrc).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should calculate total size correctly', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="PNG">
            <img src="images/logo.svg" alt="SVG">
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineImages($, htmlPath, FIXTURES_DIR);

      // Size should be positive (combined size of both images)
      expect(result.totalSize).toBeGreaterThan(0);
    });
  });

  describe('inlineCSSImages()', () => {
    it('should inline image url() references in style tags', async () => {
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
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);

      // Verify url() converted to data URI
      const styleContent = $('style').html();
      expect(styleContent).toContain('data:image/svg+xml;base64,');
      expect(styleContent).not.toContain('images/logo.svg');
    });

    it('should inline image url() references in style attributes', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div style="background-image: url('images/test.png');"></div>
          </body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);

      // Verify inline style converted to data URI
      const styleAttr = $('div').attr('style');
      expect(styleAttr).toContain('data:image/png;base64,');
      expect(styleAttr).not.toContain('images/test.png');
    });

    it('should skip data URIs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .icon {
                background: url('data:image/png;base64,iVBORw0KGgo=');
              }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

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
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });

    it('should skip font files (not images)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              @font-face {
                src: url('fonts/font.woff2');
              }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0); // Fonts are not images
    });

    it('should handle multiple image url() references', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .logo { background: url('images/logo.svg'); }
              .icon { background: url('images/test.png'); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'index.html');
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

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
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      // Should not fail entirely for CSS url() failures
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
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
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);
    });

    it('should handle absolute paths from site root', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .logo { background: url('/images/logo.svg'); }
            </style>
          </head>
          <body></body>
        </html>
      `;

      const $ = load(html);
      const htmlPath = join(FIXTURES_DIR, 'pages/index.html');
      const result = await inlineCSSImages($, htmlPath, FIXTURES_DIR);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });
  });

  describe('verifyNoExternalImages()', () => {
    it('should return empty array when no external images found', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="Local">
            <img src="data:image/png;base64,iVBORw0KGgo=" alt="Data URI">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toEqual([]);
    });

    it('should detect external HTTP images', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="http://example.com/image.png" alt="External">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toHaveLength(1);
      expect(externalImages[0]).toBe('http://example.com/image.png');
    });

    it('should detect external HTTPS images', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="https://cdn.example.com/logo.svg" alt="External">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toHaveLength(1);
      expect(externalImages[0]).toBe('https://cdn.example.com/logo.svg');
    });

    it('should detect multiple external images', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="https://cdn1.example.com/img1.png" alt="External 1">
            <img src="images/local.png" alt="Local">
            <img src="https://cdn2.example.com/img2.png" alt="External 2">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toHaveLength(2);
      expect(externalImages).toContain('https://cdn1.example.com/img1.png');
      expect(externalImages).toContain('https://cdn2.example.com/img2.png');
    });

    it('should ignore data URIs', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="data:image/png;base64,iVBORw0KGgo=" alt="Data URI">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toEqual([]);
    });

    it('should ignore local image paths', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <img src="images/test.png" alt="Relative">
            <img src="/images/logo.svg" alt="Absolute">
          </body>
        </html>
      `;

      const $ = load(html);
      const externalImages = verifyNoExternalImages($);

      expect(externalImages).toEqual([]);
    });
  });
});
