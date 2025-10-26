/**
 * Unit tests for worker thread entry point
 * Tests the parentPort message handling code (lines 140-170 of worker.ts)
 *
 * These tests specifically target the worker thread entry point logic
 * that sets up message listeners and handles errors at the boundary.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HealthCheckConfig, HealthCheckResult } from '../../../src/types/health-check.ts';

// Create mock parentPort with necessary methods
const mockParentPort = {
  postMessage: vi.fn(),
  on: vi.fn(),
};

// Mock worker_threads with a truthy parentPort to trigger entry point code
vi.mock('node:worker_threads', () => ({
  parentPort: mockParentPort,
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

describe('Worker Thread Entry Point', () => {
  // Store the message handler for testing
  let messageHandler: ((message: WorkerMessage) => Promise<void>) | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the message handler
    messageHandler = undefined;

    // Capture the message handler when it's registered
    mockParentPort.on.mockImplementation(
      (event: string, handler: (msg: WorkerMessage) => Promise<void>) => {
        if (event === 'message') {
          messageHandler = handler;
        }
        return mockParentPort;
      }
    );

    // Force module reload to trigger the entry point setup
    vi.resetModules();

    // Import the worker module to trigger the entry point setup
    // This will execute the `if (parentPort)` block
    await import('../../../src/health-checks/worker.ts');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parentPort Message Handler Setup', () => {
    it('should register message event handler on parentPort', () => {
      // Assert - parentPort.on should have been called with 'message' event
      expect(mockParentPort.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(messageHandler).toBeDefined();
    });
  });

  describe('Successful Health Check Processing', () => {
    it('should process valid message and post successful result', async () => {
      // Arrange
      const { performHealthCheckWithRetry } = await import(
        '../../../src/health-checks/retry-logic.ts'
      );

      const config: HealthCheckConfig = {
        serviceName: 'entry-point-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'entry-point-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      const expectedResult: HealthCheckResult = {
        serviceName: 'entry-point-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'entry-point-id',
      };

      vi.mocked(performHealthCheckWithRetry).mockResolvedValue(expectedResult);

      // Act - Call the message handler
      await messageHandler!(message);

      // Assert - Verify postMessage was called with successful result
      expect(mockParentPort.postMessage).toHaveBeenCalledWith({
        type: 'health-check-result',
        result: expectedResult,
      });
    });
  });

  describe('Validation Error Handling in parentPort', () => {
    it('should catch invalid message type and post error result', async () => {
      // Arrange
      const invalidMessage = {
        type: 'invalid-type',
        config: {
          serviceName: 'validation-error-service',
          method: 'GET' as const,
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'validation-error-id',
        },
      } as unknown as WorkerMessage;

      // Act - Call the message handler with invalid message
      await messageHandler!(invalidMessage);

      // Assert - Verify error result was posted
      expect(mockParentPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health-check-result',
          result: expect.objectContaining({
            serviceName: 'validation-error-service',
            status: 'FAIL',
            failure_reason: 'Invalid worker message type',
          }),
          error: expect.objectContaining({
            message: 'Invalid worker message type',
            type: 'validation',
          }),
        })
      );
    });

    it('should catch missing config and post error result', async () => {
      // Arrange
      const invalidMessage = {
        type: 'health-check',
        // config is missing
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(invalidMessage);

      // Assert - serviceName should default to 'unknown'
      expect(mockParentPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health-check-result',
          result: expect.objectContaining({
            serviceName: 'unknown',
            status: 'FAIL',
            failure_reason: 'Missing config in worker message',
          }),
          error: expect.objectContaining({
            message: 'Missing config in worker message',
            type: 'validation',
          }),
        })
      );
    });

    it('should generate UUID correlation ID when missing in error handler', async () => {
      // Arrange
      const messageWithoutCorrelationId = {
        type: 'invalid-type',
        config: {
          serviceName: 'no-correlation-id',
          method: 'GET' as const,
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          // correlationId is missing
        },
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithoutCorrelationId);

      // Assert - Verify UUID was generated
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.correlation_id).toBeDefined();
      expect(result.result.correlation_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should use custom expected status in error handler', async () => {
      // Arrange
      const messageWithCustomStatus = {
        type: 'invalid-type',
        config: {
          serviceName: 'custom-status-test',
          method: 'POST' as const,
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 201, // Custom status
          correlationId: 'custom-status-id',
        },
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithCustomStatus);

      // Assert - expected_status should be 201
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.expected_status).toBe(201);
    });

    it('should default to GET method when method is missing in error handler', async () => {
      // Arrange
      const messageWithoutMethod = {
        type: 'invalid-type',
        config: {
          serviceName: 'no-method-test',
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'no-method-id',
          // method is missing
        },
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithoutMethod);

      // Assert - method should default to 'GET'
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.method).toBe('GET');
    });
  });

  describe('Execution Error Handling in parentPort', () => {
    it('should handle execution errors via processHealthCheck catch block', async () => {
      // Arrange
      const { performHealthCheckWithRetry } = await import(
        '../../../src/health-checks/retry-logic.ts'
      );

      const config: HealthCheckConfig = {
        serviceName: 'execution-error-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'execution-error-id',
      };

      const message: WorkerMessage = {
        type: 'health-check',
        config,
      };

      // Mock an execution error (not a validation error)
      const executionError = Object.assign(new Error('Network failure'), {
        code: 'ECONNREFUSED',
      });
      vi.mocked(performHealthCheckWithRetry).mockRejectedValue(executionError);

      // Act
      await messageHandler!(message);

      // Assert - Error should be handled by processHealthCheck, not the outer catch
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.type).toBe('health-check-result');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Network failure');
      expect(result.error?.code).toBe('ECONNREFUSED');
      expect(result.error?.type).toBe('network');
      expect(result.result.status).toBe('FAIL');
    });
  });

  describe('Edge Cases in parentPort Error Handler', () => {
    it('should handle null config gracefully', async () => {
      // Arrange
      const messageWithNullConfig = {
        type: 'health-check',
        config: null,
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithNullConfig);

      // Assert
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.serviceName).toBe('unknown');
      expect(result.result.status).toBe('FAIL');
    });

    it('should handle undefined config gracefully', async () => {
      // Arrange
      const messageWithUndefinedConfig = {
        type: 'health-check',
        config: undefined,
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithUndefinedConfig);

      // Assert
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.serviceName).toBe('unknown');
      expect(result.result.status).toBe('FAIL');
    });

    it('should handle config with undefined expectedStatus using nullish coalescing', async () => {
      // Arrange
      const messageWithUndefinedExpectedStatus = {
        type: 'invalid-type',
        config: {
          serviceName: 'undefined-status-test',
          method: 'GET' as const,
          url: 'https://example.com',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: undefined, // Explicitly undefined
          correlationId: 'undefined-status-id',
        },
      } as unknown as WorkerMessage;

      // Act
      await messageHandler!(messageWithUndefinedExpectedStatus);

      // Assert - Should default to 200
      const call = vi.mocked(mockParentPort.postMessage).mock.calls[0];
      const result = call![0] as WorkerResult;

      expect(result.result.expected_status).toBe(200);
    });
  });
});
