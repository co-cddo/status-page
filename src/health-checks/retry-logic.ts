/**
 * Retry logic implementation (stub for TDD)
 * TODO: Implement actual retry logic per T028
 */

import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';

export interface RetryableError {
  type: 'network' | 'timeout' | 'validation' | 'http' | 'ssl';
  code: string;
  message: string;
}

export function shouldRetry(error: RetryableError): boolean {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}

export async function performHealthCheckWithRetry(
  config: HealthCheckConfig,
  healthCheckFn: (config: HealthCheckConfig) => Promise<HealthCheckResult>
): Promise<HealthCheckResult> {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}
