#!/usr/bin/env tsx
/**
 * Accessibility Validation Script (T012)
 *
 * Validates that discovered services are publicly accessible:
 * - HTTP status checks (200/301/302/401/403 = accessible)
 * - Latency measurement
 * - Retry logic (3 attempts with exponential backoff)
 * - Validation text pattern matching (if configured)
 *
 * Usage: tsx scripts/validate-accessibility.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { request } from 'undici';

interface DeduplicatedService {
  original_url: string;
  canonical_url: string;
  is_duplicate: boolean;
  error?: string;
}

interface ValidationResult {
  url: string;
  canonical_url: string;
  is_accessible: boolean;
  http_status: number;
  latency_ms: number;
  validation_passed: boolean;
  failure_reason: string;
  timestamp: string;
  retry_count: number;
}

async function validateService(
  canonicalUrl: string,
  maxRetries = 3,
  timeout = 15000,
): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  let retryCount = 0;
  let lastError: string | undefined;

  while (retryCount <= maxRetries) {
    const startTime = Date.now();

    try {
      const response = await request(canonicalUrl, {
        method: 'GET',
        maxRedirections: 0,
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      const statusCode = response.statusCode;
      const latency = Date.now() - startTime;

      // Determine if accessible
      // 200 = OK, 301/302 = redirect (should have been resolved earlier but acceptable)
      // 401/403 = authentication required (service exists but requires auth)
      const accessibleStatuses = [200, 301, 302, 401, 403];
      const isAccessible = accessibleStatuses.includes(statusCode);

      // Determine if validation passed
      // For now, we consider 200-403 as "passed" (service exists and responds)
      // 404/410 = not found/gone = failed
      // 500+ = server error = failed (but might be temporary)
      const validationPassed = isAccessible && statusCode !== 404 && statusCode !== 410;

      let failureReason = '';
      if (!validationPassed) {
        if (statusCode === 404) {
          failureReason = 'Service not found (404)';
        } else if (statusCode === 410) {
          failureReason = 'Service gone (410)';
        } else if (statusCode >= 500) {
          failureReason = `Server error (${statusCode})`;
        } else {
          failureReason = `Unexpected status code: ${statusCode}`;
        }
      }

      return {
        url: canonicalUrl,
        canonical_url: canonicalUrl,
        is_accessible: isAccessible,
        http_status: statusCode,
        latency_ms: latency,
        validation_passed: validationPassed,
        failure_reason: failureReason,
        timestamp,
        retry_count: retryCount,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      lastError = error instanceof Error ? error.message : 'Unknown error';

      // Check if this is a network error that warrants retry
      const isNetworkError =
        lastError.includes('timeout') ||
        lastError.includes('ECONNREFUSED') ||
        lastError.includes('ENOTFOUND') ||
        lastError.includes('ETIMEDOUT');

      if (isNetworkError && retryCount < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }

      // No more retries or non-network error
      return {
        url: canonicalUrl,
        canonical_url: canonicalUrl,
        is_accessible: false,
        http_status: 0,
        latency_ms: latency,
        validation_passed: false,
        failure_reason: lastError,
        timestamp,
        retry_count: retryCount,
      };
    }
  }

  // Should never reach here, but TypeScript requires it
  return {
    url: canonicalUrl,
    canonical_url: canonicalUrl,
    is_accessible: false,
    http_status: 0,
    latency_ms: 0,
    validation_passed: false,
    failure_reason: lastError || 'Max retries exceeded',
    timestamp,
    retry_count: maxRetries,
  };
}

async function validateServices(
  services: DeduplicatedService[],
  concurrency = 50,
): Promise<ValidationResult[]> {
  // Filter out duplicates and services that already have errors
  const toValidate = services.filter(s => !s.is_duplicate && !s.error);

  console.log(`Validating ${toValidate.length} unique services (${services.length - toValidate.length} skipped as duplicates or errors)`);

  const results: ValidationResult[] = [];
  const queue = [...toValidate];
  const processing: Promise<void>[] = [];

  const processNext = async () => {
    while (queue.length > 0) {
      const service = queue.shift();
      if (!service) break;

      const result = await validateService(service.canonical_url);
      results.push(result);

      if (results.length % 50 === 0) {
        console.log(`Validated ${results.length}/${toValidate.length} services...`);
      }
    }
  };

  // Start concurrent workers
  for (let i = 0; i < concurrency; i++) {
    processing.push(processNext());
  }

  await Promise.all(processing);

  // Statistics
  const passed = results.filter(r => r.validation_passed).length;
  const failed = results.length - passed;
  const accessible = results.filter(r => r.is_accessible).length;

  console.log(`\nValidation statistics:`);
  console.log(`  Total validated: ${results.length}`);
  console.log(`  Passed: ${passed} (${((passed / results.length) * 100).toFixed(2)}%)`);
  console.log(`  Failed: ${failed} (${((failed / results.length) * 100).toFixed(2)}%)`);
  console.log(`  Accessible (2xx/3xx/401/403): ${accessible}`);
  console.log(`  Average latency: ${(results.reduce((sum, r) => sum + r.latency_ms, 0) / results.length).toFixed(0)}ms`);

  // Group failures by reason
  const failureReasons = new Map<string, number>();
  for (const result of results.filter(r => !r.validation_passed)) {
    const reason = result.failure_reason.split('(')[0].trim(); // Group by prefix
    failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
  }

  if (failureReasons.size > 0) {
    console.log(`\nFailure reasons:`);
    for (const [reason, count] of Array.from(failureReasons.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}× ${reason}`);
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  const concurrencyIndex = args.indexOf('--concurrency');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/validate-accessibility.ts --input <file> --output <file> [--concurrency <number>]');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];
  const concurrency = concurrencyIndex !== -1 ? parseInt(args[concurrencyIndex + 1]) : 50;

  console.log(`Reading services from: ${inputFile}`);
  const content = readFileSync(inputFile, 'utf-8');
  const services = JSON.parse(content);

  const results = await validateServices(services, concurrency);

  console.log(`\nWriting results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log('✓ Accessibility validation complete');
}

main();
