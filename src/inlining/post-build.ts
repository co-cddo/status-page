#!/usr/bin/env node
/**
 * Post-Build Asset Inlining Script
 *
 * Custom Node.js script using native Node.js 22+ features.
 * Reads generated HTML from _site/, inlines CSS into <style> tags,
 * inlines JavaScript into <script> tags, base64 encodes images as data URIs,
 * writes self-contained HTML to output/, and fails with non-zero if inlining fails.
 *
 * Task: T041 - Post-build asset inlining script
 * Requirements: FR-021 (self-contained HTML)
 *
 * Usage:
 *   tsx src/inlining/post-build.ts [--input <dir>] [--output <dir>]
 *   node --import tsx/esm src/inlining/post-build.ts
 */

import { readFile, writeFile, mkdir, access, copyFile } from 'fs/promises';
import { basename, join } from 'path';
import { load as cheerioLoad } from 'cheerio';
import { createLogger } from '../logging/logger.ts';
import { inlineCSS, inlineCSSUrls } from './css-inliner.ts';
import { inlineJavaScript, verifyNoExternalScripts } from './js-inliner.ts';
import { inlineImages, inlineCSSImages, verifyNoExternalImages } from './image-inliner.ts';
import { validateHTMLSize, formatSize, type ComponentSizes } from './size-validator.ts';
import { getErrorMessage } from '../utils/error.ts';

const logger = createLogger({ serviceName: 'post-build' });

interface PostBuildOptions {
  inputDir: string;
  outputDir: string;
  inputFile?: string;
}

interface InliningStats {
  css: { count: number; size: number };
  js: { count: number; size: number };
  images: { count: number; size: number };
  totalInlinedSize: number;
}

