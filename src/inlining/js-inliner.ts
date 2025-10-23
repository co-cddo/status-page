/**
 * JavaScript Inliner
 *
 * Reads JavaScript files referenced in HTML and inlines them into <script> tags before closing </body>.
 * Handles GOV.UK Design System JS from @x-govuk/govuk-eleventy-plugin.
 *
 * Task: T043 - JavaScript inliner
 * Requirements: FR-021 (self-contained HTML)
 */

import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { CheerioAPI } from 'cheerio';
import { createLogger } from '../logging/logger.ts';

const logger = createLogger({ serviceName: 'js-inliner' });

export interface JSInlineResult {
  success: boolean;
  inlinedCount: number;
  totalSize: number;
  errors: string[];
}

/**
 * Inline all JavaScript files referenced in HTML into <script> tags
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param htmlPath - Path to the HTML file (for resolving relative JS paths)
 * @returns Result object with success status and statistics
 */
export async function inlineJavaScript($: CheerioAPI, htmlPath: string): Promise<JSInlineResult> {
  const result: JSInlineResult = {
    success: true,
    inlinedCount: 0,
    totalSize: 0,
    errors: [],
  };

  const htmlDir = dirname(htmlPath);

  // Find all <script> tags with src attribute
  const scriptTags = $('script[src]');

  if (scriptTags.length === 0) {
    logger.info('No JavaScript files found to inline');
    return result;
  }

  logger.info({ count: scriptTags.length }, 'Found JavaScript files to inline');

  // Process each script sequentially to maintain order
  for (let i = 0; i < scriptTags.length; i++) {
    const script = scriptTags.eq(i);
    const src = script.attr('src');

    if (!src) {
      logger.warn({ index: i }, 'Script tag missing src attribute');
      continue;
    }

    // Skip external scripts (http/https URLs)
    if (src.startsWith('http://') || src.startsWith('https://')) {
      logger.warn({ src }, 'Skipping external script - cannot inline remote JavaScript');
      result.errors.push(
        `Cannot inline external script: "${src}". Self-contained HTML requires all scripts to be local.`
      );
      result.success = false;
      continue;
    }

    try {
      // Resolve JavaScript file path (handle both relative and absolute paths)
      const jsPath = src.startsWith('/') ? join(htmlDir, src) : resolve(htmlDir, src);

      logger.debug({ src, jsPath }, 'Reading JavaScript file');

      // Read JavaScript file
      const jsContent = await readFile(jsPath, 'utf-8');
      const jsSize = Buffer.byteLength(jsContent, 'utf-8');

      // Preserve script attributes (type, defer, async, etc.) except src
      const attributes: Record<string, string> = {};
      const scriptAttrs = script.attr();

      if (scriptAttrs) {
        for (const [key, value] of Object.entries(scriptAttrs)) {
          if (key !== 'src') {
            attributes[key] = value;
          }
        }
      }

      // Create new <script> tag with inlined JavaScript
      const inlineScript = $('<script>')
        .attr(attributes)
        .attr('data-inlined-from', src)
        .text(jsContent);

      // Replace <script src="..."> with <script>...</script>
      script.replaceWith(inlineScript);

      result.inlinedCount++;
      result.totalSize += jsSize;

      logger.info(
        { src, size: jsSize, index: i + 1, total: scriptTags.length },
        'Inlined JavaScript file'
      );
    } catch (error) {
      const errorMessage = `Failed to inline JavaScript file "${src}": ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ src, error }, errorMessage);
      result.errors.push(errorMessage);
      result.success = false;
    }
  }

  logger.info(
    {
      inlinedCount: result.inlinedCount,
      totalSize: result.totalSize,
      totalSizeKB: (result.totalSize / 1024).toFixed(2),
    },
    'JavaScript inlining complete'
  );

  return result;
}

/**
 * Verify no external script references remain
 * This is a safety check to ensure self-contained HTML compliance
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns Array of external script URLs found
 */
export function verifyNoExternalScripts($: CheerioAPI): string[] {
  const externalScripts: string[] = [];

  $('script[src]').each((_, elem) => {
    const src = $(elem).attr('src');
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      externalScripts.push(src);
    }
  });

  if (externalScripts.length > 0) {
    logger.error(
      { count: externalScripts.length, scripts: externalScripts },
      'External scripts detected - violates self-contained HTML requirement'
    );
  }

  return externalScripts;
}
