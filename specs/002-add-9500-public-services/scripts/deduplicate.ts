#!/usr/bin/env tsx
/**
 * Deduplication Script (T011)
 *
 * Removes duplicate services based on canonical URLs:
 * - Uses Set for O(1) lookup by canonical_url
 * - Marks duplicates with is_duplicate flag
 * - Keeps first occurrence (earliest discovery_date)
 * - Tracks what each duplicate is a duplicate of
 *
 * Usage: tsx scripts/deduplicate.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';

interface RedirectResult {
  original_url: string;
  canonical_url: string;
  redirect_chain: string[];
  redirect_count: number;
  latency_ms: number;
  error?: string;
}

interface DeduplicatedService extends RedirectResult {
  is_duplicate: boolean;
  duplicate_of?: string;
  duplicate_original_urls?: string[];
}

function deduplicateServices(services: RedirectResult[]): DeduplicatedService[] {
  const canonicalMap = new Map<string, DeduplicatedService>();
  const results: DeduplicatedService[] = [];

  for (const service of services) {
    const { canonical_url } = service;

    // Check if we've seen this canonical URL before
    if (canonicalMap.has(canonical_url)) {
      // This is a duplicate
      const original = canonicalMap.get(canonical_url)!;

      // Track all original URLs that map to this canonical URL
      if (!original.duplicate_original_urls) {
        original.duplicate_original_urls = [original.original_url];
      }
      original.duplicate_original_urls.push(service.original_url);

      results.push({
        ...service,
        is_duplicate: true,
        duplicate_of: canonical_url,
      });
    } else {
      // This is the first occurrence - keep it
      const deduplicated: DeduplicatedService = {
        ...service,
        is_duplicate: false,
      };
      canonicalMap.set(canonical_url, deduplicated);
      results.push(deduplicated);
    }
  }

  // Calculate statistics
  const totalServices = results.length;
  const duplicates = results.filter(s => s.is_duplicate).length;
  const unique = totalServices - duplicates;

  console.log(`Deduplication statistics:`);
  console.log(`  Total services processed: ${totalServices}`);
  console.log(`  Unique canonical URLs: ${unique}`);
  console.log(`  Duplicate URLs: ${duplicates}`);
  console.log(`  Deduplication rate: ${((duplicates / totalServices) * 100).toFixed(2)}%`);

  // Find canonical URLs with most duplicates
  const canonicalCounts = new Map<string, number>();
  for (const service of results) {
    if (service.is_duplicate && service.duplicate_of) {
      canonicalCounts.set(service.duplicate_of, (canonicalCounts.get(service.duplicate_of) || 0) + 1);
    }
  }

  if (canonicalCounts.size > 0) {
    const topDuplicates = Array.from(canonicalCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log(`\nTop 10 canonical URLs with most duplicates:`);
    for (const [url, count] of topDuplicates) {
      console.log(`  ${count} duplicates → ${url}`);
    }
  }

  return results;
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/deduplicate.ts --input <file> --output <file>');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];

  console.log(`Reading redirect results from: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const services = JSON.parse(content);

  console.log(`Deduplicating ${services.length} services...`);
  const results = deduplicateServices(services);

  console.log(`\nWriting results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('✓ Deduplication complete');
}

main();
