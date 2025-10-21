/**
 * Health Checker Service - Performs HTTP health checks using native fetch
 * Based on research.md specifications
 */

import { randomUUID } from 'crypto';
import type { ServiceDefinition } from '../models/configuration.js';
import type { HealthCheckResult } from '../models/health-check-result.js';
import { determineStatus, createFailureReason } from '../models/health-check-result.js';
import { createChildLogger } from '../lib/logger.js';

/**
 * Perform a single health check on a service
 * Uses native fetch with AbortSignal.timeout() per research.md
 */
export async function performHealthCheck(
  service: ServiceDefinition,
  effectiveTimeout: number,
  effectiveWarningThreshold: number
): Promise<HealthCheckResult> {
  const correlationId = randomUUID();
  const logger = createChildLogger(correlationId, {
    serviceName: service.name,
  });

  const startTime = Date.now();
  const timestamp = new Date();

  logger.info(
    {
      url: service.resource,
      method: service.method,
      timeout: effectiveTimeout,
    },
    'Starting health check'
  );

  try {
    // Build request options
    const requestHeaders: Record<string, string> = {};

    // Add custom headers if specified
    if (service.headers) {
      for (const header of service.headers) {
        requestHeaders[header.name] = header.value;
      }
    }

    // Add Content-Type for POST requests with payload
    if (service.method === 'POST' && service.payload) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    // Perform HTTP request with timeout
    const response = await fetch(service.resource, {
      method: service.method,
      headers: requestHeaders,
      body: service.method === 'POST' && service.payload ? JSON.stringify(service.payload) : undefined,
      signal: AbortSignal.timeout(effectiveTimeout * 1000), // Convert seconds to milliseconds
      redirect: 'manual', // Don't follow redirects for health checks
    });

    const latency_ms = Date.now() - startTime;

    // Check HTTP status code
    const statusMatches = response.status === service.expected.status;

    // Check response text validation (first 100KB per FR-014)
    let textValidationResult: boolean | undefined;
    if (service.expected.text) {
      const responseText = await response.text();
      const textToSearch = responseText.substring(0, 100 * 1024); // First 100KB
      textValidationResult = textToSearch.includes(service.expected.text);
    }

    // Check response headers validation (per FR-014a, FR-004a)
    let headerValidationResult: Record<string, boolean> | undefined;
    if (service.expected.headers) {
      headerValidationResult = {};
      for (const [headerName, expectedValue] of Object.entries(service.expected.headers)) {
        const actualValue = response.headers.get(headerName);
        // Case-insensitive header name matching, case-sensitive value matching
        headerValidationResult[headerName] = actualValue === expectedValue;
      }
    }

    // Determine if validation passed
    const validationPassed =
      statusMatches &&
      (textValidationResult === undefined || textValidationResult === true) &&
      (headerValidationResult === undefined ||
        Object.values(headerValidationResult).every((v) => v === true));

    // Determine status (PASS, DEGRADED, FAIL)
    const status = determineStatus(
      validationPassed,
      latency_ms,
      effectiveWarningThreshold,
      effectiveTimeout
    );

    const result: HealthCheckResult = {
      serviceName: service.name,
      timestamp,
      method: service.method,
      status,
      latency_ms,
      http_status_code: response.status,
      expected_status: service.expected.status,
      textValidationResult,
      headerValidationResult,
      failure_reason: createFailureReason(
        response.status,
        service.expected.status,
        service.expected.text
          ? { expected: service.expected.text, found: textValidationResult || false }
          : undefined,
        service.expected.headers
          ? { expected: service.expected.headers, results: headerValidationResult || {} }
          : undefined
      ),
      correlation_id: correlationId,
    };

    logger.info(
      {
        status: result.status,
        latency_ms: result.latency_ms,
        http_status_code: result.http_status_code,
      },
      'Health check completed'
    );

    return result;
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    let networkError = 'Unknown error';

    if (error instanceof Error) {
      // Handle timeout errors
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        networkError = 'Connection timeout';
      }
      // Handle network errors
      else if (error.message.includes('fetch')) {
        networkError = `Network error: ${error.message}`;
      } else {
        networkError = error.message;
      }

      logger.error(
        {
          err: error,
          latency_ms,
        },
        'Health check failed'
      );
    }

    const result: HealthCheckResult = {
      serviceName: service.name,
      timestamp,
      method: service.method,
      status: 'FAIL',
      latency_ms,
      http_status_code: 0, // 0 indicates connection failure
      expected_status: service.expected.status,
      failure_reason: networkError,
      correlation_id: correlationId,
    };

    return result;
  }
}
