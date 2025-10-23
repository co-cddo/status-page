/**
 * TypeScript type definitions for health check results and status
 * Based on data-model.md HealthCheckResult and HistoricalRecord entities
 */

/**
 * Service health status enum
 * Per data-model.md: PENDING → PASS ↔ DEGRADED → FAIL
 */
export type ServiceStatus = 'PENDING' | 'PASS' | 'DEGRADED' | 'FAIL';

/**
 * Configuration for executing a single health check
 * Used by worker threads to perform HTTP checks
 */
export interface HealthCheckConfig {
  /** Service name */
  serviceName: string;

  /** HTTP method */
  method: 'GET' | 'HEAD' | 'POST';

  /** Full URL to check */
  url: string;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Warning latency threshold in milliseconds */
  warningThreshold: number;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Expected HTTP status code(s) */
  expectedStatus: number | number[];

  /** Optional expected text in response body */
  expectedText?: string;

  /** Optional expected response headers */
  expectedHeaders?: Record<string, string>;

  /** Optional custom request headers */
  customHeaders?: Record<string, string>;

  /** Optional custom request headers as array */
  headers?: Array<{ name: string; value: string }>;

  /** Optional POST request body */
  payload?: Record<string, unknown>;

  /** Correlation ID for tracing */
  correlationId: string;
}

/**
 * Result of a single health check execution
 * Per data-model.md HealthCheckResult entity
 */
export interface HealthCheckResult {
  /** Service name checked */
  serviceName: string;

  /** Timestamp when check was executed (ISO 8601) */
  timestamp: Date;

  /** HTTP method used */
  method: 'GET' | 'HEAD' | 'POST';

  /** Health status determined */
  status: ServiceStatus;

  /** Response latency in milliseconds */
  latency_ms: number;

  /** Actual HTTP status code received (0 for connection failures) */
  http_status_code: number;

  /** Expected HTTP status code from configuration */
  expected_status: number;

  /** Result of text validation (null if not configured) */
  textValidationResult?: boolean;

  /** Result of header validation (null if not configured) */
  headerValidationResult?: Record<string, boolean>;

  /** Human-readable failure description (empty string if passed) */
  failure_reason: string;

  /** UUID linking to structured logs for traceability */
  correlation_id: string;
}

/**
 * Historical record stored in CSV format
 * Per data-model.md HistoricalRecord entity
 */
export interface HistoricalRecord {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Service name */
  service_name: string;

  /** Health status (PASS, DEGRADED, or FAIL) */
  status: 'PASS' | 'DEGRADED' | 'FAIL';

  /** Response latency in milliseconds */
  latency_ms: number;

  /** HTTP status code received */
  http_status_code: number;

  /** Failure description (empty string if passed) */
  failure_reason: string;

  /** UUID for log traceability */
  correlation_id: string;
}

/**
 * Service status for JSON API endpoint
 * Per data-model.md ServiceStatusAPI interface
 */
export interface ServiceStatusAPI {
  /** Service display name */
  name: string;

  /** Current health status */
  status: ServiceStatus;

  /** Response latency in milliseconds (null if PENDING) */
  latency_ms: number | null;

  /** Timestamp of last check (ISO 8601, null if PENDING) */
  last_check_time: string | null;

  /** Service tags (empty array if no tags) */
  tags: string[];

  /** HTTP status code (null if PENDING) */
  http_status_code: number | null;

  /** Failure reason (empty string if passed) */
  failure_reason: string;
}

/**
 * Complete JSON API response type
 * Array of service statuses
 */
export type StatusAPI = ServiceStatusAPI[];

/**
 * Health check summary statistics
 * Used for reporting and dashboard generation
 */
export interface HealthCheckSummary {
  /** Total number of services checked */
  totalServices: number;

  /** Number of services in PASS status */
  passCount: number;

  /** Number of services in DEGRADED status */
  degradedCount: number;

  /** Number of services in FAIL status */
  failCount: number;

  /** Number of services in PENDING status */
  pendingCount: number;

  /** Total duration of check cycle in milliseconds */
  totalDuration: number;

  /** Timestamp of summary generation */
  timestamp: Date;
}

/**
 * Error types for health check failures
 * Used for categorizing failure reasons
 */
export enum HealthCheckErrorType {
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  HTTP_STATUS = 'http_status',
  TEXT_VALIDATION = 'text_validation',
  HEADER_VALIDATION = 'header_validation',
  UNKNOWN = 'unknown',
}

/**
 * Structured error information for failed health checks
 */
export interface HealthCheckError {
  /** Error type category */
  type: HealthCheckErrorType;

  /** Error message */
  message: string;

  /** Error code (e.g., ETIMEDOUT, ECONNREFUSED) */
  code?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}
