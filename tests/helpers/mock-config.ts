/**
 * Test helper for creating mock HealthCheckConfig objects
 * Provides defaults for all required properties to avoid TS2739 errors
 */

import { randomUUID } from 'node:crypto';
import type { HealthCheckConfig } from '../../src/types/health-check.js';

export interface MockConfigOptions {
  url: string;
  method?: 'GET' | 'HEAD' | 'POST';
  timeout?: number;
  expectedStatus?: number | number[];
  expectedText?: string;
  expectedHeaders?: Record<string, string>;
  headers?: Array<{ name: string; value: string }>;
  payload?: Record<string, unknown>;
  serviceName?: string;
  warningThreshold?: number;
  correlationId?: string;
}

/**
 * Creates a complete HealthCheckConfig with all required properties
 */
export function createMockConfig(options: MockConfigOptions): HealthCheckConfig {
  const config: HealthCheckConfig = {
    url: options.url,
    method: options.method || 'GET',
    timeout: options.timeout !== undefined ? options.timeout : 5000,
    expectedStatus: options.expectedStatus !== undefined ? options.expectedStatus : [200],
  };

  // Only add optional properties if they are defined (exactOptionalPropertyTypes: true)
  if (options.expectedText !== undefined) {
    config.expectedText = options.expectedText;
  }
  if (options.expectedHeaders !== undefined) {
    config.expectedHeaders = options.expectedHeaders;
  }
  if (options.headers !== undefined) {
    config.headers = options.headers;
  }
  if (options.payload !== undefined) {
    config.payload = options.payload;
  }
  if (options.serviceName !== undefined) {
    config.serviceName = options.serviceName;
  } else {
    config.serviceName = 'Test Service';
  }
  if (options.warningThreshold !== undefined) {
    config.warningThreshold = options.warningThreshold;
  } else {
    config.warningThreshold = 2000;
  }
  if (options.correlationId !== undefined) {
    config.correlationId = options.correlationId;
  } else {
    config.correlationId = randomUUID();
  }

  return config;
}
