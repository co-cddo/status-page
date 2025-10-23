/**
 * Unit tests for health check worker thread
 * Tests worker message handling, health check execution with retry, status determination, metrics emission
 *
 * Per tasks.md T029a:
 * - Test worker thread receives WorkerMessage via postMessage
 * - Test worker executes http-check with retry-logic
 * - Test status determination (FAIL/DEGRADED/PASS)
 * - Test Prometheus metrics emission
 * - Test WorkerResult return with correlation ID
 * - Test worker error handling and structured errors
 *
 * Tests MUST fail before T029 implementation (TDD principle)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HealthCheckConfig, HealthCheckResult } from '../../../src/types/health-check.ts';
import { processHealthCheck } from '../../../src/health-checks/worker.ts';

// Mock worker_threads module
vi.mock('node:worker_threads', () => ({
  parentPort: {
    postMessage: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock http-check module
vi.mock('../../../src/health-checks/http-check.js', () => ({
  performHealthCheck: vi.fn(),
}));

// Mock retry-logic module
vi.mock('../../../src/health-checks/retry-logic.js', () => ({
  performHealthCheckWithRetry: vi.fn(),
}));

// Mock metrics module
vi.mock('../../../src/metrics/index.js', () => ({
  recordHealthCheckResult: vi.fn(),
  incrementHealthCheckCounter: vi.fn(),
}));

import { performHealthCheckWithRetry } from '../../../src/health-checks/retry-logic.ts';
import { recordHealthCheckResult, incrementHealthCheckCounter } from '../../../src/metrics/index.ts';

/**
 * Worker message interface for inter-thread communication
 */
interface WorkerMessage {
  type: 'health-check';
  config: HealthCheckConfig;
}

/**
 * Worker result interface for response
 */
interface WorkerResult {
  type: 'health-check-result';
  result: HealthCheckResult;
  error?: {
    message: string;
    code?: string;
    type: string;
  };
}