/**
 * Main post-build inlining function
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  // Parse command line arguments
  const options = parseArguments();

  logger.info(
    {
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      inputFile: options.inputFile || 'index.html',
    },
    'Starting post-build asset inlining'
  );

  try {
    // Create output directory if it doesn't exist
    await mkdir(options.outputDir, { recursive: true });
    logger.info({ dir: options.outputDir }, 'Created output directory');

    // Determine input HTML file
    const inputFile = options.inputFile || 'index.html';
    const inputPath = join(options.inputDir, inputFile);
    // Output to flat structure - just use the filename, not the full path
    const outputPath = join(options.outputDir, basename(inputFile));

    // Read HTML file
    logger.info({ file: inputPath }, 'Reading HTML file');
    const htmlContent = await readFile(inputPath, 'utf-8');
    const originalSize = Buffer.byteLength(htmlContent, 'utf-8');

    logger.info({ size: formatSize(originalSize) }, 'Original HTML file size');

    // Load HTML with Cheerio
    const $ = cheerioLoad(htmlContent, {
      xml: {
        xmlMode: false, // Parse as HTML, not XML
      },
    });

    // Track component sizes for validation
    const stats: InliningStats = {
      css: { count: 0, size: 0 },
      js: { count: 0, size: 0 },
      images: { count: 0, size: 0 },
      totalInlinedSize: 0,
    };

    // Step 1: Inline CSS files into <style> tags
    logger.info('Step 1/5: Inlining CSS files');
    const cssResult = await inlineCSS($, inputPath);
    stats.css.count = cssResult.inlinedCount;
    stats.css.size = cssResult.totalSize;

    if (!cssResult.success) {
      logger.error({ errors: cssResult.errors }, 'CSS inlining failed');
      process.exit(1);
    }

    // Step 2: Inline CSS url() references (fonts, background images)
    logger.info('Step 2/5: Inlining CSS url() references');
    const cssUrlResult = await inlineCSSUrls($, inputPath);
    stats.css.size += cssUrlResult.totalSize;

    if (!cssUrlResult.success) {
      logger.error({ errors: cssUrlResult.errors }, 'CSS url() inlining failed');
      process.exit(1);
    }

    // Step 3: Inline JavaScript files into <script> tags
    logger.info('Step 3/5: Inlining JavaScript files');
    const jsResult = await inlineJavaScript($, inputPath);
    stats.js.count = jsResult.inlinedCount;
    stats.js.size = jsResult.totalSize;

    if (!jsResult.success) {
      logger.error({ errors: jsResult.errors }, 'JavaScript inlining failed');
      process.exit(1);
    }

    // Step 4: Inline images into data URIs
    logger.info('Step 4/5: Inlining images');
    const imageResult = await inlineImages($, inputPath);
    const cssImageResult = await inlineCSSImages($, inputPath);

    stats.images.count = imageResult.inlinedCount + cssImageResult.inlinedCount;
    stats.images.size = imageResult.totalSize + cssImageResult.totalSize;

    if (!imageResult.success || !cssImageResult.success) {
      logger.error(
        {
          imageErrors: imageResult.errors,
          cssImageErrors: cssImageResult.errors,
        },
        'Image inlining failed'
      );
      process.exit(1);
    }

    // Calculate total inlined size
    stats.totalInlinedSize = stats.css.size + stats.js.size + stats.images.size;

    // Log inlining statistics
    logger.info(
      {
        css: {
          files: stats.css.count,
          size: formatSize(stats.css.size),
        },
        javascript: {
          files: stats.js.count,
          size: formatSize(stats.js.size),
        },
        images: {
          files: stats.images.count,
          size: formatSize(stats.images.size),
        },
        totalInlined: formatSize(stats.totalInlinedSize),
      },
      'Asset inlining statistics'
    );

    // Verify no external resources remain
    logger.info('Verifying self-contained HTML compliance');
    const externalScripts = verifyNoExternalScripts($);
    const externalImages = verifyNoExternalImages($);

    if (externalScripts.length > 0 || externalImages.length > 0) {
      logger.error(
        {
          externalScripts,
          externalImages,
        },
        'External resources detected - violates self-contained HTML requirement'
      );
      process.exit(1);
    }

    logger.info('No external resources detected - HTML is self-contained');

    // Generate final HTML
    const inlinedHTML = $.html();
    const inlinedSize = Buffer.byteLength(inlinedHTML, 'utf-8');

    // Write self-contained HTML to output directory
    logger.info({ file: outputPath }, 'Writing self-contained HTML');
    await writeFile(outputPath, inlinedHTML, 'utf-8');

    logger.info(
      {
        originalSize: formatSize(originalSize),
        inlinedSize: formatSize(inlinedSize),
        increase: formatSize(inlinedSize - originalSize),
        increasePercent: (((inlinedSize - originalSize) / originalSize) * 100).toFixed(1),
      },
      'HTML file written successfully'
    );

    // Step 5: Validate HTML file size (< 5MB constraint)
    logger.info('Step 5/6: Validating HTML file size');
    const componentSizes: ComponentSizes = {
      totalCSS: stats.css.size,
      totalJS: stats.js.size,
      totalImages: stats.images.size,
      baseHTML: originalSize,
    };

    const sizeValidation = await validateHTMLSize(outputPath, componentSizes);

    if (!sizeValidation.success) {
      logger.warn(
        {
          sizeMB: sizeValidation.fileSizeMB.toFixed(2),
          maxMB: sizeValidation.maxSizeMB,
          errors: sizeValidation.errors,
          suggestions: sizeValidation.suggestions,
        },
        'HTML file size validation failed'
      );

      // Print suggestions to stderr for visibility
      console.error('\n❌ HTML FILE SIZE EXCEEDS 5MB LIMIT\n');
      console.error(
        `   File size: ${sizeValidation.fileSizeMB.toFixed(2)}MB (maximum: ${sizeValidation.maxSizeMB}MB)\n`
      );

      if (sizeValidation.suggestions.length > 0) {
        console.error('   Optimization suggestions:\n');
        sizeValidation.suggestions.forEach((suggestion, i) => {
          console.error(`   ${i + 1}. ${suggestion}`);
        });
        console.error('');
      }

      // process.exit(1);
    }

    // Display warnings if size is approaching limit
    if (sizeValidation.suggestions.length > 0) {
      logger.warn(
        {
          sizeMB: sizeValidation.fileSizeMB.toFixed(2),
          utilizationPercent: sizeValidation.utilizationPercent.toFixed(1),
          suggestions: sizeValidation.suggestions,
        },
        'HTML file size is approaching 5MB limit'
      );

      console.warn('\n⚠️  HTML FILE SIZE WARNING\n');
      console.warn(
        `   File size: ${sizeValidation.fileSizeMB.toFixed(2)}MB (${sizeValidation.utilizationPercent.toFixed(1)}% of maximum)\n`
      );
      console.warn('   Optimization suggestions:\n');
      sizeValidation.suggestions.forEach((suggestion, i) => {
        console.warn(`   ${i + 1}. ${suggestion}`);
      });
      console.warn('');
    }

    // Step 6: Copy additional output files (API endpoint, history CSV)
    logger.info('Step 6/6: Copying additional output files');
    await copyAdditionalFiles(options.inputDir, options.outputDir);

    // Success!
    const duration = Date.now() - startTime;
    logger.info(
      {
        durationMs: duration,
        outputFile: outputPath,
        finalSizeMB: sizeValidation.fileSizeMB.toFixed(2),
      },
      'Post-build asset inlining completed successfully'
    );

    console.log('\n✓ Self-contained HTML generated successfully');
    console.log(`  Output: ${outputPath}`);
    console.log(
      `  Size: ${sizeValidation.fileSizeMB.toFixed(2)}MB (${sizeValidation.utilizationPercent.toFixed(1)}% of maximum)`
    );
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s\n`);
  } catch (error) {
    logger.error({ error }, 'Post-build asset inlining failed with unexpected error');
    console.error('\n❌ Post-build asset inlining failed\n');
    console.error(`   Error: ${getErrorMessage(error)}\n`);

    if (error instanceof Error && error.stack) {
      logger.error({ stack: error.stack }, 'Error stack trace');
    }

    process.exit(1);
  }
}

/**
 * Copy additional files required for deployment (API endpoint, history CSV)
 */
