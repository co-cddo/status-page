/**
 * Markdown table generation utilities
 * Reusable functions for generating GitHub Flavored Markdown tables
 */

import { escapeMarkdown, truncate } from './string.ts';
import { formatLatency } from './format.ts';
import type { HealthCheckResult } from '../types/health-check.ts';

/**
 * Options for generating health check tables
 */
export interface HealthCheckTableOptions {
  /** Whether to include the failure reason column (default: true) */
  includeFailureReason?: boolean;
  /** Maximum length for failure reason text before truncation (default: 100) */
  maxReasonLength?: number;
}

/**
 * Generate a Markdown table from health check results
 * Creates a formatted table with columns: Service, Status, Latency, HTTP Code, Failure Reason
 *
 * @param results - Array of health check results to render
 * @param options - Optional configuration for table generation
 * @returns Markdown-formatted table string with newline at end
 *
 * @example
 * ```typescript
 * const results = [
 *   { serviceName: 'API', status: 'PASS', latency_ms: 150, http_status_code: 200, failure_reason: '' }
 * ];
 * const table = generateHealthCheckTable(results);
 * // Returns:
 * // | Service | Status | Latency | HTTP Code | Failure Reason |
 * // |---------|--------|---------|-----------|----------------|
 * // | API | PASS | 150ms | 200 | - |
 * ```
 */
export function generateHealthCheckTable(
  results: HealthCheckResult[],
  options?: HealthCheckTableOptions
): string {
  if (results.length === 0) return '';

  const opts: Required<HealthCheckTableOptions> = {
    includeFailureReason: true,
    maxReasonLength: 100,
    ...options,
  };

  const lines: string[] = [];
  lines.push('| Service | Status | Latency | HTTP Code | Failure Reason |');
  lines.push('|---------|--------|---------|-----------|----------------|');

  results.forEach((result) => {
    const serviceName = escapeMarkdown(result.serviceName);
    const status = result.status;
    const latency = formatLatency(result.latency_ms);
    const httpCode = result.http_status_code || 'N/A';
    const failureReason =
      opts.includeFailureReason && result.failure_reason
        ? truncate(escapeMarkdown(result.failure_reason), opts.maxReasonLength)
        : '-';

    lines.push(`| ${serviceName} | ${status} | ${latency} | ${httpCode} | ${failureReason} |`);
  });

  return lines.join('\n') + '\n';
}