describe('Health Check Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Worker Message Handling', () => {
    it('should receive and process WorkerMessage via postMessage', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'test-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'test-correlation-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-correlation-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.type).toBe('health-check-result');
      expect(result.result).toEqual(expectedResult);
      expect(result.error).toBeUndefined();
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(config, expect.any(Function));
    });

    it('should handle invalid message type', async () => {
      // Arrange
      const invalidMessage = {
        type: 'invalid-type',
        config: {},
      } as unknown as WorkerMessage;

      // Act & Assert
      await expect(processHealthCheck(invalidMessage)).rejects.toThrow('Invalid worker message type');
    });

    it('should handle missing config in message', async () => {
      // Arrange
      const invalidMessage = {
        type: 'health-check',
      } as unknown as WorkerMessage;

      // Act & Assert
      await expect(processHealthCheck(invalidMessage)).rejects.toThrow('Missing config in worker message');
    });

    it('should preserve correlation ID from message config', async () => {
      // Arrange
      const correlationId = 'preserved-correlation-id';
      const config: HealthCheckConfig = {
        serviceName: 'test-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId,
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: correlationId,
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.correlation_id).toBe(correlationId);
    });
  });

  describe('Health Check Execution with Retry Logic', () => {
    it('should execute performHealthCheckWithRetry for GET requests', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'get-service',
        method: 'GET',
        url: 'https://example.com/health',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'get-correlation-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'get-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 250,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'get-correlation-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(config, expect.any(Function));
      expect(performHealthCheckWithRetry).toHaveBeenCalledTimes(1);
    });

    it('should execute performHealthCheckWithRetry for HEAD requests', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'head-service',
        method: 'HEAD',
        url: 'https://example.com/health',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'head-correlation-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'head-service',
        timestamp: new Date(),
        method: 'HEAD',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'head-correlation-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(config, expect.any(Function));
    });

    it('should execute performHealthCheckWithRetry for POST requests with payload', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'post-service',
        method: 'POST',
        url: 'https://example.com/health',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 201,
        payload: { key: 'value' },
        correlationId: 'post-correlation-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'post-service',
        timestamp: new Date(),
        method: 'POST',
        status: 'PASS',
        latency_ms: 300,
        http_status_code: 201,
        expected_status: 201,
        failure_reason: '',
        correlation_id: 'post-correlation-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(config, expect.any(Function));
    });

    it('should pass performHealthCheck function to retry logic', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'test-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'test-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      const retryCall = vi.mocked(performHealthCheckWithRetry).mock.calls[0];
      expect(retryCall?.[0]).toEqual(config);
      expect(typeof retryCall?.[1]).toBe('function');
    });

    it('should handle retry exhaustion with network errors', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'retry-exhausted',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'retry-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const failedResult: HealthCheckResult = {
        serviceName: 'retry-exhausted',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error: ECONNREFUSED - Maximum retry attempts (3) exceeded',
        correlation_id: 'retry-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(failedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('FAIL');
      expect(result.result.failure_reason).toContain('Maximum retry attempts');
    });
  });

  describe('Status Determination Logic', () => {
    it('should determine FAIL status when validation fails', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'validation-fail',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fail-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const failedResult: HealthCheckResult = {
        serviceName: 'validation-fail',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 150,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'HTTP status validation failed: expected 200, received 500',
        correlation_id: 'fail-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(failedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('FAIL');
      expect(result.result.failure_reason).toContain('validation failed');
    });

    it('should determine FAIL status when timeout is exceeded', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'timeout-fail',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'timeout-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const failedResult: HealthCheckResult = {
        serviceName: 'timeout-fail',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 5001,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Timeout: Request exceeded 5000ms timeout',
        correlation_id: 'timeout-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(failedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('FAIL');
      expect(result.result.latency_ms).toBeGreaterThan(config.timeout);
    });

    it('should determine DEGRADED status when latency exceeds warning threshold but passes validation', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'degraded-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'degraded-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const degradedResult: HealthCheckResult = {
        serviceName: 'degraded-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'DEGRADED',
        latency_ms: 2500,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'degraded-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(degradedResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('DEGRADED');
      expect(result.result.latency_ms).toBeGreaterThan(config.warningThreshold!);
      expect(result.result.latency_ms).toBeLessThan(config.timeout);
      expect(result.result.http_status_code).toBe(200);
      expect(result.result.failure_reason).toBe('');
    });

    it('should determine DEGRADED status at exact warning threshold boundary', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'boundary-degraded',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'boundary-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const boundaryResult: HealthCheckResult = {
        serviceName: 'boundary-degraded',
        timestamp: new Date(),
        method: 'GET',
        status: 'DEGRADED',
        latency_ms: 2001,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'boundary-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(boundaryResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('DEGRADED');
      expect(result.result.latency_ms).toBe(2001);
    });

    it('should determine PASS status when validation succeeds and latency is within warning threshold', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'pass-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'pass-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const passResult: HealthCheckResult = {
        serviceName: 'pass-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'pass-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(passResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('PASS');
      expect(result.result.latency_ms).toBeLessThanOrEqual(config.warningThreshold!);
      expect(result.result.http_status_code).toBe(200);
      expect(result.result.failure_reason).toBe('');
    });

    it('should determine PASS status at exact warning threshold boundary (inclusive)', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'boundary-pass',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'boundary-pass-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const boundaryResult: HealthCheckResult = {
        serviceName: 'boundary-pass',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 2000,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'boundary-pass-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(boundaryResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('PASS');
      expect(result.result.latency_ms).toBe(2000);
    });

    it('should handle very fast responses (< 10ms)', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'fast-service',
        method: 'HEAD',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fast-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const fastResult: HealthCheckResult = {
        serviceName: 'fast-service',
        timestamp: new Date(),
        method: 'HEAD',
        status: 'PASS',
        latency_ms: 5,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'fast-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(fastResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.status).toBe('PASS');
      expect(result.result.latency_ms).toBeLessThan(10);
    });
  });

  describe('Prometheus Metrics Emission', () => {
    it('should emit metrics for PASS status', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'metrics-pass',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'metrics-pass-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const passResult: HealthCheckResult = {
        serviceName: 'metrics-pass',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'metrics-pass-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(passResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(recordHealthCheckResult).toHaveBeenCalledWith(passResult);
      expect(incrementHealthCheckCounter).toHaveBeenCalledWith('PASS', 'metrics-pass');
    });

    it('should emit metrics for DEGRADED status', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'metrics-degraded',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'metrics-degraded-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const degradedResult: HealthCheckResult = {
        serviceName: 'metrics-degraded',
        timestamp: new Date(),
        method: 'GET',
        status: 'DEGRADED',
        latency_ms: 2500,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'metrics-degraded-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(degradedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(recordHealthCheckResult).toHaveBeenCalledWith(degradedResult);
      expect(incrementHealthCheckCounter).toHaveBeenCalledWith('DEGRADED', 'metrics-degraded');
    });

    it('should emit metrics for FAIL status', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'metrics-fail',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'metrics-fail-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const failedResult: HealthCheckResult = {
        serviceName: 'metrics-fail',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'HTTP status validation failed',
        correlation_id: 'metrics-fail-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(failedResult);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(recordHealthCheckResult).toHaveBeenCalledWith(failedResult);
      expect(incrementHealthCheckCounter).toHaveBeenCalledWith('FAIL', 'metrics-fail');
    });

    it('should emit metrics with correct latency values', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'metrics-latency',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'metrics-latency-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'metrics-latency',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 1250,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'metrics-latency-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      await processHealthCheck(message);

      // Assert
      const recordCall = vi.mocked(recordHealthCheckResult).mock.calls[0];
      expect(recordCall?.[0].latency_ms).toBe(1250);
    });

    it('should emit metrics for all HTTP methods', async () => {
      // Arrange
      const methods: Array<'GET' | 'HEAD' | 'POST'> = ['GET', 'HEAD', 'POST'];

      for (const method of methods) {
        const config: HealthCheckConfig = {
          serviceName: `metrics-${method.toLowerCase()}`,
          method,
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: `metrics-${method.toLowerCase()}-id`,
        };

        const message: WorkerMessage = {
          type: 'health-check',
          config,
        };

        const result: HealthCheckResult = {
          serviceName: `metrics-${method.toLowerCase()}`,
          timestamp: new Date(),
          method,
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: `metrics-${method.toLowerCase()}-id`,
        };

        vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

        // Act
        await processHealthCheck(message);

        // Assert
        expect(recordHealthCheckResult).toHaveBeenCalledWith(
          expect.objectContaining({ method })
        );
      }
    });
  });

  describe('Correlation ID Tracking', () => {
    it('should preserve correlation ID throughout worker execution', async () => {
      // Arrange
      const correlationId = 'preserved-correlation-id';
      const config: HealthCheckConfig = {
        serviceName: 'correlation-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId,
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'correlation-test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: correlationId,
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      const workerResult: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(workerResult.result.correlation_id).toBe(correlationId);
      expect(recordHealthCheckResult).toHaveBeenCalledWith(
        expect.objectContaining({ correlation_id: correlationId })
      );
    });

    it('should include correlation ID in metrics emission', async () => {
      // Arrange
      const correlationId = 'metrics-correlation-id';
      const config: HealthCheckConfig = {
        serviceName: 'metrics-correlation',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId,
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'metrics-correlation',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: correlationId,
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      await processHealthCheck(message);

      // Assert
      const recordCall = vi.mocked(recordHealthCheckResult).mock.calls[0];
      expect(recordCall?.[0].correlation_id).toBe(correlationId);
    });

    it('should include correlation ID in error responses', async () => {
      // Arrange
      const correlationId = 'error-correlation-id';
      const config: HealthCheckConfig = {
        serviceName: 'error-correlation',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId,
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(
        new Error('Unexpected worker error')
      );

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unexpected worker error');
      // Correlation ID should be in result even for errors
      expect(result.result?.correlation_id || correlationId).toBe(correlationId);
    });
  });

  describe('Worker Error Handling', () => {
    it('should handle unexpected errors during health check execution', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'error-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const unexpectedError = new Error('Unexpected worker error');
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(unexpectedError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.type).toBe('health-check-result');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Unexpected worker error');
      expect(result.error?.type).toBe('unknown');
    });

    it('should handle network errors with structured error', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'network-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'network-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const networkError = Object.assign(new Error('ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      });
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(networkError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ECONNREFUSED');
      expect(result.error?.type).toBe('network');
    });

    it('should handle timeout errors with structured error', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'timeout-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'timeout-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const timeoutError = Object.assign(new Error('ETIMEDOUT'), {
        code: 'ETIMEDOUT',
      });
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(timeoutError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ETIMEDOUT');
      expect(result.error?.type).toBe('timeout');
    });

    it('should handle SSL/TLS errors with structured error', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'ssl-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'ssl-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const sslError = Object.assign(new Error('CERT_HAS_EXPIRED'), {
        code: 'CERT_HAS_EXPIRED',
      });
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(sslError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('CERT_HAS_EXPIRED');
      expect(result.error?.type).toBe('ssl');
    });

    it('should include error code in structured error when available', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'coded-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'coded-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const codedError = Object.assign(new Error('Coded error'), {
        code: 'CUSTOM_ERROR_CODE',
      });
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(codedError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error?.code).toBe('CUSTOM_ERROR_CODE');
    });

    it('should handle errors without error code', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'no-code-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'no-code-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const noCodeError = new Error('Error without code');
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(noCodeError);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.error?.code).toBeUndefined();
      expect(result.error?.message).toBe('Error without code');
    });
  });

  describe('Worker Result Return', () => {
    it('should return WorkerResult with type health-check-result', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'result-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'result-test-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const healthCheckResult: HealthCheckResult = {
        serviceName: 'result-test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'result-test-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(healthCheckResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.type).toBe('health-check-result');
      expect(result.result).toEqual(healthCheckResult);
    });

    it('should return complete HealthCheckResult with all required fields', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'complete-result',
        method: 'POST',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 201,
        correlationId: 'complete-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const timestamp = new Date();
      const healthCheckResult: HealthCheckResult = {
        serviceName: 'complete-result',
        timestamp,
        method: 'POST',
        status: 'PASS',
        latency_ms: 250,
        http_status_code: 201,
        expected_status: 201,
        failure_reason: '',
        correlation_id: 'complete-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(healthCheckResult);

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.result.serviceName).toBe('complete-result');
      expect(result.result.timestamp).toEqual(timestamp);
      expect(result.result.method).toBe('POST');
      expect(result.result.status).toBe('PASS');
      expect(result.result.latency_ms).toBe(250);
      expect(result.result.http_status_code).toBe(201);
      expect(result.result.expected_status).toBe(201);
      expect(result.result.failure_reason).toBe('');
      expect(result.result.correlation_id).toBe('complete-id');
    });

    it('should return result with error field when worker error occurs', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'error-result',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'error-result-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(
        new Error('Worker execution error')
      );

      // Act
      const result: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(result.type).toBe('health-check-result');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Worker execution error');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero latency (extremely fast response)', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'zero-latency',
        method: 'HEAD',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'zero-latency-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'zero-latency',
        timestamp: new Date(),
        method: 'HEAD',
        status: 'PASS',
        latency_ms: 0,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'zero-latency-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      const workerResult: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(workerResult.result.status).toBe('PASS');
      expect(workerResult.result.latency_ms).toBe(0);
    });

    it('should handle service name with special characters', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'Service-Name_With.Special@Chars#123',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'special-chars-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'Service-Name_With.Special@Chars#123',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'special-chars-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      const workerResult: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(workerResult.result.serviceName).toBe('Service-Name_With.Special@Chars#123');
    });

    it('should handle very large latency values (near timeout)', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'large-latency',
        method: 'GET',
        url: 'https://example.com',
        timeout: 10000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'large-latency-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'large-latency',
        timestamp: new Date(),
        method: 'GET',
        status: 'DEGRADED',
        latency_ms: 9999,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'large-latency-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      const workerResult: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(workerResult.result.status).toBe('DEGRADED');
      expect(workerResult.result.latency_ms).toBe(9999);
    });

    it('should handle POST requests with large payload', async () => {
      // Arrange
      const largePayload = {
        data: 'x'.repeat(10000),
        nested: {
          field1: 'value1',
          field2: 'value2',
        },
      };

      const config: HealthCheckConfig = {
        serviceName: 'large-payload',
        method: 'POST',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 201,
        payload: largePayload,
        correlationId: 'large-payload-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'large-payload',
        timestamp: new Date(),
        method: 'POST',
        status: 'PASS',
        latency_ms: 500,
        http_status_code: 201,
        expected_status: 201,
        failure_reason: '',
        correlation_id: 'large-payload-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      const workerResult: WorkerResult = await processHealthCheck(message);

      // Assert
      expect(workerResult.result.status).toBe('PASS');
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ payload: largePayload }),
        expect.any(Function)
      );
    });

    it('should handle custom headers in config', async () => {
      // Arrange
      const config: HealthCheckConfig = {
        serviceName: 'custom-headers',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        headers: [
          { name: 'Authorization', value: 'Bearer token123' },
          { name: 'X-Custom-Header', value: 'custom-value' },
        ],
        correlationId: 'custom-headers-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const result: HealthCheckResult = {
        serviceName: 'custom-headers',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'custom-headers-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(result);

      // Act
      await processHealthCheck(message);

      // Assert
      expect(performHealthCheckWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: [
            { name: 'Authorization', value: 'Bearer token123' },
            { name: 'X-Custom-Header', value: 'custom-value' },
          ],
        }),
        expect.any(Function)
      );
    });
  });
});
