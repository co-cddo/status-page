/**
 * CSS Inliner
 *
 * Reads CSS files referenced in HTML and inlines them into <style> tags in HTML head.
 * Handles GOV.UK Design System CSS from @x-govuk/govuk-eleventy-plugin.
 *
 * Task: T042 - CSS inliner
 * Requirements: FR-021 (self-contained HTML)
 */

import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { CheerioAPI } from 'cheerio';
import { createLogger } from '../logging/logger.js';

const logger = createLogger({ serviceName: 'css-inliner' });

export interface CSSInlineResult {
  success: boolean;
  inlinedCount: number;
  totalSize: number;
  errors: string[];
}

/**
 * Inline all CSS files referenced in HTML into <style> tags
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param htmlPath - Path to the HTML file (for resolving relative CSS paths)
 * @returns Result object with success status and statistics
 */
export async function inlineCSS(
  $: CheerioAPI,
  htmlPath: string,
): Promise<CSSInlineResult> {
  const result: CSSInlineResult = {
    success: true,
    inlinedCount: 0,
    totalSize: 0,
    errors: [],
  };

  const htmlDir = dirname(htmlPath);

  // Find all <link> tags with rel="stylesheet"
  const stylesheetLinks = $('link[rel="stylesheet"]');

  if (stylesheetLinks.length === 0) {
    logger.info('No CSS files found to inline');
    return result;
  }

  logger.info(
    { count: stylesheetLinks.length },
    'Found CSS files to inline',
  );

  // Process each stylesheet sequentially to maintain order
  for (let i = 0; i < stylesheetLinks.length; i++) {
    const link = stylesheetLinks.eq(i);
    const href = link.attr('href');

    if (!href) {
      logger.warn({ index: i }, 'Stylesheet link missing href attribute');
      continue;
    }

    try {
      // Resolve CSS file path (handle both relative and absolute paths)
      const cssPath = href.startsWith('/')
        ? join(htmlDir, href)
        : resolve(htmlDir, href);

      logger.debug({ href, cssPath }, 'Reading CSS file');

      // Read CSS file
      const cssContent = await readFile(cssPath, 'utf-8');
      const cssSize = Buffer.byteLength(cssContent, 'utf-8');

      // Create <style> tag with inlined CSS
      const styleTag = $('<style>')
        .attr('type', 'text/css')
        .attr('data-inlined-from', href)
        .text(cssContent);

      // Replace <link> tag with <style> tag
      link.replaceWith(styleTag);

      result.inlinedCount++;
      result.totalSize += cssSize;

      logger.info(
        { href, size: cssSize, index: i + 1, total: stylesheetLinks.length },
        'Inlined CSS file',
      );
    } catch (error) {
      const errorMessage = `Failed to inline CSS file "${href}": ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ href, error }, errorMessage);
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
    'CSS inlining complete',
  );

  return result;
}

/**
 * Inline CSS from URLs in style attributes and inline <style> blocks
 * This handles any url() references in CSS that need to be converted to data URIs
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param htmlPath - Path to the HTML file (for resolving relative paths)
 * @returns Result object with success status and statistics
 */
export async function inlineCSSUrls(
  $: CheerioAPI,
  htmlPath: string,
): Promise<CSSInlineResult> {
  const result: CSSInlineResult = {
    success: true,
    inlinedCount: 0,
    totalSize: 0,
    errors: [],
  };

  const htmlDir = dirname(htmlPath);

  // Find all <style> tags
  const styleTags = $('style');

  if (styleTags.length === 0) {
    return result;
  }

  logger.info({ count: styleTags.length }, 'Processing CSS url() references');

  for (let i = 0; i < styleTags.length; i++) {
    const styleTag = styleTags.eq(i);
    let cssContent = styleTag.html() || '';

    // Find all url() references in CSS
    const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
    let match;
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = urlPattern.exec(cssContent)) !== null) {
      const url = match[1];

      if (!url) {
        continue;
      }

      // Skip data URIs and absolute URLs
      if (url.startsWith('data:') || url.startsWith('http')) {
        continue;
      }

      try {
        // Resolve file path
        const filePath = url.startsWith('/')
          ? join(htmlDir, url)
          : resolve(htmlDir, url);

        // Read file and convert to data URI
        const fileContent = await readFile(filePath);
        const mimeType = getMimeType(filePath);
        const base64 = fileContent.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        replacements.push({
          original: match[0],
          replacement: `url('${dataUri}')`,
        });

        result.inlinedCount++;
        result.totalSize += fileContent.length;

        logger.debug({ url, filePath, size: fileContent.length }, 'Converted CSS url() to data URI');
      } catch (error) {
        logger.warn({ url, error }, 'Failed to inline CSS url() reference');
        // Don't fail the entire process for CSS url() failures
      }
    }

    // Apply all replacements
    for (const { original, replacement } of replacements) {
      cssContent = cssContent.replace(original, replacement);
    }

    styleTag.html(cssContent);
  }

  if (result.inlinedCount > 0) {
    logger.info(
      { inlinedCount: result.inlinedCount, totalSize: result.totalSize },
      'CSS url() inlining complete',
    );
  }

  return result;
}

/**
 * Get MIME type for a file based on extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
