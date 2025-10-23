/**
 * Health check worker thread implementation
 * T029: Implement health check worker
 *
 * Worker responsibilities:
 * - Receive WorkerMessage via postMessage
 * - Execute health check with retry logic
 * - Determine status (FAIL/DEGRADED/PASS)
 * - Emit Prometheus metrics
 * - Return WorkerResult with correlation ID
 * - Handle errors with structured error objects
 */

import { parentPort } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';
import { performHealthCheck } from './http-check.js';
import { performHealthCheckWithRetry } from './retry-logic.js';
import { recordHealthCheckResult, incrementHealthCheckCounter } from '../metrics/index.js';

export interface WorkerMessage {
  type: 'health-check';
  config: HealthCheckConfig;
}

export interface WorkerResult {
  type: 'health-check-result';
  result: HealthCheckResult;
  error?: {
    message: string;
    code?: string;
    type: string;
  };
}

/**
 * Determines error type based on error code
 * @param code Error code (e.g., ECONNREFUSED, ETIMEDOUT)
 * @returns Error type classification
 */
function getErrorType(code?: string): string {
  if (!code) return 'unknown';

  if (code.includes('CONN') || code.includes('ENOTFOUND') || code.includes('ENETUNREACH')) {
    return 'network';
  }

  if (code.includes('TIMED') || code.includes('TIMEOUT')) {
    return 'timeout';
  }

  if (code.includes('CERT') || code.includes('SSL') || code.includes('TLS')) {
    return 'ssl';
  }

  return 'unknown';
}

/**
 * Processes a health check message from the worker pool
 * @param message Worker message containing health check config
 * @returns Worker result with health check result or error
 */
export async function processHealthCheck(message: WorkerMessage): Promise<WorkerResult> {
  // Validate message type (throw validation errors, don't catch them)
  if (message.type !== 'health-check') {
    throw new Error('Invalid worker message type');
  }

  // Validate config presence (throw validation errors, don't catch them)
  if (!message.config) {
    throw new Error('Missing config in worker message');
  }

  const config = message.config;

  try {
    // Execute health check with retry logic
    // Pass performHealthCheck function to retry logic
    const result: HealthCheckResult = await performHealthCheckWithRetry(
      config,
      performHealthCheck
    );

    // Emit Prometheus metrics
    recordHealthCheckResult(result);
    incrementHealthCheckCounter(result.status, result.serviceName);

    // Return successful result
    return {
      type: 'health-check-result',
      result,
    };

  } catch (error) {
    // Handle unexpected errors during health check execution with structured error objects
    const err = error as Error & { code?: string };

    // Create error result
    const errorType = getErrorType(err.code);

    // Create FAIL result for the error case
    const failResult: HealthCheckResult = {
      serviceName: config.serviceName || config.url,
      timestamp: new Date(),
      method: config.method,
      status: 'FAIL',
      latency_ms: 0,
      http_status_code: 0,
      expected_status: typeof config.expectedStatus === 'number'
        ? config.expectedStatus
        : (config.expectedStatus[0] ?? 200),
      failure_reason: err.message,
      correlation_id: config.correlationId || randomUUID(),
    };

    // CRITICAL: Emit Prometheus metrics for error cases too
    // This ensures network failures, timeouts, and other exceptions are tracked
    recordHealthCheckResult(failResult);

    // Return error result for health check execution errors
    // Note: We still return a WorkerResult but with an error field
    const errorResult: WorkerResult = {
      type: 'health-check-result',
      result: failResult,
      error: {
        message: err.message,
        type: errorType,
      },
    };

    // Add code only if it exists (exactOptionalPropertyTypes compliance)
    if (err.code) {
      errorResult.error!.code = err.code;
    }

    return errorResult;
  }
}

/**
 * Worker thread entry point
 * When this file is executed as a worker thread, set up message listener
 */
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      const result = await processHealthCheck(message);
      parentPort!.postMessage(result);
    } catch (error) {
      // Validation errors or critical failures
      const err = error as Error;
      // Handle expectedStatus being number or array
      const expectedStatus = message.config?.expectedStatus;
      const expectedStatusValue = typeof expectedStatus === 'number'
        ? expectedStatus
        : Array.isArray(expectedStatus) && expectedStatus.length > 0 && expectedStatus[0] !== undefined
        ? expectedStatus[0]
        : 200;

      const errorResult: WorkerResult = {
        type: 'health-check-result',
        result: {
          serviceName: message.config?.serviceName || 'unknown',
          timestamp: new Date(),
          method: message.config?.method || 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: expectedStatusValue,
          failure_reason: err.message,
          correlation_id: message.config?.correlationId || randomUUID(),
        },
        error: {
          message: err.message,
          type: 'validation',
        },
      };
      parentPort!.postMessage(errorResult);
    }
  });
}
