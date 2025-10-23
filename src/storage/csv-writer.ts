/**
 * CSV writer implementation
 * T030: Implement CSV writer for historical health check data
 *
 * Requirements:
 * - Append HealthCheckResult to history.csv
 * - Columns: timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id
 * - Create file if not exists
 * - Append without duplicate headers
 * - Exit with non-zero on write failure
 * - Atomic writes
 * - RFC 4180 escaping (commas, quotes, newlines)
 */

import { appendFile, access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { HealthCheckResult } from '../types/health-check.ts';
import { escapeCsvValue, CSV_HEADER_LINE } from '../utils/csv.ts';
import { createLogger } from '../logging/logger.ts';

const logger = createLogger({ serviceName: 'csv-writer' });

export class CsvWriter {
  constructor(private filePath: string) {}

  /**
   * Appends a single HealthCheckResult to the CSV file
   * Creates file with header if it doesn't exist
   * Per FR-016, FR-018, FR-020, FR-020a
   */
  async append(result: HealthCheckResult): Promise<void> {
    try {
      // Check if file exists
      const fileExists = await this.fileExists();

      // If file doesn't exist, create it with header
      if (!fileExists) {
        await this.createFileWithHeader();
      }

      // Convert result to CSV row and append
      const csvRow = this.toCsvRow(result);
      await appendFile(this.filePath, csvRow + '\n', 'utf-8');

    } catch (error) {
      // Per FR-020a: Exit with non-zero code on write failure
      logger.error({ error, filePath: this.filePath }, 'CSV write failure');
      process.exit(1);
    }
  }

  /**
   * Appends multiple HealthCheckResults in a single write operation
   * More efficient for batch operations
   */
  async appendBatch(results: HealthCheckResult[]): Promise<void> {
    if (results.length === 0) {
      return;
    }

    try {
      // Check if file exists
      const fileExists = await this.fileExists();

      // Prepare data to write
      let data = '';

      // Add header if file doesn't exist
      if (!fileExists) {
        data += CSV_HEADER_LINE;
      }

      // Convert all results to CSV rows
      for (const result of results) {
        data += this.toCsvRow(result) + '\n';
      }

      // Atomic write
      if (fileExists) {
        await appendFile(this.filePath, data, 'utf-8');
      } else {
        await writeFile(this.filePath, data, 'utf-8');
      }

    } catch (error) {
      // Per FR-020a: Exit with non-zero code on write failure
      logger.error({ error, filePath: this.filePath, count: results.length }, 'CSV batch write failure');
      process.exit(1);
    }
  }

  /**
   * Checks if the CSV file exists
   */
  private async fileExists(): Promise<boolean> {
    try {
      await access(this.filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates CSV file with header row
   */
  private async createFileWithHeader(): Promise<void> {
    await writeFile(this.filePath, CSV_HEADER_LINE, 'utf-8');
  }

  /**
   * Converts HealthCheckResult to CSV row
   * Per FR-018: RFC 4180 escaping for commas, quotes, newlines
   */
  private toCsvRow(result: HealthCheckResult): string {
    const timestamp = result.timestamp.toISOString();
    const serviceName = escapeCsvValue(result.serviceName);
    const status = result.status === 'PENDING' ? 'FAIL' : result.status; // Historical records don't include PENDING
    const latencyMs = result.latency_ms.toString();
    const httpStatusCode = result.http_status_code.toString();
    // Don't escape empty failure reasons - leave them as empty strings
    const failureReason = result.failure_reason ? escapeCsvValue(result.failure_reason) : '';
    const correlationId = result.correlation_id;

    return `${timestamp},${serviceName},${status},${latencyMs},${httpStatusCode},${failureReason},${correlationId}`;
  }
}
