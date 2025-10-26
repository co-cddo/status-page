/**
 * Unit tests for Image Inliner (T044 - Code Coverage Phase)
 *
 * Constitutional Compliance:
 * - Principle III: Tests validate existing implementation
 * - Principle X: No external services - Mock filesystem operations
 *
 * Test Requirements:
 * - Test image inlining from <img> tags
 * - Test CSS background image inlining
 * - Test base64 encoding of images
 * - Test MIME type detection for various formats
 * - Test error handling for missing/unreadable files
 * - Test security validation (path traversal)
 * - Test external image detection and skipping
 * - Test data URI generation
 * - Test verification of no external images
 *
 * Coverage Target: 80%+ (branch and line)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  inlineImages,
  inlineCSSImages,
  verifyNoExternalImages,
} from '../../../src/inlining/image-inliner.ts';
import { readFile } from 'fs/promises';
import type { CheerioAPI } from 'cheerio';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../../src/logging/logger.ts', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock('../../../src/utils/url.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/url.ts')>(
    '../../../src/utils/url.ts'
  );
  return {
    extractPathFromUrl: actual.extractPathFromUrl,
    safeResolvePath: actual.safeResolvePath,
  };
});
vi.mock('../../../src/utils/error.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/error.ts')>(
    '../../../src/utils/error.ts'
  );
  return {
    getErrorMessage: actual.getErrorMessage,
  };
});

// Helper to create a mock Cheerio instance
function createMockCheerio(html: string): CheerioAPI {
  const elements = new Map<string, Array<{ attr: Map<string, string>; html: string }>>();

  // Parse simple HTML for testing
  const imgRegex = /<img\s+([^>]*)>/gi;
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  // Match style attribute - capture everything until the closing quote that matches the opening quote
  const elementsWithStyleRegex = /<(\w+)\s+[^>]*style=(["'])((?:(?!\2).)*)\2[^>]*>/gi;

  const imgTags: Array<{ attr: Map<string, string>; html: string }> = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = new Map<string, string>();
    const attrString = match[1]!;
    const srcMatch = /src=["']([^"']*)["']/.exec(attrString);
    if (srcMatch) {
      attrs.set('src', srcMatch[1]!);
    }
    imgTags.push({ attr: attrs, html: match[0]! });
  }
  elements.set('img[src]', imgTags);

  const styleTags: string[] = [];
  while ((match = styleTagRegex.exec(html)) !== null) {
    styleTags.push(match[1]!);
  }

  const elementsWithStyleAttr: Array<{ attr: Map<string, string>; html: string }> = [];
  // Reset regex state
  elementsWithStyleRegex.lastIndex = 0;
  while ((match = elementsWithStyleRegex.exec(html)) !== null) {
    const attrs = new Map<string, string>();
    // match[1] = tag name, match[2] = quote char, match[3] = style content
    const styleValue = match[3]!;
    attrs.set('style', styleValue);
    // Also parse other attributes if needed
    const fullMatch = match[0]!;
    const classMatch = /class=["']([^"']*)["']/.exec(fullMatch);
    if (classMatch) {
      attrs.set('class', classMatch[1]!);
    }
    elementsWithStyleAttr.push({ attr: attrs, html: fullMatch });
  }
  elements.set('[style]', elementsWithStyleAttr);

  const $ = ((selectorOrElem: string | { attr: Map<string, string> }) => {
    // Handle wrapping an element object (used in verifyNoExternalImages)
    if (typeof selectorOrElem === 'object' && 'attr' in selectorOrElem) {
      return {
        attr: (name: string) => selectorOrElem.attr.get(name),
      };
    }

    const selector = selectorOrElem as string;
    const elemArray = elements.get(selector) || [];
    let currentIndex = 0;

    const api = {
      length: selector === 'style' ? styleTags.length : elemArray.length,
      eq: (index: number) => {
        currentIndex = index;
        return {
          attr: (name: string, value?: string) => {
            if (selector === 'style') {
              if (value !== undefined) {
                styleTags[index] = value;
                return api.eq(index);
              }
              return undefined;
            }

            const elem = elemArray[index];
            if (!elem) return undefined;

            if (value !== undefined) {
              elem.attr.set(name, value);
              return api.eq(index);
            }
            return elem.attr.get(name);
          },
          html: (value?: string) => {
            if (selector === 'style') {
              if (value !== undefined) {
                styleTags[index] = value;
                return api.eq(index);
              }
              return styleTags[index];
            }
            const elem = elemArray[index];
            return elem?.html;
          },
        };
      },
      each: (callback: (index: number, elem: unknown) => void) => {
        if (selector === 'style') {
          styleTags.forEach((_, index) => callback(index, {}));
        } else {
          elemArray.forEach((elem, index) => callback(index, elem));
        }
      },
      attr: (name: string) => {
        // Used by verifyNoExternalImages for $(elem).attr('src')
        const elem = elemArray[currentIndex];
        return elem?.attr.get(name);
      },
    };

    return api;
  }) as unknown as CheerioAPI;

  return $;
}

describe('Image Inliner (T044)', () => {
  const mockHtmlPath = '/test/_site/index.html';
  const mockSiteRoot = '/test/_site';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('inlineImages - Basic Functionality', () => {
    it('should inline a single PNG image as data URI', async () => {
      const html = '<img src="/assets/logo.png" alt="Logo">';
      const $ = createMockCheerio(html);

      const mockImageBuffer = Buffer.from('fake-png-data');
      vi.mocked(readFile).mockResolvedValue(mockImageBuffer);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBe(mockImageBuffer.length);
      expect(result.errors).toHaveLength(0);
    });

    it('should inline multiple images', async () => {
      const html = `
        <img src="/assets/logo.png" alt="Logo">
        <img src="/assets/icon.jpg" alt="Icon">
        <img src="/assets/banner.svg" alt="Banner">
      `;
      const $ = createMockCheerio(html);

      const mockImageBuffer = Buffer.from('fake-image-data');
      vi.mocked(readFile).mockResolvedValue(mockImageBuffer);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);
      expect(result.totalSize).toBe(mockImageBuffer.length * 3);
    });

    it('should handle base64 encoding correctly', async () => {
      const html = '<img src="/assets/test.png">';
      const $ = createMockCheerio(html);

      const mockImageBuffer = Buffer.from('test-image-content');
      vi.mocked(readFile).mockResolvedValue(mockImageBuffer);

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      // Verify readFile was called with correct path
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(expect.stringContaining('assets/test.png'));
    });

    it('should set data-original-src attribute', async () => {
      const html = '<img src="/assets/logo.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      expect(img.attr('data-original-src')).toBe('/assets/logo.png');
    });

    it('should handle empty HTML with no images', async () => {
      const html = '<div>No images here</div>';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });
  });

  describe('inlineImages - MIME Type Detection', () => {
    it('should detect PNG MIME type', async () => {
      const html = '<img src="/test.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/png;base64,');
    });

    it('should detect JPEG MIME type for .jpg extension', async () => {
      const html = '<img src="/test.jpg">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/jpeg;base64,');
    });

    it('should detect JPEG MIME type for .jpeg extension', async () => {
      const html = '<img src="/test.jpeg">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/jpeg;base64,');
    });

    it('should detect SVG MIME type', async () => {
      const html = '<img src="/icon.svg">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('<svg></svg>'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/svg+xml;base64,');
    });

    it('should detect ICO MIME type', async () => {
      const html = '<img src="/favicon.ico">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('icon-data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/x-icon;base64,');
    });

    it('should detect GIF MIME type', async () => {
      const html = '<img src="/animation.gif">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('gif-data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/gif;base64,');
    });

    it('should detect WebP MIME type', async () => {
      const html = '<img src="/photo.webp">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('webp-data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/webp;base64,');
    });

    it('should detect BMP MIME type', async () => {
      const html = '<img src="/bitmap.bmp">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('bmp-data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/bmp;base64,');
    });

    it('should use default MIME type for unknown extensions', async () => {
      const html = '<img src="/file.xyz">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:application/octet-stream;base64,');
    });

    it('should handle uppercase file extensions', async () => {
      const html = '<img src="/photo.PNG">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      const img = $('img[src]').eq(0);
      const src = img.attr('src');
      expect(src).toContain('data:image/png;base64,');
    });
  });

  describe('inlineImages - Skip Conditions', () => {
    it('should skip images that are already data URIs', async () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should skip http:// external images and mark as error', async () => {
      const html = '<img src="http://example.com/image.png">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('external image');
      expect(result.errors[0]).toContain('http://example.com/image.png');
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should skip https:// external images and mark as error', async () => {
      const html = '<img src="https://cdn.example.com/logo.svg">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('external image');
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should skip img tags without src attribute', async () => {
      const html = '<img alt="No source">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });
  });

  describe('inlineImages - Error Handling', () => {
    it('should handle file not found errors gracefully', async () => {
      const html = '<img src="/missing.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: File not found'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to inline image');
      expect(result.errors[0]).toContain('/missing.png');
    });

    it('should handle permission denied errors', async () => {
      const html = '<img src="/protected.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockRejectedValue(new Error('EACCES: Permission denied'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Permission denied');
    });

    it('should continue processing after individual file errors', async () => {
      const html = `
        <img src="/good1.png">
        <img src="/bad.png">
        <img src="/good2.png">
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile)
        .mockResolvedValueOnce(Buffer.from('good1'))
        .mockRejectedValueOnce(new Error('Read error'))
        .mockResolvedValueOnce(Buffer.from('good2'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(2);
      expect(result.errors.length).toBe(1);
    });

    it('should handle empty src attribute', async () => {
      const html = '<img src="">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });
  });

  describe('inlineImages - Path Resolution', () => {
    it('should resolve absolute paths from site root', async () => {
      const html = '<img src="/assets/logo.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(vi.mocked(readFile)).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\/_site\/assets\/logo\.png$/)
      );
    });

    it('should handle relative paths from HTML directory', async () => {
      const html = '<img src="images/photo.jpg">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      await inlineImages($, '/test/_site/pages/index.html', mockSiteRoot);

      expect(vi.mocked(readFile)).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\/_site\/pages\/images\/photo\.jpg$/)
      );
    });

    it('should skip localhost URLs (treated as external)', async () => {
      const html = '<img src="http://localhost:8080/assets/icon.png">';
      const $ = createMockCheerio(html);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      // Localhost URLs are treated as external and skipped
      expect(result.success).toBe(false);
      expect(result.inlinedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('external image');
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });
  });

  describe('inlineCSSImages - Basic Functionality', () => {
    it('should inline CSS background images from <style> tags', async () => {
      const html = `
        <style>
          .hero { background-image: url('/assets/bg.jpg'); }
        </style>
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('bg-data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('should inline multiple CSS url() references', async () => {
      const html = `
        <style>
          .hero { background-image: url('/bg1.png'); }
          .footer { background: url("/bg2.jpg") no-repeat; }
          .icon::before { content: url('/icon.svg'); }
        </style>
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('image-data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(3);
    });

    it('should handle url() without quotes', async () => {
      const html = '<style>.bg { background: url(/image.png); }</style>';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should handle url() with single quotes', async () => {
      const html = "<style>.bg { background: url('/image.png'); }</style>";
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should handle url() with double quotes', async () => {
      const html = '<style>.bg { background: url("/image.png"); }</style>';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should skip data URIs in CSS', async () => {
      const html = '<style>.bg { background: url(data:image/png;base64,abc); }</style>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should skip external URLs in CSS', async () => {
      const html = '<style>.bg { background: url(https://example.com/bg.jpg); }</style>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should skip non-image files (fonts)', async () => {
      const html = `
        <style>
          @font-face {
            src: url('/fonts/font.woff2');
          }
        </style>
      `;
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
      expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    });

    it('should only process image file extensions', async () => {
      const html = `
        <style>
          .font { src: url('/font.woff'); }
          .image { background: url('/bg.png'); }
          .pdf { src: url('/doc.pdf'); }
        </style>
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(1); // Only PNG
    });
  });

  describe('inlineCSSImages - Inline Style Attributes', () => {
    it('should inline images from inline style attributes', async () => {
      const html = '<div style="background-image: url(\'/bg.png\')"></div>';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('bg-data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
    });

    it('should process multiple elements with style attributes', async () => {
      const html =
        '<div style="background: url(\'/bg1.jpg\')"></div><span style="background-image: url(\'/bg2.png\')"></span>';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(2);
    });

    it('should skip data URIs in inline styles', async () => {
      const html = '<div style="background: url(data:image/png;base64,abc)"></div>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
    });

    it('should skip external URLs in inline styles', async () => {
      const html = '<div style="background: url(http://example.com/bg.png)"></div>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
    });

    it('should skip non-image files in inline styles', async () => {
      const html = '<div style="background: url(\'/font.woff\')"></div>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.inlinedCount).toBe(0);
    });
  });

  describe('inlineCSSImages - Error Handling', () => {
    it('should not fail entire process on CSS image errors', async () => {
      const html = `
        <style>
          .bg1 { background: url('/missing.png'); }
          .bg2 { background: url('/exists.jpg'); }
        </style>
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(Buffer.from('data'));

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      // Should still succeed overall
      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1); // Only successful one
    });

    it('should handle empty style tags gracefully', async () => {
      const html = '<style></style>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });

    it('should handle HTML with no style tags', async () => {
      const html = '<div>No styles here</div>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });

    it('should handle elements without style attributes', async () => {
      const html = '<div class="test">No inline styles</div>';
      const $ = createMockCheerio(html);

      const result = await inlineCSSImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(0);
    });
  });

  describe('verifyNoExternalImages - Verification', () => {
    it('should return empty array when no external images present', () => {
      const html = `
        <img src="data:image/png;base64,abc">
        <img src="/local/image.png">
      `;
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(0);
    });

    it('should detect http:// external images', () => {
      const html = '<img src="http://example.com/image.png">';
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(1);
      expect(external[0]).toBe('http://example.com/image.png');
    });

    it('should detect https:// external images', () => {
      const html = '<img src="https://cdn.example.com/logo.svg">';
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(1);
      expect(external[0]).toBe('https://cdn.example.com/logo.svg');
    });

    it('should detect multiple external images', () => {
      const html = `
        <img src="http://example.com/img1.png">
        <img src="https://cdn.example.com/img2.jpg">
        <img src="/local.png">
      `;
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(2);
      expect(external).toContain('http://example.com/img1.png');
      expect(external).toContain('https://cdn.example.com/img2.jpg');
    });

    it('should not flag data URIs as external', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=">';
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(0);
    });

    it('should not flag local absolute paths as external', () => {
      const html = '<img src="/assets/logo.png">';
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(0);
    });

    it('should not flag local relative paths as external', () => {
      const html = '<img src="images/photo.jpg">';
      const $ = createMockCheerio(html);

      const external = verifyNoExternalImages($);

      expect(external).toHaveLength(0);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle mixed successful and failed inlines', async () => {
      const html = `
        <img src="/good1.png">
        <img src="https://external.com/bad.jpg">
        <img src="data:image/png;base64,already">
        <img src="/good2.svg">
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(false); // External image error
      expect(result.inlinedCount).toBe(2); // good1.png and good2.svg
      expect(result.errors.length).toBe(1); // External image
    });

    it('should accumulate total size correctly across multiple images', async () => {
      const html = `
        <img src="/small.png">
        <img src="/large.jpg">
      `;
      const $ = createMockCheerio(html);

      vi.mocked(readFile)
        .mockResolvedValueOnce(Buffer.from('a'.repeat(100)))
        .mockResolvedValueOnce(Buffer.from('b'.repeat(500)));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.totalSize).toBe(600);
    });

    it('should handle zero-byte images', async () => {
      const html = '<img src="/empty.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from(''));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.inlinedCount).toBe(1);
      expect(result.totalSize).toBe(0);
    });

    it('should handle very large images', async () => {
      const html = '<img src="/huge.png">';
      const $ = createMockCheerio(html);

      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      vi.mocked(readFile).mockResolvedValue(largeBuffer);

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result.success).toBe(true);
      expect(result.totalSize).toBe(10 * 1024 * 1024);
    });

    it('should return consistent result structure on success', async () => {
      const html = '<img src="/test.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockResolvedValue(Buffer.from('data'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('inlinedCount');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('errors');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.inlinedCount).toBe('number');
      expect(typeof result.totalSize).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return consistent result structure on error', async () => {
      const html = '<img src="/missing.png">';
      const $ = createMockCheerio(html);

      vi.mocked(readFile).mockRejectedValue(new Error('Not found'));

      const result = await inlineImages($, mockHtmlPath, mockSiteRoot);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('inlinedCount');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('errors');
      expect(result.success).toBe(false);
    });
  });
});
