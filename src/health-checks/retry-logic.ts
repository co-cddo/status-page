/**
 * Retry logic implementation
 * T028: Implement retry logic for health checks
 *
 * Retry behavior:
 * - Retry for network errors only (connection refused, DNS failure, timeout)
 * - Max 3 immediate retries (no delays, no exponential backoff)
 * - Retries don't count toward consecutive failure threshold
 * - NO retry for status/text/header validation failures
 */

import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.ts';

export interface RetryableError {
  type: 'network' | 'timeout' | 'validation' | 'http' | 'ssl';
  code: string;
  message: string;
}

/**
 * Determines if an error should be retried
 * Only network errors (connection refused, DNS failure, timeout) are retryable
 * Validation failures (status code, text, headers) are NOT retryable
 *
 * @param error RetryableError or HealthCheckResult that failed
 * @returns true if error is retryable, false otherwise
 */
export function shouldRetry(error: RetryableError | HealthCheckResult): boolean {
  // Handle RetryableError type (from tests)
  if ('type' in error && 'code' in error) {
    return error.type === 'network' || error.type === 'timeout';
  }

  // Handle HealthCheckResult type (from actual implementation)
  const result = error as HealthCheckResult;

  // Only retry if http_status_code is 0 (network/connection failure)
  // Status codes > 0 indicate we got a response, so validation failed (not retryable)
  if (result.http_status_code !== 0) {
    return false;
  }

  // Check failure reason for retryable network errors
  const reason = result.failure_reason.toLowerCase();

  return (
    reason.includes('timeout') ||
    reason.includes('connection refused') ||
    reason.includes('dns failure') ||
    reason.includes('network') ||
    reason.includes('econnrefused') ||
    reason.includes('enotfound') ||
    reason.includes('enetunreach') ||
    reason.includes('econnreset') ||
    reason.includes('econnaborted') ||
    reason.includes('getaddrinfo')
  );
}

/**
 * Performs health check with automatic retry logic
 * Retries up to maxRetries times for network errors
 * No delays between retries (immediate retry)
 *
 * @param config Health check configuration
 * @param healthCheckFn Health check function to execute
 * @returns Final health check result (success or final failure after all retries)
 */
export async function performHealthCheckWithRetry(
  config: HealthCheckConfig,
  healthCheckFn: (config: HealthCheckConfig) => Promise<HealthCheckResult>
): Promise<HealthCheckResult> {
  let lastResult: HealthCheckResult | null = null;
  let attempt = 0;
  const maxRetries = config.maxRetries ?? 3; // Default to 3 retries per FR-017

  while (attempt <= maxRetries) {
    // Perform health check
    const result = await healthCheckFn(config);

    // If check passed or degraded, return immediately
    if (result.status === 'PASS' || result.status === 'DEGRADED') {
      return result;
    }

    // Check failed - determine if we should retry
    lastResult = result;

    // If this is the last attempt, return the failure
    if (attempt === maxRetries) {
      break;
    }

    // Check if error is retryable
    if (!shouldRetry(result)) {
      // Validation failure or other non-retryable error
      return result;
    }

    // Increment attempt counter and retry (immediate, no delay)
    attempt++;
  }

  // All retries exhausted, return final failure
  return lastResult!;
}

/**
 * Classifies error type from health check result
 * Used for error categorization and logging
 *
 * @param result Health check result
 * @returns Error type classification
 */
export function classifyError(result: HealthCheckResult): RetryableError['type'] {
  if (result.http_status_code !== 0) {
    return 'validation';
  }

  const reason = result.failure_reason.toLowerCase();

  if (reason.includes('timeout')) {
    return 'timeout';
  }

  if (reason.includes('certificate') || reason.includes('ssl') || reason.includes('tls')) {
    return 'ssl';
  }

  if (
    reason.includes('connection') ||
    reason.includes('dns') ||
    reason.includes('econnrefused') ||
    reason.includes('enotfound')
  ) {
    return 'network';
  }

  return 'network';
}
