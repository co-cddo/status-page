/**
 * JSON writer implementation
 * T032: Implement JSON data writer for _data/health.json
 *
 * Requirements:
 * - Write _data/health.json from HealthCheckResult array
 * - Map to ServiceStatusAPI format
 * - Sort: FAIL → DEGRADED → PASS → PENDING
 * - Null values for PENDING services
 * - Exit with non-zero on write failure
 * - Verify JSON structure matches OpenAPI schema
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HealthCheckResult, ServiceStatusAPI } from '../types/health-check.ts';

const STATUS_ORDER = { FAIL: 0, DEGRADED: 1, PASS: 2, PENDING: 3 };

export class JsonWriter {
  constructor(private filePath: string) {}

  /**
   * Writes health check results to JSON file in ServiceStatusAPI format
   * Per FR-022, FR-028a: Sort by status (FAIL → DEGRADED → PASS → PENDING)
   */
  async write(
    results: HealthCheckResult[],
    tags: Map<string, string[]> = new Map()
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      await mkdir(dir, { recursive: true });

      // Convert results to API format
      const apiResults: ServiceStatusAPI[] = results.map((result) =>
        this.toServiceStatusAPI(result, tags)
      );

      // Sort by status: FAIL → DEGRADED → PASS → PENDING
      apiResults.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

      // Write to file with pretty formatting (plain array)
      const json = JSON.stringify(apiResults, null, 2);
      await writeFile(this.filePath, json, 'utf-8');
    } catch (error) {
      // Per FR-028a: Exit with non-zero code on write failure
      console.error(`JSON write failure: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Converts HealthCheckResult to ServiceStatusAPI format
   * Per FR-022: Include all required fields with proper null handling for PENDING
   */
  private toServiceStatusAPI(
    result: HealthCheckResult,
    tags: Map<string, string[]>
  ): ServiceStatusAPI {
    const isPending = result.status === 'PENDING';

    return {
      name: result.serviceName,
      status: result.status,
      latency_ms: isPending ? null : result.latency_ms,
      last_check_time: isPending ? null : result.timestamp.toISOString(),
      tags: tags.get(result.serviceName) || [],
      http_status_code: isPending ? null : result.http_status_code,
      failure_reason: result.failure_reason,
    };
  }
}
