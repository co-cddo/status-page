/**
 * HTML Size Validator
 *
 * Checks final HTML file size after inlining and fails with clear error if > 5MB.
 * Logs actual size and components contributing to size.
 * Suggests optimization strategies (unused CSS removal, image compression).
 *
 * Task: T045 - HTML size validation
 * Requirements: FR-021 (< 5MB constraint)
 */

import { stat } from 'fs/promises';
import { createLogger } from '../logging/logger.ts';

const logger = createLogger({ serviceName: 'size-validator' });

export interface SizeValidationResult {
  success: boolean;
  fileSizeBytes: number;
  fileSizeMB: number;
  maxSizeMB: number;
  utilizationPercent: number;
  suggestions: string[];
  errors: string[];
}

export interface ComponentSizes {
  totalCSS: number;
  totalJS: number;
  totalImages: number;
  baseHTML: number;
}

// Maximum file size constraint: 5MB
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Warning threshold: 80% of max size (4MB)
const WARNING_THRESHOLD_MB = MAX_SIZE_MB * 0.8;
const WARNING_THRESHOLD_BYTES = WARNING_THRESHOLD_MB * 1024 * 1024;

/**
 * Validate HTML file size against the 5MB constraint
 *
 * @param filePath - Path to the HTML file
 * @param componentSizes - Optional breakdown of component sizes
 * @returns Validation result with success status and suggestions
 */
