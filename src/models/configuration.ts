/**
 * Configuration models for the GOV.UK Status Monitor
 * Based on data-model.md specifications
 */

export interface GlobalSettings {
  check_interval?: number; // Default: 60 seconds
  warning_threshold?: number; // Default: 2 seconds
  timeout?: number; // Default: 5 seconds
  page_refresh?: number; // Default: 60 seconds
  max_retries?: number; // Default: 3
  worker_pool_size?: number; // Default: 0 (auto: 2x CPU cores)
  history_file?: string; // Default: "history.csv"
  output_dir?: string; // Default: "_site"
}

export interface ExpectedValidation {
  status: number; // Expected HTTP status code
  text?: string; // Expected substring in response body (first 100KB)
  headers?: Record<string, string>; // Expected response headers
}

export interface CustomHeader {
  name: string;
  value: string;
}

export interface ServiceDefinition {
  name: string; // Unique service name
  protocol: 'HTTP' | 'HTTPS';
  method: 'GET' | 'HEAD' | 'POST';
  resource: string; // Full URL
  tags?: string[]; // Category labels
  expected: ExpectedValidation;
  headers?: CustomHeader[]; // Custom HTTP headers
  payload?: Record<string, unknown>; // POST request body (JSON)
  interval?: number; // Override default check interval
  warning_threshold?: number; // Override default warning threshold
  timeout?: number; // Override default timeout
}

export interface Configuration {
  settings?: GlobalSettings;
  pings: ServiceDefinition[];
}

// Default values as constants
export const DEFAULT_SETTINGS: Required<GlobalSettings> = {
  check_interval: 60,
  warning_threshold: 2,
  timeout: 5,
  page_refresh: 60,
  max_retries: 3,
  worker_pool_size: 0,
  history_file: 'history.csv',
  output_dir: '_site',
};

/**
 * Merge user settings with defaults
 */
export function getEffectiveSettings(userSettings?: GlobalSettings): Required<GlobalSettings> {
  return {
    ...DEFAULT_SETTINGS,
    ...userSettings,
  };
}

/**
 * Get effective service configuration with global defaults
 */
export function getEffectiveServiceConfig(
  service: ServiceDefinition,
  globalSettings: Required<GlobalSettings>
): ServiceDefinition & {
  interval: number;
  warning_threshold: number;
  timeout: number;
} {
  return {
    ...service,
    interval: service.interval ?? globalSettings.check_interval,
    warning_threshold: service.warning_threshold ?? globalSettings.warning_threshold,
    timeout: service.timeout ?? globalSettings.timeout,
  };
}
