/**
 * Prometheus metrics implementation (stub for TDD)
 * TODO: Implement actual metrics collection per T016-T017
 */

import type { HealthCheckResult, ServiceStatus } from '../types/health-check.js';

export function recordHealthCheckResult(result: HealthCheckResult): void {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}

export function incrementHealthCheckCounter(status: ServiceStatus, serviceName: string): void {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}
