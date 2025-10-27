#!/usr/bin/env tsx
/**
 * URL Normalization Script (T009)
 *
 * Applies RFC 3986 normalization to discovered URLs:
 * - Lowercase scheme and host
 * - Remove default ports (80, 443)
 * - Sort query parameters
 * - Remove trailing slashes
 * - Normalize percent-encoding
 *
 * Usage: tsx scripts/normalize-urls.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import normalizeUrl from 'normalize-url';

interface NormalizedResult {
  original_url: string;
  normalized_url: string;
  changes_made: string[];
}

function normalizeUrls(urls: string[]): NormalizedResult[] {
  const results: NormalizedResult[] = [];

  for (const url of urls) {
    const changes: string[] = [];

    try {
      const normalized = normalizeUrl(url, {
        defaultProtocol: 'https',
        normalizeProtocol: true,
        forceHttps: false,
        stripHash: false,
        stripWWW: false, // Preserve www - redirect resolution will handle
        removeQueryParameters: false,
        sortQueryParameters: true,
        removeTrailingSlash: true,
        removeSingleSlash: false,
        removeDirectoryIndex: false,
        removeExplicitPort: true, // Remove :80, :443
      });

      if (normalized !== url) {
        if (normalized.replace(/^https?/, '') !== url.replace(/^https?/, '')) {
          changes.push('protocol-normalized');
        }
        if (!url.endsWith('/') && normalized.endsWith('/') || url.endsWith('/') && !normalized.endsWith('/')) {
          changes.push('trailing-slash-removed');
        }
        if (url.includes(':80') || url.includes(':443')) {
          changes.push('default-port-removed');
        }
        if (url.includes('?') && normalized.includes('?')) {
          changes.push('query-params-sorted');
        }
      }

      results.push({
        original_url: url,
        normalized_url: normalized,
        changes_made: changes,
      });
    } catch (error) {
      console.error(`Failed to normalize URL: ${url}`, error);
      results.push({
        original_url: url,
        normalized_url: url, // Keep original if normalization fails
        changes_made: ['error'],
      });
    }
  }

  return results;
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/normalize-urls.ts --input <file> --output <file>');
    console.error('Input file should contain one URL per line');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];

  console.log(`Reading URLs from: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const urls = content.split('\n').filter(line => line.trim().length > 0);

  console.log(`Normalizing ${urls.length} URLs...`);
  const results = normalizeUrls(urls);

  const changedCount = results.filter(r => r.changes_made.length > 0).length;
  console.log(`Normalization complete: ${changedCount} URLs changed, ${urls.length - changedCount} unchanged`);

  console.log(`Writing results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('✓ URL normalization complete');
}

main();
