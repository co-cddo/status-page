/**
 * CSV writer implementation (stub for TDD)
 * TODO: Implement actual CSV writing logic per T030
 */

import type { HealthCheckResult } from '../types/health-check.js';

export class CsvWriter {
  constructor(private filePath: string) {}

  async append(result: HealthCheckResult): Promise<void> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  async appendBatch(results: HealthCheckResult[]): Promise<void> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }
}
