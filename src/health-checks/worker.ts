/**
 * Health check worker thread implementation (stub for TDD)
 * TODO: Implement actual worker logic per T029
 */

import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';

export interface WorkerMessage {
  type: 'health-check';
  config: HealthCheckConfig;
}

export interface WorkerResult {
  type: 'health-check-result';
  result: HealthCheckResult;
  error?: {
    message: string;
    code?: string;
    type: string;
  };
}

export async function processHealthCheck(message: WorkerMessage): Promise<WorkerResult> {
  // Stub implementation - tests should fail
  throw new Error('Not implemented yet - TDD stub');
}
