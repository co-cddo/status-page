/**
 * HistoricalRecord model for CSV storage
 * Based on data-model.md specifications
 */

import type { HealthCheckResult } from './health-check-result.js';

/**
 * CSV record structure for historical data
 * All fields are required (no null/empty except failure_reason)
 */
export interface HistoricalRecord {
  timestamp: string; // ISO 8601 format
  service_name: string;
  status: 'PASS' | 'DEGRADED' | 'FAIL';
  latency_ms: number; // Integer
  http_status_code: number; // Integer
  failure_reason: string; // Empty string if passed
  correlation_id: string; // UUID
}

/**
 * CSV column headers in strict order
 */
export const CSV_HEADERS = [
  'timestamp',
  'service_name',
  'status',
  'latency_ms',
  'http_status_code',
  'failure_reason',
  'correlation_id',
] as const;

/**
 * Convert HealthCheckResult to HistoricalRecord for CSV storage
 */
export function toHistoricalRecord(result: HealthCheckResult): HistoricalRecord {
  return {
    timestamp: result.timestamp.toISOString(),
    service_name: result.serviceName,
    status: result.status === 'PENDING' ? 'FAIL' : result.status, // PENDING shouldn't appear in CSV
    latency_ms: Math.round(result.latency_ms), // Ensure integer
    http_status_code: result.http_status_code,
    failure_reason: result.failure_reason || '',
    correlation_id: result.correlation_id,
  };
}

/**
 * Validate CSV record structure
 */
export function isValidHistoricalRecord(record: unknown): record is HistoricalRecord {
  if (typeof record !== 'object' || record === null) {
    return false;
  }

  const r = record as Record<string, unknown>;

  return (
    typeof r.timestamp === 'string' &&
    typeof r.service_name === 'string' &&
    (r.status === 'PASS' || r.status === 'DEGRADED' || r.status === 'FAIL') &&
    typeof r.latency_ms === 'number' &&
    typeof r.http_status_code === 'number' &&
    typeof r.failure_reason === 'string' &&
    typeof r.correlation_id === 'string'
  );
}
