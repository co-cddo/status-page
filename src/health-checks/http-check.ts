/**
 * HTTP health check implementation
 * T026: Implement HTTP health check logic
 *
 * Supports:
 * - GET, HEAD, POST methods
 * - Custom headers
 * - POST payloads
 * - AbortSignal.timeout() for timeouts
 * - Status code validation
 * - Response text validation (first 100KB, case-sensitive)
 * - Response header validation (case-insensitive name, case-sensitive value)
 * - Network error handling
 */

import { randomUUID } from 'node:crypto';
import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';
import { validateStatusCode, validateResponseText, validateResponseHeaders } from './validation.js';
import { getErrorMessage } from '../utils/error.js';
import { createLogger } from '../logging/logger.js';

const MAX_RESPONSE_TEXT_SIZE = 100 * 1024; // 100KB per FR-014
const logger = createLogger({ serviceName: 'health-check' });

/**
 * Performs an HTTP health check against a configured service
 * @param config Health check configuration
 * @returns Health check result with status, latency, and validation results
 */
export async function performHealthCheck(
  config: HealthCheckConfig
): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const timestamp = new Date();
  const correlationId = config.correlationId || randomUUID();
  const serviceName = config.serviceName || config.url;

  logger.info({
    correlationId,
    service: serviceName,
    method: config.method,
    url: config.url,
  }, 'Starting health check');

  try {
    // Prepare request options
    const headers: Record<string, string> = {};

    // Add custom headers from config
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }
    if (config.headers) {
      config.headers.forEach(h => {
        headers[h.name] = h.value;
      });
    }

    // Set Content-Type for POST requests with payload
    if (config.method === 'POST' && config.payload) {
      headers['Content-Type'] = 'application/json';
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      // Perform HTTP request
      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.method === 'POST' && config.payload
          ? JSON.stringify(config.payload)
          : undefined,
        signal: controller.signal,
        redirect: 'manual', // Don't follow redirects automatically (FR-004a)
      });

      clearTimeout(timeoutId);

      const endTime = performance.now();
      const latency_ms = Math.round(endTime - startTime);

      // Validate status code
      const statusValidation = validateStatusCode(response.status, config.expectedStatus);

      // Validate response text if configured
      let textValidation: { valid: boolean; error?: string } = { valid: true };
      if (config.expectedText) {
        const responseText = await getResponseText(response);
        textValidation = validateResponseText(responseText, config.expectedText);
      }

      // Validate response headers if configured
      let headersValidation: { valid: boolean; error?: string } = { valid: true };
      if (config.expectedHeaders) {
        headersValidation = validateResponseHeaders(
          response.headers,
          config.expectedHeaders
        );
      }

      // Determine overall status and failure reason
      const allValidationsPassed = statusValidation.valid && textValidation.valid && headersValidation.valid;
      let status: HealthCheckResult['status'];
      let failure_reason = '';

      if (!allValidationsPassed) {
        status = 'FAIL';
        // Collect all validation errors
        const errors: string[] = [];
        if (!statusValidation.valid && statusValidation.error) {
          errors.push(statusValidation.error);
        }
        if (!textValidation.valid && textValidation.error) {
          errors.push(textValidation.error);
        }
        if (!headersValidation.valid && headersValidation.error) {
          errors.push(headersValidation.error);
        }
        failure_reason = errors.join('; ');

        logger.error({
          correlationId,
          service: serviceName,
          status: 'FAIL',
          latency_ms,
          error: failure_reason,
        }, 'Health check failed validation');
      } else if (latency_ms > config.timeout) {
        // Should not happen since we aborted, but safety check
        status = 'FAIL';
        failure_reason = 'Timeout exceeded';

        logger.error({
          correlationId,
          service: serviceName,
          status: 'FAIL',
          latency_ms,
          error: failure_reason,
        }, 'Health check exceeded timeout');
      } else if (latency_ms > config.warningThreshold) {
        status = 'DEGRADED';

        logger.warn({
          correlationId,
          service: serviceName,
          status: 'DEGRADED',
          latency_ms,
          threshold: config.warningThreshold,
        }, 'Health check degraded (slow response)');
      } else {
        status = 'PASS';

        logger.info({
          correlationId,
          service: serviceName,
          status: 'PASS',
          latency_ms,
        }, 'Health check passed');
      }

      return {
        serviceName,
        timestamp,
        method: config.method,
        status,
        latency_ms,
        http_status_code: response.status,
        expected_status: typeof config.expectedStatus === 'number'
          ? config.expectedStatus
          : config.expectedStatus[0],
        textValidationResult: config.expectedText !== undefined ? textValidation.valid : undefined,
        headerValidationResult: config.expectedHeaders ?
          { validated: headersValidation.valid } : undefined,
        failure_reason,
        correlation_id: correlationId,
      };

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    const endTime = performance.now();
    const latency_ms = Math.round(endTime - startTime);

    // Handle network errors and timeouts
    const failure_reason = getErrorMessage(error);

    logger.error({
      correlationId,
      service: serviceName,
      status: 'FAIL',
      latency_ms,
      error: failure_reason,
      errorDetails: error instanceof Error ? { name: error.name, message: error.message } : undefined,
    }, 'Health check failed with network error');

    return {
      serviceName,
      timestamp,
      method: config.method,
      status: 'FAIL',
      latency_ms,
      http_status_code: 0, // Connection failure
      expected_status: typeof config.expectedStatus === 'number'
        ? config.expectedStatus
        : config.expectedStatus[0],
      failure_reason,
      correlation_id: correlationId,
    };
  }
}

/**
 * Reads response text up to MAX_RESPONSE_TEXT_SIZE (100KB)
 * Per FR-014: Search only first 100KB of response body
 */
async function getResponseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let text = '';
  let bytesRead = 0;

  try {
    while (bytesRead < MAX_RESPONSE_TEXT_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.length;
      const chunk = decoder.decode(value, { stream: true });
      text += chunk;

      if (bytesRead >= MAX_RESPONSE_TEXT_SIZE) {
        // Truncate to MAX_RESPONSE_TEXT_SIZE
        text = text.substring(0, MAX_RESPONSE_TEXT_SIZE);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return text;
}

// Error message extraction moved to ../utils/error.js for reuse across modules
