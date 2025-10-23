/**
 * Prometheus metrics implementation
 * Delegates to prometheus.ts for actual metrics recording
 */

import type { HealthCheckResult, ServiceStatus } from '../types/health-check.js';
import { recordHealthCheck } from './prometheus.js';

export function recordHealthCheckResult(result: HealthCheckResult): void {
  // Record health check with status and latency
  recordHealthCheck(
    result.serviceName,
    result.status as 'PASS' | 'DEGRADED' | 'FAIL',
    result.latency_ms
  );
}

export function incrementHealthCheckCounter(status: ServiceStatus, serviceName: string): void {
  // Delegate to recordHealthCheck (already handles counter increments)
  recordHealthCheck(
    serviceName,
    status as 'PASS' | 'DEGRADED' | 'FAIL',
    0 // Latency is recorded separately via recordHealthCheckResult
  );
}
