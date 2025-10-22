/**
 * HTTP health check implementation (stub for TDD)
 * TODO: Implement actual health check logic per T026
 */

import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';

export async function performHealthCheck(
  config: HealthCheckConfig
): Promise<HealthCheckResult> {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}
