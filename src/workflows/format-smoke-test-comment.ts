/**
 * Format smoke test results as Markdown comment for GitHub PR
 * Per T020 (User Story 6): Generate formatted Markdown table with results
 */

import type { HealthCheckResult } from '../types/health-check.ts';
import { generateHealthCheckTable } from '../utils/markdown.ts';
import { createModuleLogger } from '../logging/logger.ts';

const logger = createModuleLogger('smoke-test-comment');

/**
 * Validate a single health check result object
 * @param result - Result object to validate
 * @param index - Array index for error reporting
 * @returns true if valid, false otherwise
 */
function isValidHealthCheckResult(result: unknown, index: number): result is HealthCheckResult {
  if (!result || typeof result !== 'object') {
    logger.warn({ index, result }, 'Invalid health check result: not an object');
    return false;
  }

  const r = result as Partial<HealthCheckResult>;

  if (!r.serviceName || typeof r.serviceName !== 'string') {
    logger.warn(
      { index, serviceName: r.serviceName },
      'Invalid health check result: missing or invalid serviceName'
    );
    return false;
  }

  if (!r.status || !['PASS', 'DEGRADED', 'FAIL', 'PENDING'].includes(r.status)) {
    logger.warn(
      { index, status: r.status, serviceName: r.serviceName },
      'Invalid health check result: invalid status'
    );
    return false;
  }

  if (typeof r.latency_ms !== 'number' || r.latency_ms < 0) {
    logger.warn(
      { index, latency_ms: r.latency_ms, serviceName: r.serviceName },
      'Invalid health check result: invalid latency_ms'
    );
    return false;
  }

  if (typeof r.http_status_code !== 'number') {
    logger.warn(
      { index, http_status_code: r.http_status_code, serviceName: r.serviceName },
      'Invalid health check result: invalid http_status_code'
    );
    return false;
  }

  if (r.failure_reason !== undefined && typeof r.failure_reason !== 'string') {
    logger.warn(
      { index, failure_reason: r.failure_reason, serviceName: r.serviceName },
      'Invalid health check result: invalid failure_reason type'
    );
    return false;
  }

  return true;
}

/**
 * Format health check results as Markdown comment for GitHub PR
 * @param results - Array of health check results
 * @returns Markdown-formatted comment string
 * @throws {TypeError} If results is not an array
 * @example
 * ```typescript
 * const results = [
 *   { serviceName: 'API', status: 'PASS', latency_ms: 150, http_status_code: 200, failure_reason: '' }
 * ];
 * const comment = formatSmokeTestComment(results);
 * // Returns: "## Smoke Test Results\n\n..."
 * ```
 */
export function formatSmokeTestComment(results: HealthCheckResult[]): string {
  // Validate input type
  if (!Array.isArray(results)) {
    throw new TypeError('Results must be an array');
  }

  // Filter out invalid results with warnings
  const validResults = results.filter((result, index) => isValidHealthCheckResult(result, index));

  const timestamp = new Date().toISOString();

  // Handle empty results
  if (validResults.length === 0) {
    return `## Smoke Test Results\n\n**No services configured for health checks.**\n\n*Generated at ${timestamp}*`;
  }

  // Group results by status using single-pass categorization for performance
  const groupedResults = validResults.reduce(
    (acc, result) => {
      acc[result.status].push(result);
      return acc;
    },
    {
      FAIL: [] as HealthCheckResult[],
      DEGRADED: [] as HealthCheckResult[],
      PASS: [] as HealthCheckResult[],
      PENDING: [] as HealthCheckResult[],
    }
  );

  const failedResults = groupedResults.FAIL;
  const degradedResults = groupedResults.DEGRADED;
  const passedResults = groupedResults.PASS;
  const pendingResults = groupedResults.PENDING;

  // Calculate summary statistics
  const total = validResults.length;
  const passed = passedResults.length;
  const degraded = degradedResults.length;
  const failed = failedResults.length;
  const pending = pendingResults.length;
  const failureRate = failed / total;

  // Build comment sections using array join for better performance
  const parts: string[] = [];

  // Add warning section if >50% failures
  if (failureRate > 0.5) {
    parts.push('## ⚠️ WARNING: Widespread Failures Detected\n\n');
    parts.push(
      `**${failed} of ${total} services (${Math.round(failureRate * 100)}%) failed health checks.**\n\n`
    );
    parts.push('This may indicate:\n');
    parts.push('- Configuration errors in `config.yaml`\n');
    parts.push('- Network connectivity issues\n');
    parts.push('- Incorrect service URLs or validation criteria\n');
    parts.push('- Services experiencing widespread outages\n\n');
    parts.push('**Please review the failure reasons below carefully before merging this PR.**\n\n');
  }

  // Add summary section
  parts.push('## Smoke Test Results Summary\n\n');
  parts.push(`**Total Services:** ${total}\n`);
  parts.push(`- ✅ **Passed:** ${passed}\n`);
  parts.push(`- ⚠️ **Degraded:** ${degraded}\n`);
  parts.push(`- ❌ **Failed:** ${failed}\n`);
  parts.push(`- ⏳ **Pending:** ${pending}\n\n`);

  // Add FAILED section
  if (failedResults.length > 0) {
    parts.push('## ❌ FAILED\n\n');
    parts.push(generateHealthCheckTable(failedResults));
    parts.push('\n');
  }

  // Add DEGRADED section
  if (degradedResults.length > 0) {
    parts.push('## ⚠️ DEGRADED\n\n');
    parts.push(generateHealthCheckTable(degradedResults));
    parts.push('\n');
  }

  // Add PENDING section
  if (pendingResults.length > 0) {
    parts.push('## ⏳ PENDING\n\n');
    parts.push(generateHealthCheckTable(pendingResults));
    parts.push('\n');
  }

  // Add PASS section in collapsible accordion
  if (passedResults.length > 0) {
    parts.push('## ✅ PASS\n\n');
    parts.push('<details>\n');
    parts.push(
      `<summary>Show ${passedResults.length} passing check${passedResults.length === 1 ? '' : 's'}</summary>\n\n`
    );
    parts.push(generateHealthCheckTable(passedResults));
    parts.push('</details>\n\n');
  }

  // Add footer with timestamp
  parts.push(`\n*Smoke test completed at ${timestamp}*\n`);

  return parts.join('');
}
