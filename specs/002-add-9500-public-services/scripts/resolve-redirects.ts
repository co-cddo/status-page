#!/usr/bin/env tsx
/**
 * Redirect Resolution Script (T010)
 *
 * Follows HTTP redirects to determine canonical URLs:
 * - Maximum 5 redirect hops
 * - Circular redirect detection
 * - Redirect chain tracking
 * - 5-second timeout per hop
 *
 * Usage: tsx scripts/resolve-redirects.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { request } from 'undici';

interface RedirectResult {
  original_url: string;
  canonical_url: string;
  redirect_chain: string[];
  redirect_count: number;
  latency_ms: number;
  error?: string;
}

async function resolveRedirects(
  url: string,
  maxRedirects = 5,
  timeout = 5000,
): Promise<RedirectResult> {
  const startTime = Date.now();
  const redirectChain: string[] = [url];
  const visited = new Set<string>([url]);
  let currentUrl = url;
  let redirectCount = 0;

  try {
    while (redirectCount < maxRedirects) {
      const response = await request(currentUrl, {
        method: 'HEAD',
        maxRedirections: 0, // Handle redirects manually
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      const statusCode = response.statusCode;

      // Not a redirect - this is the canonical URL
      if (statusCode < 300 || statusCode >= 400) {
        return {
          original_url: url,
          canonical_url: currentUrl,
          redirect_chain: redirectChain,
          redirect_count: redirectCount,
          latency_ms: Date.now() - startTime,
        };
      }

      // Get redirect location
      const location = response.headers.location as string;
      if (!location) {
        return {
          original_url: url,
          canonical_url: currentUrl,
          redirect_chain: redirectChain,
          redirect_count: redirectCount,
          latency_ms: Date.now() - startTime,
          error: 'Redirect without Location header',
        };
      }

      // Resolve relative URLs
      const nextUrl = new URL(location, currentUrl).href;

      // Circular redirect detection
      if (visited.has(nextUrl)) {
        return {
          original_url: url,
          canonical_url: currentUrl,
          redirect_chain: redirectChain,
          redirect_count: redirectCount,
          latency_ms: Date.now() - startTime,
          error: `Circular redirect detected: ${nextUrl}`,
        };
      }

      redirectChain.push(nextUrl);
      visited.add(nextUrl);
      currentUrl = nextUrl;
      redirectCount++;
    }

    // Max redirects exceeded
    return {
      original_url: url,
      canonical_url: currentUrl,
      redirect_chain: redirectChain,
      redirect_count: redirectCount,
      latency_ms: Date.now() - startTime,
      error: `Maximum redirects (${maxRedirects}) exceeded`,
    };
  } catch (error) {
    return {
      original_url: url,
      canonical_url: url, // Use original if resolution fails
      redirect_chain: redirectChain,
      redirect_count: redirectCount,
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function processUrls(
  urls: { original_url: string; normalized_url: string }[],
  concurrency = 50,
): Promise<RedirectResult[]> {
  const results: RedirectResult[] = [];
  const queue = [...urls];
  const processing: Promise<void>[] = [];

  const processNext = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const result = await resolveRedirects(item.normalized_url);
      results.push(result);

      if (results.length % 100 === 0) {
        console.log(`Processed ${results.length}/${urls.length} URLs...`);
      }
    }
  };

  // Start concurrent workers
  for (let i = 0; i < concurrency; i++) {
    processing.push(processNext());
  }

  await Promise.all(processing);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  const concurrencyIndex = args.indexOf('--concurrency');
  const maxRedirectsIndex = args.indexOf('--max-redirects');
  const timeoutIndex = args.indexOf('--timeout');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/resolve-redirects.ts --input <file> --output <file> [options]');
    console.error('Options:');
    console.error('  --concurrency <number>    Concurrent requests (default: 50)');
    console.error('  --max-redirects <number>  Maximum redirect hops (default: 5)');
    console.error('  --timeout <ms>            Timeout per request (default: 5000)');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];
  const concurrency = concurrencyIndex !== -1 ? parseInt(args[concurrencyIndex + 1]) : 50;
  const maxRedirects = maxRedirectsIndex !== -1 ? parseInt(args[maxRedirectsIndex + 1]) : 5;
  const timeout = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1]) : 5000;

  console.log(`Reading normalized URLs from: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const urls = JSON.parse(content);

  console.log(`Resolving redirects for ${urls.length} URLs...`);
  console.log(`Concurrency: ${concurrency}, Max redirects: ${maxRedirects}, Timeout: ${timeout}ms`);

  const results = await processUrls(urls, concurrency);

  const errors = results.filter(r => r.error);
  const circular = errors.filter(r => r.error?.includes('Circular'));
  const exceeded = errors.filter(r => r.error?.includes('exceeded'));

  console.log(`Redirect resolution complete:`);
  console.log(`  Total: ${results.length}`);
  console.log(`  Success: ${results.length - errors.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Circular redirects: ${circular.length}`);
  console.log(`  Max redirects exceeded: ${exceeded.length}`);

  console.log(`Writing results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('✓ Redirect resolution complete');
}

main();
