/**
 * JSON writer implementation (stub for TDD)
 * TODO: Implement actual JSON writing logic per T032
 */

import type { HealthCheckResult } from '../types/health-check.js';

export class JsonWriter {
  constructor(private filePath: string) {}

  async write(results: HealthCheckResult[]): Promise<void> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }
}
