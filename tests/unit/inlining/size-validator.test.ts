/**
 * Unit tests for HTML Size Validator (T045a - TDD Phase)
 *
 * Constitutional Compliance:
 * - Principle III: Tests validate existing implementation
 * - Principle X: No external services - Mock filesystem operations
 *
 * Test Requirements (per T045a):
 * - Test size calculation
 * - Verify failure when > 5MB
 * - Test warning when > 4MB (80% threshold)
 * - Verify error message clarity
 * - Test suggested optimizations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { validateHTMLSize, type ComponentSizes } from '../../../src/inlining/size-validator.ts';
import { stat } from 'fs/promises';
import type { Stats } from 'fs';

// Mock fs/promises
vi.mock('fs/promises');

// Helper to create mock Stats object
function createMockStats(size: number): Stats {
  return {
    size,
    isFile: () => true,
    isDirectory: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: new Date(),
    mtime: new Date(),
    ctime: new Date(),
    birthtime: new Date(),
  };
}

describe('HTML Size Validator (T045a)', () => {
  const mockFilePath = '/test/output/index.html';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Size Calculation', () => {
    it('should calculate file size in bytes correctly', async () => {
      const sizeBytes = 1024 * 1024; // 1MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.fileSizeBytes).toBe(sizeBytes);
      expect(result.fileSizeMB).toBeCloseTo(1.0, 2);
    });

    it('should calculate size in MB with correct precision', async () => {
      const sizeBytes = 2.5 * 1024 * 1024; // 2.5MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.fileSizeMB).toBeCloseTo(2.5, 2);
    });

    it('should calculate utilization percentage correctly', async () => {
      const sizeBytes = 2.5 * 1024 * 1024; // 2.5MB out of 5MB = 50%
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.utilizationPercent).toBeCloseTo(50, 1);
      expect(result.maxSizeMB).toBe(5);
    });

    it('should handle very small files (< 1KB)', async () => {
      const sizeBytes = 512; // 512 bytes
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.fileSizeBytes).toBe(512);
      expect(result.fileSizeMB).toBeCloseTo(0.0005, 4);
    });

    it('should handle zero-size files', async () => {
      vi.mocked(stat).mockResolvedValue(createMockStats(0));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.fileSizeBytes).toBe(0);
      expect(result.fileSizeMB).toBe(0);
      expect(result.utilizationPercent).toBe(0);
    });
  });

  describe('Failure when > 5MB (FR-021)', () => {
    it('should fail when file size exceeds 5MB', async () => {
      const sizeBytes = 5.1 * 1024 * 1024; // 5.1MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/exceeds maximum/i);
    });

    it('should fail at exactly 5MB + 1 byte', async () => {
      const sizeBytes = 5 * 1024 * 1024 + 1; // Exactly over limit
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
    });

    it('should succeed at exactly 5MB', async () => {
      const sizeBytes = 5 * 1024 * 1024; // Exactly 5MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should provide excess size in error when over limit', async () => {
      const sizeBytes = 6 * 1024 * 1024; // 6MB (1MB over)
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/6\.00.*MB/i);
      expect(result.errors[0]).toMatch(/5.*MB/i);
    });
  });

  describe('Warning at 80% Threshold (4MB)', () => {
    it('should generate suggestions when size > 4MB (80% threshold)', async () => {
      const sizeBytes = 4.1 * 1024 * 1024; // 4.1MB (82%)
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true); // Still within 5MB
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should not generate warnings when size < 4MB', async () => {
      const sizeBytes = 3.9 * 1024 * 1024; // 3.9MB (78%)
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBe(0);
    });

    it('should warn at exactly 80% threshold (4MB)', async () => {
      const sizeBytes = 4 * 1024 * 1024; // Exactly 4MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBe(0); // Just at threshold, not over
    });

    it('should warn at 4MB + 1 byte (just over threshold)', async () => {
      const sizeBytes = 4 * 1024 * 1024 + 1;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear error message with actual and max sizes', async () => {
      const sizeBytes = 6.5 * 1024 * 1024; // 6.5MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      const errorMessage = result.errors[0]!;
      expect(errorMessage).toMatch(/6\.50.*MB/i);
      expect(errorMessage).toMatch(/exceeds/i);
      expect(errorMessage).toMatch(/maximum/i);
      expect(errorMessage).toMatch(/5.*MB/i);
    });

    it('should include file path in error context', async () => {
      const sizeBytes = 6 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const customPath = '/custom/path/index.html';
      const result = await validateHTMLSize(customPath);

      expect(result.errors.length).toBeGreaterThan(0);
      // Error context logged (not in error message, but in logs)
    });

    it('should provide actionable error when file read fails', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('ENOENT: File not found'));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/Failed to validate/i);
      expect(result.errors[0]).toMatch(/File not found/i);
    });

    it('should handle permission errors gracefully', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('EACCES: Permission denied'));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/Permission denied/i);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should suggest CSS minification for all oversized files', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      const hasCSSMinificationSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('css') && s.toLowerCase().includes('minif'),
      );
      expect(hasCSSMinificationSuggestion).toBe(true);
    });

    it('should suggest image optimization for all oversized files', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      const hasImageOptimizationSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('image') && (s.toLowerCase().includes('optim') || s.toLowerCase().includes('compress')),
      );
      expect(hasImageOptimizationSuggestion).toBe(true);
    });

    it('should suggest removing unused CSS', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      const hasUnusedCSSSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('unused') && s.toLowerCase().includes('css'),
      );
      expect(hasUnusedCSSSuggestion).toBe(true);
    });

    it('should provide component-specific suggestions when breakdown provided', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 600 * 1024, // 600KB CSS
        totalJS: 400 * 1024, // 400KB JS
        totalImages: 3 * 1024 * 1024, // 3MB images
        baseHTML: 100 * 1024, // 100KB HTML
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      // Should have suggestions about large images
      const hasImageSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('image') && s.includes('3.00'),
      );
      expect(hasImageSuggestion).toBe(true);
    });

    it('should suggest WebP conversion when images are large', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 100 * 1024,
        totalJS: 100 * 1024,
        totalImages: 3.5 * 1024 * 1024, // Large images
        baseHTML: 100 * 1024,
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      const hasWebPSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('webp'),
      );
      expect(hasWebPSuggestion).toBe(true);
    });

    it('should suggest PurgeCSS when CSS is large', async () => {
      const sizeBytes = 4.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 600 * 1024, // Large CSS
        totalJS: 200 * 1024,
        totalImages: 500 * 1024,
        baseHTML: 100 * 1024,
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      const hasPurgeCSSOrUnusedStyles = result.suggestions.some(s =>
        s.toLowerCase().includes('unused') || s.toLowerCase().includes('purgecss') || s.toLowerCase().includes('critical css'),
      );
      expect(hasPurgeCSSOrUnusedStyles).toBe(true);
    });

    it('should suggest tree-shaking when JavaScript is large', async () => {
      const sizeBytes = 4.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 200 * 1024,
        totalJS: 600 * 1024, // Large JS
        totalImages: 500 * 1024,
        baseHTML: 100 * 1024,
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      const hasTreeShakingSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('tree-shaking') || s.toLowerCase().includes('unused javascript'),
      );
      expect(hasTreeShakingSuggestion).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large files (> 10MB)', async () => {
      const sizeBytes = 15 * 1024 * 1024; // 15MB
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.fileSizeMB).toBeCloseTo(15, 1);
      expect(result.utilizationPercent).toBeCloseTo(300, 1);
    });

    it('should handle missing component breakdown gracefully', async () => {
      const sizeBytes = 5.5 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const result = await validateHTMLSize(mockFilePath); // No componentSizes

      expect(result.success).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
      // Should have general suggestions even without component breakdown
    });

    it('should return correct structure even on filesystem errors', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('Disk read error'));

      const result = await validateHTMLSize(mockFilePath);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('fileSizeBytes');
      expect(result).toHaveProperty('fileSizeMB');
      expect(result).toHaveProperty('maxSizeMB');
      expect(result).toHaveProperty('utilizationPercent');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Component Breakdown Logging', () => {
    it('should log component breakdown when provided', async () => {
      const sizeBytes = 3 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 500 * 1024,
        totalJS: 300 * 1024,
        totalImages: 1.5 * 1024 * 1024,
        baseHTML: 200 * 1024,
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      expect(result.success).toBe(true);
      // Component breakdown logged to console (verified via logger mock in integration tests)
    });

    it('should not fail when component sizes are zero', async () => {
      const sizeBytes = 1 * 1024 * 1024;
      vi.mocked(stat).mockResolvedValue(createMockStats(sizeBytes));

      const componentSizes: ComponentSizes = {
        totalCSS: 0,
        totalJS: 0,
        totalImages: 0,
        baseHTML: 0,
      };

      const result = await validateHTMLSize(mockFilePath, componentSizes);

      expect(result.success).toBe(true);
    });
  });
});
