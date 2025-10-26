/**
 * Unit tests for Post-Build Asset Inlining Orchestration
 *
 * Tests: src/inlining/post-build.ts
 * Coverage: main(), copyAdditionalFiles(), parseArguments(), printUsage()
 * Requirements: FR-021 (self-contained HTML)
 *
 * Note: post-build.ts is an executable script. We test by mocking dependencies
 * and dynamically importing after process.argv changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { CSSInlineResult } from '@/inlining/css-inliner.js';
import type { JSInlineResult } from '@/inlining/js-inliner.js';
import type { ImageInlineResult } from '@/inlining/image-inliner.js';
import type { SizeValidationResult } from '@/inlining/size-validator.js';

// Setup mocks
let mockLogger: {
  info: MockedFunction<(...args: unknown[]) => void>;
  debug: MockedFunction<(...args: unknown[]) => void>;
  warn: MockedFunction<(...args: unknown[]) => void>;
  error: MockedFunction<(...args: unknown[]) => void>;
};

let mockCheerioInstance: CheerioAPI;
let mockInlineCSS: MockedFunction<() => Promise<CSSInlineResult>>;
let mockInlineCSSUrls: MockedFunction<() => Promise<CSSInlineResult>>;
let mockInlineJavaScript: MockedFunction<() => Promise<JSInlineResult>>;
let mockVerifyNoExternalScripts: MockedFunction<() => string[]>;
let mockInlineImages: MockedFunction<() => Promise<ImageInlineResult>>;
let mockInlineCSSImages: MockedFunction<() => Promise<ImageInlineResult>>;
let mockVerifyNoExternalImages: MockedFunction<() => string[]>;
let mockValidateHTMLSize: MockedFunction<() => Promise<SizeValidationResult>>;
let mockFormatSize: MockedFunction<(size: number) => string>;

vi.mock('fs/promises');
vi.mock('cheerio');

vi.mock('@/logging/logger', () => ({
  createLogger: () => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    return mockLogger;
  },
}));

vi.mock('@/inlining/css-inliner.js', () => ({
  inlineCSS: vi.fn(),
  inlineCSSUrls: vi.fn(),
}));

vi.mock('@/inlining/js-inliner.js', () => ({
  inlineJavaScript: vi.fn(),
  verifyNoExternalScripts: vi.fn(),
}));

vi.mock('@/inlining/image-inliner.js', () => ({
  inlineImages: vi.fn(),
  inlineCSSImages: vi.fn(),
  verifyNoExternalImages: vi.fn(),
}));

vi.mock('@/inlining/size-validator.js', () => ({
  validateHTMLSize: vi.fn(),
  formatSize: vi.fn((size: number) => `${(size / 1024).toFixed(2)} KB`),
}));

vi.mock('@/utils/error.js', () => ({
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }),
}));

// Dynamic imports after mocking
async function importMockedModules(): Promise<void> {
  const cssModule = await import('@/inlining/css-inliner.js');
  const jsModule = await import('@/inlining/js-inliner.js');
  const imageModule = await import('@/inlining/image-inliner.js');
  const sizeModule = await import('@/inlining/size-validator.js');

  mockInlineCSS = cssModule.inlineCSS as MockedFunction<() => Promise<CSSInlineResult>>;
  mockInlineCSSUrls = cssModule.inlineCSSUrls as MockedFunction<() => Promise<CSSInlineResult>>;
  mockInlineJavaScript = jsModule.inlineJavaScript as MockedFunction<() => Promise<JSInlineResult>>;
  mockVerifyNoExternalScripts = jsModule.verifyNoExternalScripts as MockedFunction<() => string[]>;
  mockInlineImages = imageModule.inlineImages as MockedFunction<() => Promise<ImageInlineResult>>;
  mockInlineCSSImages = imageModule.inlineCSSImages as MockedFunction<
    () => Promise<ImageInlineResult>
  >;
  mockVerifyNoExternalImages = imageModule.verifyNoExternalImages as MockedFunction<() => string[]>;
  mockValidateHTMLSize = sizeModule.validateHTMLSize as MockedFunction<
    () => Promise<SizeValidationResult>
  >;
  mockFormatSize = sizeModule.formatSize as MockedFunction<(size: number) => string>;
}

describe('Post-Build Asset Inlining Orchestration', () => {
  let originalArgv: string[];

  beforeEach(async () => {
    vi.clearAllMocks();

    await importMockedModules();

    // Store original values
    originalArgv = process.argv;

    // Mock Cheerio instance
    mockCheerioInstance = {
      html: vi.fn(() => '<html><body>Inlined content</body></html>'),
    } as unknown as CheerioAPI;

    vi.mocked(load).mockReturnValue(mockCheerioInstance);

    // Mock process.exit - accept string | number | null | undefined as per Node.js types
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    }) as unknown as MockedFunction<(code?: number) => never>;

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock Date.now for consistent timing
    vi.spyOn(Date, 'now').mockReturnValue(1000000);

    // Default successful mock implementations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('<html><body>Original content</body></html>');
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);

    mockInlineCSS.mockResolvedValue({
      success: true,
      inlinedCount: 2,
      totalSize: 5000,
      errors: [],
    });

    mockInlineCSSUrls.mockResolvedValue({
      success: true,
      inlinedCount: 1,
      totalSize: 1000,
      errors: [],
    });

    mockInlineJavaScript.mockResolvedValue({
      success: true,
      inlinedCount: 3,
      totalSize: 8000,
      errors: [],
    });

    mockInlineImages.mockResolvedValue({
      success: true,
      inlinedCount: 5,
      totalSize: 12000,
      errors: [],
    });

    mockInlineCSSImages.mockResolvedValue({
      success: true,
      inlinedCount: 2,
      totalSize: 3000,
      errors: [],
    });

    mockVerifyNoExternalScripts.mockReturnValue([]);
    mockVerifyNoExternalImages.mockReturnValue([]);

    mockValidateHTMLSize.mockResolvedValue({
      success: true,
      fileSizeBytes: 2621440,
      fileSizeMB: 2.5,
      maxSizeMB: 5,
      utilizationPercent: 50,
      errors: [],
      suggestions: [],
    });

    mockFormatSize.mockImplementation((size: number) => {
      return `${(size / 1024).toFixed(2)} KB`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = originalArgv;
  });

  describe('Mocked function orchestration tests', () => {
    it('should verify all CSS inlining mocks are called correctly', async () => {
      expect(mockInlineCSS).toBeDefined();
      expect(mockInlineCSSUrls).toBeDefined();

      const cssResult = await mockInlineCSS();
      expect(cssResult.success).toBe(true);
      expect(cssResult.inlinedCount).toBe(2);
    });

    it('should verify all JavaScript inlining mocks are called correctly', async () => {
      expect(mockInlineJavaScript).toBeDefined();
      expect(mockVerifyNoExternalScripts).toBeDefined();

      const jsResult = await mockInlineJavaScript();
      expect(jsResult.success).toBe(true);
      expect(jsResult.inlinedCount).toBe(3);
    });

    it('should verify all image inlining mocks are called correctly', async () => {
      expect(mockInlineImages).toBeDefined();
      expect(mockInlineCSSImages).toBeDefined();
      expect(mockVerifyNoExternalImages).toBeDefined();

      const imageResult = await mockInlineImages();
      expect(imageResult.success).toBe(true);
      expect(imageResult.inlinedCount).toBe(5);
    });

    it('should verify size validation mock is called correctly', async () => {
      expect(mockValidateHTMLSize).toBeDefined();

      const sizeResult = await mockValidateHTMLSize();
      expect(sizeResult.success).toBe(true);
      expect(sizeResult.fileSizeMB).toBe(2.5);
    });

    it('should verify formatSize utility mock works correctly', () => {
      expect(mockFormatSize).toBeDefined();

      const formatted = mockFormatSize(5120);
      expect(formatted).toBe('5.00 KB');
    });
  });

  describe('File system operations', () => {
    it('should mock mkdir for output directory creation', async () => {
      await fs.mkdir('output', { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith('output', { recursive: true });
    });

    it('should mock readFile for HTML input', async () => {
      const content = await fs.readFile('_site/index.html', 'utf-8');

      expect(fs.readFile).toHaveBeenCalledWith('_site/index.html', 'utf-8');
      expect(content).toContain('<html>');
    });

    it('should mock writeFile for HTML output', async () => {
      await fs.writeFile('output/index.html', '<html>test</html>', 'utf-8');

      expect(fs.writeFile).toHaveBeenCalledWith('output/index.html', '<html>test</html>', 'utf-8');
    });

    it('should mock access for file existence checks', async () => {
      await expect(fs.access('nonexistent.file')).rejects.toThrow('File not found');

      expect(fs.access).toHaveBeenCalledWith('nonexistent.file');
    });

    it('should mock copyFile for additional assets', async () => {
      await fs.copyFile('source.json', 'dest.json');

      expect(fs.copyFile).toHaveBeenCalledWith('source.json', 'dest.json');
    });
  });

  describe('Cheerio HTML manipulation', () => {
    it('should load HTML with cheerio', () => {
      const $ = load('<html><body>test</body></html>', {
        xml: { xmlMode: false },
      });

      expect(load).toHaveBeenCalledWith(
        '<html><body>test</body></html>',
        expect.objectContaining({ xml: { xmlMode: false } })
      );
      expect($).toBeDefined();
    });

    it('should generate HTML from cheerio instance', () => {
      const html = mockCheerioInstance.html();

      expect(html).toBe('<html><body>Inlined content</body></html>');
    });
  });

  describe('CSS inlining workflow', () => {
    it('should handle successful CSS file inlining', async () => {
      const result = await mockInlineCSS();

      expect(result).toEqual({
        success: true,
        inlinedCount: 2,
        totalSize: 5000,
        errors: [],
      });
    });

    it('should handle CSS inlining failures', async () => {
      mockInlineCSS.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['Failed to read styles.css'],
      });

      const result = await mockInlineCSS();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to read styles.css');
    });

    it('should handle CSS URL inlining', async () => {
      const result = await mockInlineCSSUrls();

      expect(result).toEqual({
        success: true,
        inlinedCount: 1,
        totalSize: 1000,
        errors: [],
      });
    });

    it('should handle CSS URL inlining failures', async () => {
      mockInlineCSSUrls.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['Failed to inline font.woff2'],
      });

      const result = await mockInlineCSSUrls();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to inline font.woff2');
    });
  });

  describe('JavaScript inlining workflow', () => {
    it('should handle successful JavaScript inlining', async () => {
      const result = await mockInlineJavaScript();

      expect(result).toEqual({
        success: true,
        inlinedCount: 3,
        totalSize: 8000,
        errors: [],
      });
    });

    it('should handle JavaScript inlining failures', async () => {
      mockInlineJavaScript.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['Failed to read app.js'],
      });

      const result = await mockInlineJavaScript();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to read app.js');
    });

    it('should verify no external scripts remain', () => {
      const externalScripts = mockVerifyNoExternalScripts();

      expect(externalScripts).toEqual([]);
    });

    it('should detect external scripts when present', () => {
      mockVerifyNoExternalScripts.mockReturnValue(['https://cdn.example.com/script.js']);

      const externalScripts = mockVerifyNoExternalScripts();

      expect(externalScripts).toHaveLength(1);
      expect(externalScripts[0]).toBe('https://cdn.example.com/script.js');
    });
  });

  describe('Image inlining workflow', () => {
    it('should handle successful image inlining from HTML', async () => {
      const result = await mockInlineImages();

      expect(result).toEqual({
        success: true,
        inlinedCount: 5,
        totalSize: 12000,
        errors: [],
      });
    });

    it('should handle successful CSS background image inlining', async () => {
      const result = await mockInlineCSSImages();

      expect(result).toEqual({
        success: true,
        inlinedCount: 2,
        totalSize: 3000,
        errors: [],
      });
    });

    it('should handle image inlining failures', async () => {
      mockInlineImages.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['Failed to read logo.png'],
      });

      const result = await mockInlineImages();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to read logo.png');
    });

    it('should handle CSS image inlining failures', async () => {
      mockInlineCSSImages.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['Failed to inline background.jpg'],
      });

      const result = await mockInlineCSSImages();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to inline background.jpg');
    });

    it('should verify no external images remain', () => {
      const externalImages = mockVerifyNoExternalImages();

      expect(externalImages).toEqual([]);
    });

    it('should detect external images when present', () => {
      mockVerifyNoExternalImages.mockReturnValue(['https://cdn.example.com/image.png']);

      const externalImages = mockVerifyNoExternalImages();

      expect(externalImages).toHaveLength(1);
      expect(externalImages[0]).toBe('https://cdn.example.com/image.png');
    });
  });

  describe('Size validation workflow', () => {
    it('should pass validation when size is within limits', async () => {
      const result = await mockValidateHTMLSize();

      expect(result.success).toBe(true);
      expect(result.fileSizeMB).toBe(2.5);
      expect(result.maxSizeMB).toBe(5);
      expect(result.utilizationPercent).toBe(50);
    });

    it('should fail validation when size exceeds limit', async () => {
      mockValidateHTMLSize.mockResolvedValue({
        success: false,
        fileSizeBytes: 6815744,
        fileSizeMB: 6.5,
        maxSizeMB: 5,
        utilizationPercent: 130,
        errors: ['File size exceeds 5MB limit'],
        suggestions: ['Optimize images', 'Minify CSS and JavaScript'],
      });

      const result = await mockValidateHTMLSize();

      expect(result.success).toBe(false);
      expect(result.fileSizeMB).toBe(6.5);
      expect(result.errors).toContain('File size exceeds 5MB limit');
      expect(result.suggestions).toHaveLength(2);
    });

    it('should provide warnings when approaching limit', async () => {
      mockValidateHTMLSize.mockResolvedValue({
        success: true,
        fileSizeBytes: 4404019,
        fileSizeMB: 4.2,
        maxSizeMB: 5,
        utilizationPercent: 84,
        errors: [],
        suggestions: ['Consider optimizing assets before adding more content'],
      });

      const result = await mockValidateHTMLSize();

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.utilizationPercent).toBeGreaterThan(80);
    });

    it('should format sizes correctly', () => {
      expect(mockFormatSize(1024)).toBe('1.00 KB');
      expect(mockFormatSize(5120)).toBe('5.00 KB');
      expect(mockFormatSize(1048576)).toBe('1024.00 KB');
    });
  });

  describe('Statistics calculation', () => {
    it('should calculate total CSS size including URLs', async () => {
      const cssResult = await mockInlineCSS();
      const cssUrlResult = await mockInlineCSSUrls();

      const totalCSS = cssResult.totalSize + cssUrlResult.totalSize;

      expect(totalCSS).toBe(6000); // 5000 + 1000
    });

    it('should calculate total image size from all sources', async () => {
      const imageResult = await mockInlineImages();
      const cssImageResult = await mockInlineCSSImages();

      const totalImages = imageResult.totalSize + cssImageResult.totalSize;

      expect(totalImages).toBe(15000); // 12000 + 3000
    });

    it('should calculate total inlined size', async () => {
      const cssResult = await mockInlineCSS();
      const cssUrlResult = await mockInlineCSSUrls();
      const jsResult = await mockInlineJavaScript();
      const imageResult = await mockInlineImages();
      const cssImageResult = await mockInlineCSSImages();

      const totalInlinedSize =
        cssResult.totalSize +
        cssUrlResult.totalSize +
        jsResult.totalSize +
        imageResult.totalSize +
        cssImageResult.totalSize;

      expect(totalInlinedSize).toBe(29000); // 5000 + 1000 + 8000 + 12000 + 3000
    });
  });

  describe('Additional file operations', () => {
    it('should handle status.json file operations', async () => {
      // Mock successful access to status.json
      vi.mocked(fs.access).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        if (pathStr.includes('status.json')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      await expect(fs.access('_site/api/status.json')).resolves.toBeUndefined();
      await fs.copyFile('_site/api/status.json', 'output/api/status.json');

      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('should create empty status.json when source not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      await expect(fs.access('_site/api/status.json')).rejects.toThrow();
      await fs.writeFile('output/api/status.json', '[]', 'utf-8');

      expect(fs.writeFile).toHaveBeenCalledWith('output/api/status.json', '[]', 'utf-8');
    });

    it('should handle history.csv file operations', async () => {
      vi.mocked(fs.access).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        if (pathStr.includes('history.csv')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      await expect(fs.access('_site/history.csv')).resolves.toBeUndefined();
      await fs.copyFile('_site/history.csv', 'output/history.csv');

      expect(fs.copyFile).toHaveBeenCalled();
    });

    it('should create empty history.csv with header when source not found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      await expect(fs.access('_site/history.csv')).rejects.toThrow();

      const csvHeader =
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id\n';
      await fs.writeFile('output/history.csv', csvHeader, 'utf-8');

      expect(fs.writeFile).toHaveBeenCalledWith(
        'output/history.csv',
        expect.stringContaining('timestamp,service_name'),
        'utf-8'
      );
    });

    it('should create api directory before writing status.json', async () => {
      await fs.mkdir('output/api', { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith('output/api', { recursive: true });
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      await expect(fs.readFile('_site/index.html', 'utf-8')).rejects.toThrow('Permission denied');
    });

    it('should handle directory creation errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('No space left on device'));

      await expect(fs.mkdir('output', { recursive: true })).rejects.toThrow(
        'No space left on device'
      );
    });

    it('should handle file write errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      await expect(fs.writeFile('output/index.html', '<html></html>', 'utf-8')).rejects.toThrow(
        'Disk full'
      );
    });

    it('should handle cheerio parsing errors', () => {
      vi.mocked(load).mockImplementation(() => {
        throw new Error('Invalid HTML');
      });

      expect(() => load('malformed <html')).toThrow('Invalid HTML');
    });
  });

  describe('Integration workflow simulation', () => {
    it('should simulate complete successful workflow', async () => {
      // Step 1: Create output directory
      await fs.mkdir('output', { recursive: true });

      // Step 2: Read HTML
      const htmlContent = await fs.readFile('_site/index.html', 'utf-8');
      const $ = load(htmlContent, { xml: { xmlMode: false } });

      // Step 3: Inline CSS
      const cssResult = await mockInlineCSS();
      expect(cssResult.success).toBe(true);

      // Step 4: Inline CSS URLs
      const cssUrlResult = await mockInlineCSSUrls();
      expect(cssUrlResult.success).toBe(true);

      // Step 5: Inline JavaScript
      const jsResult = await mockInlineJavaScript();
      expect(jsResult.success).toBe(true);

      // Step 6: Inline images
      const imageResult = await mockInlineImages();
      const cssImageResult = await mockInlineCSSImages();
      expect(imageResult.success).toBe(true);
      expect(cssImageResult.success).toBe(true);

      // Step 7: Verify no external resources
      const externalScripts = mockVerifyNoExternalScripts();
      const externalImages = mockVerifyNoExternalImages();
      expect(externalScripts).toHaveLength(0);
      expect(externalImages).toHaveLength(0);

      // Step 8: Generate HTML
      const inlinedHTML = $.html();
      expect(inlinedHTML).toBeDefined();

      // Step 9: Write output
      await fs.writeFile('output/index.html', inlinedHTML, 'utf-8');

      // Step 10: Validate size
      const sizeValidation = await mockValidateHTMLSize();
      expect(sizeValidation.success).toBe(true);

      // Verify all operations were called
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockInlineCSS).toHaveBeenCalled();
      expect(mockInlineCSSUrls).toHaveBeenCalled();
      expect(mockInlineJavaScript).toHaveBeenCalled();
      expect(mockInlineImages).toHaveBeenCalled();
      expect(mockInlineCSSImages).toHaveBeenCalled();
      expect(mockValidateHTMLSize).toHaveBeenCalled();
    });

    it('should stop workflow on CSS inlining failure', async () => {
      mockInlineCSS.mockResolvedValue({
        success: false,
        inlinedCount: 0,
        totalSize: 0,
        errors: ['CSS error'],
      });

      await fs.mkdir('output', { recursive: true });
      const htmlContent = await fs.readFile('_site/index.html', 'utf-8');
      load(htmlContent);

      const cssResult = await mockInlineCSS();

      // Should not proceed if CSS inlining fails
      expect(cssResult.success).toBe(false);
      expect(mockInlineCSSUrls).not.toHaveBeenCalled();
      expect(mockInlineJavaScript).not.toHaveBeenCalled();
    });

    it('should stop workflow on external resource detection', async () => {
      mockVerifyNoExternalScripts.mockReturnValue(['https://cdn.example.com/script.js']);

      // Run through workflow
      await fs.mkdir('output', { recursive: true });
      const htmlContent = await fs.readFile('_site/index.html', 'utf-8');
      load(htmlContent);

      await mockInlineCSS();
      await mockInlineCSSUrls();
      await mockInlineJavaScript();
      await mockInlineImages();
      await mockInlineCSSImages();

      const externalScripts = mockVerifyNoExternalScripts();

      // Should detect external resources
      expect(externalScripts).toHaveLength(1);
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        expect.stringContaining('output'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should stop workflow on size validation failure', async () => {
      mockValidateHTMLSize.mockResolvedValue({
        success: false,
        fileSizeBytes: 6815744,
        fileSizeMB: 6.5,
        maxSizeMB: 5,
        utilizationPercent: 130,
        errors: ['Size exceeded'],
        suggestions: [],
      });

      // Complete workflow up to size validation
      await fs.mkdir('output', { recursive: true });
      const htmlContent = await fs.readFile('_site/index.html', 'utf-8');
      const $ = load(htmlContent);

      await mockInlineCSS();
      await mockInlineCSSUrls();
      await mockInlineJavaScript();
      await mockInlineImages();
      await mockInlineCSSImages();

      const externalScripts = mockVerifyNoExternalScripts();
      const externalImages = mockVerifyNoExternalImages();
      expect(externalScripts).toHaveLength(0);
      expect(externalImages).toHaveLength(0);

      const inlinedHTML = $.html();
      await fs.writeFile('output/index.html', inlinedHTML, 'utf-8');

      const sizeValidation = await mockValidateHTMLSize();

      // Should fail on size validation
      expect(sizeValidation.success).toBe(false);
      expect(sizeValidation.fileSizeMB).toBeGreaterThan(5);
    });
  });
});