export async function validateHTMLSize(
  filePath: string,
  componentSizes?: ComponentSizes
): Promise<SizeValidationResult> {
  const result: SizeValidationResult = {
    success: true,
    fileSizeBytes: 0,
    fileSizeMB: 0,
    maxSizeMB: MAX_SIZE_MB,
    utilizationPercent: 0,
    suggestions: [],
    errors: [],
  };

  try {
    // Get file size
    const stats = await stat(filePath);
    result.fileSizeBytes = stats.size;
    result.fileSizeMB = stats.size / (1024 * 1024);
    result.utilizationPercent = (stats.size / MAX_SIZE_BYTES) * 100;

    logger.info(
      {
        filePath,
        sizeBytes: result.fileSizeBytes,
        sizeMB: result.fileSizeMB.toFixed(2),
        maxMB: MAX_SIZE_MB,
        utilization: result.utilizationPercent.toFixed(1) + '%',
      },
      'HTML file size validation'
    );

    // Check if size exceeds maximum
    if (stats.size > MAX_SIZE_BYTES) {
      result.success = false;
      const errorMessage = `HTML file size (${result.fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size of ${MAX_SIZE_MB}MB`;
      result.errors.push(errorMessage);
      logger.error(
        {
          sizeBytes: result.fileSizeBytes,
          sizeMB: result.fileSizeMB.toFixed(2),
          maxMB: MAX_SIZE_MB,
          excessMB: (result.fileSizeMB - MAX_SIZE_MB).toFixed(2),
        },
        errorMessage
      );

      // Generate optimization suggestions
      result.suggestions = generateOptimizationSuggestions(stats.size, componentSizes);

      // Log suggestions
      logger.info({ suggestions: result.suggestions }, 'Size reduction suggestions');

      return result;
    }

    // Check if size exceeds warning threshold
    if (stats.size > WARNING_THRESHOLD_BYTES) {
      const warningMessage = `HTML file size (${result.fileSizeMB.toFixed(2)}MB) exceeds 80% of maximum (${WARNING_THRESHOLD_MB}MB)`;
      logger.warn(
        {
          sizeBytes: result.fileSizeBytes,
          sizeMB: result.fileSizeMB.toFixed(2),
          warningThresholdMB: WARNING_THRESHOLD_MB,
          remainingMB: (MAX_SIZE_MB - result.fileSizeMB).toFixed(2),
        },
        warningMessage
      );

      // Generate suggestions even at warning level
      result.suggestions = generateOptimizationSuggestions(stats.size, componentSizes);
    } else {
      logger.info(
        {
          sizeMB: result.fileSizeMB.toFixed(2),
          remainingMB: (MAX_SIZE_MB - result.fileSizeMB).toFixed(2),
        },
        'HTML file size is within acceptable limits'
      );
    }

    // Log component breakdown if available
    if (componentSizes) {
      logComponentBreakdown(componentSizes, stats.size);
    }
  } catch (error) {
    result.success = false;
    const errorMessage = `Failed to validate HTML size: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMessage);
    logger.error({ filePath, error }, errorMessage);
  }

  return result;
}

/**
 * Generate optimization suggestions based on file size and component breakdown
 */
function generateOptimizationSuggestions(
  totalSize: number,
  componentSizes?: ComponentSizes
): string[] {
  const suggestions: string[] = [];

  // General suggestions
  suggestions.push('Consider minifying CSS and JavaScript files before inlining');
  suggestions.push('Optimize images using compression tools (e.g., ImageOptim, TinyPNG)');
  suggestions.push('Remove unused CSS rules using PurgeCSS or similar tools');

  // Component-specific suggestions if breakdown available
  if (componentSizes) {
    const { totalCSS, totalJS, totalImages, baseHTML } = componentSizes;

    if (totalImages > 2 * 1024 * 1024) {
      // Images > 2MB
      suggestions.push(
        `Images account for ${(totalImages / (1024 * 1024)).toFixed(2)}MB - consider reducing image dimensions or using more aggressive compression`
      );
      suggestions.push('Convert PNG images to WebP format for better compression');
      suggestions.push('Use SVG for icons and simple graphics instead of raster images');
    }

    if (totalCSS > 500 * 1024) {
      // CSS > 500KB
      suggestions.push(
        `CSS accounts for ${(totalCSS / 1024).toFixed(2)}KB - remove unused GOV.UK Design System styles`
      );
      suggestions.push(
        'Consider using critical CSS extraction to inline only above-the-fold styles'
      );
    }

    if (totalJS > 500 * 1024) {
      // JS > 500KB
      suggestions.push(
        `JavaScript accounts for ${(totalJS / 1024).toFixed(2)}KB - ensure only necessary GOV.UK components are included`
      );
      suggestions.push('Consider tree-shaking to remove unused JavaScript code');
    }

    if (baseHTML > 200 * 1024) {
      // HTML > 200KB
      suggestions.push(
        `Base HTML accounts for ${(baseHTML / 1024).toFixed(2)}KB - review for unnecessarily verbose markup`
      );
    }
  }

  // Extreme case suggestions
  if (totalSize > MAX_SIZE_BYTES * 1.5) {
    // More than 50% over limit
    suggestions.push(
      'CRITICAL: File size significantly exceeds limit - consider fundamental architecture changes'
    );
    suggestions.push(
      'Evaluate whether all inlined assets are truly necessary for self-contained HTML'
    );
    suggestions.push('Consider lazy-loading non-critical images or splitting into multiple pages');
  }

  return suggestions;
}

/**
 * Log component size breakdown
 */
function logComponentBreakdown(componentSizes: ComponentSizes, totalSize: number): void {
  const { totalCSS, totalJS, totalImages, baseHTML } = componentSizes;

  logger.info(
    {
      breakdown: {
        css: {
          bytes: totalCSS,
          kb: (totalCSS / 1024).toFixed(2),
          percent: ((totalCSS / totalSize) * 100).toFixed(1) + '%',
        },
        javascript: {
          bytes: totalJS,
          kb: (totalJS / 1024).toFixed(2),
          percent: ((totalJS / totalSize) * 100).toFixed(1) + '%',
        },
        images: {
          bytes: totalImages,
          kb: (totalImages / 1024).toFixed(2),
          percent: ((totalImages / totalSize) * 100).toFixed(1) + '%',
        },
        baseHTML: {
          bytes: baseHTML,
          kb: (baseHTML / 1024).toFixed(2),
          percent: ((baseHTML / totalSize) * 100).toFixed(1) + '%',
        },
        total: {
          bytes: totalSize,
          mb: (totalSize / (1024 * 1024)).toFixed(2),
        },
      },
    },
    'Component size breakdown'
  );
}

/**
 * Format size in human-readable format (bytes, KB, or MB)
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