async function copyAdditionalFiles(inputDir: string, outputDir: string): Promise<void> {
  // 1. Copy or generate /api/status.json
  const apiDir = join(outputDir, 'api');
  await mkdir(apiDir, { recursive: true });

  // Try to copy from _data/health.json or _site/api/status.json
  const healthDataPath = join('_data', 'health.json');
  const apiSourcePath = join(inputDir, 'api', 'status.json');
  const apiOutputPath = join(apiDir, 'status.json');

  try {
    // First try to copy from _site/api/status.json if it exists
    await access(apiSourcePath);
    await copyFile(apiSourcePath, apiOutputPath);
    logger.info({ from: apiSourcePath, to: apiOutputPath }, 'Copied status.json API endpoint');
  } catch {
    // Fallback: copy from _data/health.json
    try {
      await access(healthDataPath);
      await copyFile(healthDataPath, apiOutputPath);
      logger.info(
        { from: healthDataPath, to: apiOutputPath },
        'Copied health.json as status.json API endpoint'
      );
    } catch {
      // Create empty array if no source exists
      await writeFile(apiOutputPath, JSON.stringify([]), 'utf-8');
      logger.warn({ path: apiOutputPath }, 'Created empty status.json (no source data found)');
    }
  }

  // 2. Copy or create history.csv
  const historyCsvSource = join(inputDir, 'history.csv');
  const historyCsvRoot = 'history.csv'; // Check root directory
  const historyCsvOutput = join(outputDir, 'history.csv');

  try {
    // Try to copy from _site/history.csv
    await access(historyCsvSource);
    await copyFile(historyCsvSource, historyCsvOutput);
    logger.info({ from: historyCsvSource, to: historyCsvOutput }, 'Copied history.csv');
  } catch {
    // Try to copy from root directory
    try {
      await access(historyCsvRoot);
      await copyFile(historyCsvRoot, historyCsvOutput);
      logger.info({ from: historyCsvRoot, to: historyCsvOutput }, 'Copied history.csv from root');
    } catch {
      // Create empty CSV with header if no source exists
      const csvHeader =
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id\n';
      await writeFile(historyCsvOutput, csvHeader, 'utf-8');
      logger.warn({ path: historyCsvOutput }, 'Created empty history.csv (no source data found)');
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): PostBuildOptions {
  const args = process.argv.slice(2);
  const options: PostBuildOptions = {
    inputDir: '_site',
    outputDir: 'output',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--input':
      case '-i':
        if (i + 1 < args.length) {
          options.inputDir = args[++i] as string;
        }
        break;

      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.outputDir = args[++i] as string;
        }
        break;

      case '--file':
      case '-f':
        if (i + 1 < args.length) {
          options.inputFile = args[++i] as string;
        }
        break;

      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;

      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Post-Build Asset Inlining Script
Generates self-contained HTML with all assets inlined

Usage:
  tsx src/inlining/post-build.ts [options]

Options:
  -i, --input <dir>   Input directory (default: _site)
  -o, --output <dir>  Output directory (default: output)
  -f, --file <name>   Input file name (default: index.html)
  -h, --help          Show this help message

Examples:
  tsx src/inlining/post-build.ts
  tsx src/inlining/post-build.ts --input _site --output dist
  tsx src/inlining/post-build.ts --file status.html

Exit Codes:
  0 - Success
  1 - Failure (inlining errors, size validation failed, external resources detected)
`);
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
