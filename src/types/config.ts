/**
 * TypeScript type definitions for config.yaml structure
 * Based on data-model.md and spec.md FR-001 through FR-007
 */

/**
 * Global settings for the health monitor
 * All settings are optional with sensible defaults
 */
export interface GlobalSettings {
  /** Default interval between health checks in seconds (default: 60) */
  check_interval?: number;

  /** Latency threshold for DEGRADED state in seconds (default: 2) */
  warning_threshold?: number;

  /** HTTP timeout threshold for FAILED state in seconds (default: 5) */
  timeout?: number;

  /** Browser auto-refresh interval in seconds (default: 60) */
  page_refresh?: number;

  /** Maximum retry attempts for failed checks (default: 3) */
  max_retries?: number;

  /** Worker pool size for concurrent health checks (0 = auto: 2x CPU cores) */
  worker_pool_size?: number;

  /** CSV file path for historical data (default: "history.csv") */
  history_file?: string;

  /** Output directory for generated HTML/JSON (default: "./output") */
  output_dir?: string;
}

/**
 * Expected validation criteria for health check responses
 * Per FR-002, FR-002a, FR-003, FR-004a
 */
export interface ExpectedValidation {
  /** Expected HTTP status code (required) */
  status: number;

  /** Optional substring to search for in response body (case-sensitive, first 100KB) */
  text?: string;

  /** Optional expected response headers (case-insensitive header names, case-sensitive values) */
  headers?: Record<string, string>;
}

/**
 * Custom HTTP header for health check requests
 */
export interface CustomHeader {
  /** Header name */
  name: string;

  /** Header value */
  value: string;
}

/**
 * Service/Ping definition for monitoring
 * Per data-model.md Service/Ping entity
 */
export interface ServiceDefinition {
  /** Unique service name (max 100 chars, ASCII) */
  name: string;

  /** Protocol to use */
  protocol: 'HTTP' | 'HTTPS';

  /** HTTP method */
  method: 'GET' | 'HEAD' | 'POST';

  /** Full URL of the endpoint to check */
  resource: string;

  /** Optional category tags for visual identification */
  tags?: string[];

  /** Validation criteria for determining health */
  expected: ExpectedValidation;

  /** Optional custom HTTP headers for requests */
  headers?: CustomHeader[];

  /** Optional POST request body (JSON format, only valid when method=POST) */
  payload?: Record<string, unknown>;

  /** Override default check interval in seconds */
  interval?: number;

  /** Override default warning threshold in seconds */
  warning_threshold?: number;

  /** Override default timeout in seconds */
  timeout?: number;
}

/**
 * Root configuration object loaded from config.yaml
 * Per data-model.md Configuration entity
 */
export interface Configuration {
  /** Global settings (optional) */
  settings?: GlobalSettings;

  /** Array of service definitions to monitor (required, minimum 1) */
  pings: ServiceDefinition[];
}

/**
 * Runtime service state (extends ServiceDefinition with runtime properties)
 * Used internally by the orchestrator
 */
export interface Service extends ServiceDefinition {
  /** Current health status (runtime) */
  currentStatus: 'PENDING' | 'PASS' | 'DEGRADED' | 'FAIL';

  /** Timestamp of most recent health check */
  lastCheckTime: Date | null;

  /** Response latency in milliseconds from most recent check */
  lastLatency: number | null;

  /** Count of consecutive check failures (for HTML display threshold) */
  consecutiveFailures: number;
}

/**
 * Effective settings after merging global defaults with per-service overrides
 * Used to resolve configuration hierarchy
 */
export interface EffectiveSettings {
  check_interval: number;
  warning_threshold: number;
  timeout: number;
  page_refresh: number;
  max_retries: number;
  worker_pool_size: number;
  history_file: string;
  output_dir: string;
}

/**
 * Default values for global settings
 * Per spec.md Configuration Structure
 */
export const DEFAULT_SETTINGS: EffectiveSettings = {
  check_interval: 60,
  warning_threshold: 2,
  timeout: 5,
  page_refresh: 60,
  max_retries: 3,
  worker_pool_size: 0, // 0 = auto (2x CPU cores)
  history_file: 'history.csv',
  output_dir: './output',
};
