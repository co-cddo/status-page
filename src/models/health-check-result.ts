/**
 * HealthCheckResult model
 * Based on data-model.md specifications
 */

import type { ServiceStatus } from './service.js';

export interface HealthCheckResult {
  serviceName: string;
  timestamp: Date;
  method: 'GET' | 'HEAD' | 'POST';
  status: ServiceStatus;
  latency_ms: number; // Integer milliseconds
  http_status_code: number; // 0 for connection failures
  expected_status: number;
  textValidationResult?: boolean; // null if not configured
  headerValidationResult?: Record<string, boolean>; // null if not configured
  failure_reason: string; // Empty string if passed
  correlation_id: string; // UUID for log traceability
}

/**
 * Determine service status based on health check outcome
 * Per FR-015, FR-015b, FR-017a
 */
export function determineStatus(
  validationPassed: boolean,
  latency_ms: number,
  warning_threshold: number,
  timeout: number
): ServiceStatus {
  // FAIL: validation failed OR timeout exceeded
  if (!validationPassed || latency_ms > timeout * 1000) {
    return 'FAIL';
  }

  // DEGRADED: validation passed AND latency > warning_threshold AND latency <= timeout
  if (latency_ms > warning_threshold * 1000 && latency_ms <= timeout * 1000) {
    return 'DEGRADED';
  }

  // PASS: validation passed AND latency <= warning_threshold
  return 'PASS';
}

/**
 * Create failure reason message
 */
export function createFailureReason(
  httpStatusCode: number,
  expectedStatus: number,
  textValidation?: { expected?: string; found: boolean },
  headerValidation?: { expected: Record<string, string>; results: Record<string, boolean> },
  networkError?: string
): string {
  if (networkError) {
    return networkError;
  }

  if (httpStatusCode === 0) {
    return 'Connection timeout';
  }

  if (httpStatusCode !== expectedStatus) {
    return `Expected status ${expectedStatus}, got ${httpStatusCode}`;
  }

  if (textValidation && !textValidation.found && textValidation.expected) {
    return `Expected text '${textValidation.expected}' not found`;
  }

  if (headerValidation) {
    const failedHeaders = Object.entries(headerValidation.results)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    if (failedHeaders.length > 0) {
      const expected = headerValidation.expected[failedHeaders[0]];
      return `Expected ${failedHeaders[0]} header '${expected}' not found`;
    }
  }

  return '';
}
