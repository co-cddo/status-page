/**
 * Image Inliner
 *
 * Reads image files (PNG, JPG, SVG, ICO) and base64 encodes them as data URIs.
 * Replaces <img src> and CSS url() references.
 * Handles GOV.UK Design System images from @x-govuk/govuk-eleventy-plugin.
 *
 * Task: T044 - Image inliner
 * Requirements: FR-021 (self-contained HTML)
 */

import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { CheerioAPI } from 'cheerio';
import { createLogger } from '../logging/logger.ts';

const logger = createLogger({ serviceName: 'image-inliner' });

export interface ImageInlineResult {
  success: boolean;
  inlinedCount: number;
  totalSize: number;
  errors: string[];
}

/**
 * Inline all image files referenced in <img> tags as data URIs
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param htmlPath - Path to the HTML file (for resolving relative image paths)
 * @returns Result object with success status and statistics
 */
export async function inlineImages($: CheerioAPI, htmlPath: string): Promise<ImageInlineResult> {
  const result: ImageInlineResult = {
    success: true,
    inlinedCount: 0,
    totalSize: 0,
    errors: [],
  };

  const htmlDir = dirname(htmlPath);

  // Find all <img> tags with src attribute
  const imgTags = $('img[src]');

  if (imgTags.length === 0) {
    logger.info('No images found to inline');
    return result;
  }

  logger.info({ count: imgTags.length }, 'Found images to inline');

  // Process each image
  for (let i = 0; i < imgTags.length; i++) {
    const img = imgTags.eq(i);
    const src = img.attr('src');

    if (!src) {
      logger.warn({ index: i }, 'Image tag missing src attribute');
      continue;
    }

    // Skip data URIs (already inlined)
    if (src.startsWith('data:')) {
      logger.debug({ src: src.substring(0, 50) + '...' }, 'Image already inlined');
      continue;
    }

    // Skip external images (http/https URLs)
    if (src.startsWith('http://') || src.startsWith('https://')) {
      logger.warn({ src }, 'Skipping external image - cannot inline remote images');
      result.errors.push(
        `Cannot inline external image: "${src}". Self-contained HTML requires all images to be local.`
      );
      result.success = false;
      continue;
    }

    try {
      // Resolve image file path (handle both relative and absolute paths)
      const imagePath = src.startsWith('/') ? join(htmlDir, src) : resolve(htmlDir, src);

      logger.debug({ src, imagePath }, 'Reading image file');

      // Read image file as buffer
      const imageBuffer = await readFile(imagePath);
      const imageSize = imageBuffer.length;

      // Determine MIME type from file extension
      const mimeType = getImageMimeType(imagePath);

      // Convert to base64 data URI
      const base64 = imageBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      // Replace src with data URI
      img.attr('src', dataUri);
      img.attr('data-original-src', src);

      result.inlinedCount++;
      result.totalSize += imageSize;

      logger.info(
        {
          src,
          size: imageSize,
          mimeType,
          index: i + 1,
          total: imgTags.length,
        },
        'Inlined image file'
      );
    } catch (error) {
      const errorMessage = `Failed to inline image "${src}": ${error instanceof Error ? error.message : String(error)}`;
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
    'Image inlining complete'
  );

  return result;
}

/**
 * Inline image URLs in CSS (within <style> tags and style attributes)
 * This handles background images and other CSS-referenced images
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param htmlPath - Path to the HTML file (for resolving relative paths)
 * @returns Result object with success status and statistics
 */
export async function inlineCSSImages($: CheerioAPI, htmlPath: string): Promise<ImageInlineResult> {
  const result: ImageInlineResult = {
    success: true,
    inlinedCount: 0,
    totalSize: 0,
    errors: [],
  };

  const htmlDir = dirname(htmlPath);

  // Find all <style> tags
  const styleTags = $('style');

  logger.info({ count: styleTags.length }, 'Processing CSS image url() references');

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

      // Skip data URIs (already inlined)
      if (url.startsWith('data:')) {
        continue;
      }

      // Skip external URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        logger.warn({ url }, 'Skipping external CSS image reference');
        continue;
      }

      // Only process image files (skip fonts which are handled by CSS inliner)
      if (!isImageFile(url)) {
        continue;
      }

      try {
        // Resolve file path
        const imagePath = url.startsWith('/') ? join(htmlDir, url) : resolve(htmlDir, url);

        logger.debug({ url, imagePath }, 'Reading CSS image file');

        // Read file and convert to data URI
        const imageBuffer = await readFile(imagePath);
        const mimeType = getImageMimeType(imagePath);
        const base64 = imageBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        replacements.push({
          original: match[0],
          replacement: `url('${dataUri}')`,
        });

        result.inlinedCount++;
        result.totalSize += imageBuffer.length;

        logger.debug(
          { url, imagePath, size: imageBuffer.length },
          'Converted CSS image url() to data URI'
        );
      } catch (error) {
        logger.warn({ url, error }, 'Failed to inline CSS image url() reference');
        // Don't fail the entire process for CSS image failures
      }
    }

    // Apply all replacements
    for (const { original, replacement } of replacements) {
      cssContent = cssContent.replace(original, replacement);
    }

    styleTag.html(cssContent);
  }

  // Also process inline style attributes
  const elementsWithStyle = $('[style]');
  logger.info({ count: elementsWithStyle.length }, 'Processing inline style attributes');

  for (let i = 0; i < elementsWithStyle.length; i++) {
    const elem = elementsWithStyle.eq(i);
    let styleAttr = elem.attr('style') || '';

    const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
    let match;
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = urlPattern.exec(styleAttr)) !== null) {
      const url = match[1];

      if (!url) {
        continue;
      }

      if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        continue;
      }

      if (!isImageFile(url)) {
        continue;
      }

      try {
        const imagePath = url.startsWith('/') ? join(htmlDir, url) : resolve(htmlDir, url);

        const imageBuffer = await readFile(imagePath);
        const mimeType = getImageMimeType(imagePath);
        const base64 = imageBuffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        replacements.push({
          original: match[0],
          replacement: `url('${dataUri}')`,
        });

        result.inlinedCount++;
        result.totalSize += imageBuffer.length;
      } catch (error) {
        logger.warn({ url, error }, 'Failed to inline inline-style image url()');
      }
    }

    for (const { original, replacement } of replacements) {
      styleAttr = styleAttr.replace(original, replacement);
    }

    elem.attr('style', styleAttr);
  }

  if (result.inlinedCount > 0) {
    logger.info(
      { inlinedCount: result.inlinedCount, totalSize: result.totalSize },
      'CSS image url() inlining complete'
    );
  }

  return result;
}

/**
 * Get MIME type for an image based on file extension
 */
function getImageMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Check if a URL points to an image file
 */
function isImageFile(url: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp'];
  return imageExtensions.some((ext) => url.toLowerCase().endsWith(ext));
}

/**
 * Verify no external image references remain
 * This is a safety check to ensure self-contained HTML compliance
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns Array of external image URLs found
 */
export function verifyNoExternalImages($: CheerioAPI): string[] {
  const externalImages: string[] = [];

  $('img[src]').each((_, elem) => {
    const src = $(elem).attr('src');
    if (
      src &&
      !src.startsWith('data:') &&
      (src.startsWith('http://') || src.startsWith('https://'))
    ) {
      externalImages.push(src);
    }
  });

  if (externalImages.length > 0) {
    logger.error(
      { count: externalImages.length, images: externalImages },
      'External images detected - violates self-contained HTML requirement'
    );
  }

  return externalImages;
}
