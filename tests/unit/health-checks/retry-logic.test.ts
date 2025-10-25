/**
 * Unit test for retry logic (User Story 1 - Phase 4A)
 * Per T028a: Test retry for network errors only (connection refused, DNS failure, timeout),
 * verify max 3 immediate retries (no delays, no exponential backoff),
 * verify retries don't count toward consecutive failure threshold,
 * verify NO retry for status/text/header validation failures,
 * test retry exhaustion (all 3 retries fail),
 * verify final result after retries
 *
 * This test MUST fail before T028 implementation (TDD requirement)
 * Per FR-017b: Retry network errors only, not validation failures
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  performHealthCheckWithRetry,
  shouldRetry,
  type RetryableError,
} from '../../../src/health-checks/retry-logic.ts';
import type { HealthCheckConfig, HealthCheckResult } from '../../../src/types/health-check.ts';

// Extended type for test purposes to include error details
interface HealthCheckResultWithError extends HealthCheckResult {
  error?: {
    type: string;
    code: string;
    message: string;
  };
}

describe('shouldRetry (T028a - TDD Phase)', () => {
  describe('Network Errors (Should Retry)', () => {
    test('should retry on connection refused errors', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should retry on DNS failure errors', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ENOTFOUND',
        message: 'DNS lookup failed',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should retry on timeout errors', () => {
      const error: RetryableError = {
        type: 'timeout',
        code: 'ETIMEDOUT',
        message: 'Request timeout',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should retry on network unreachable errors', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ENETUNREACH',
        message: 'Network is unreachable',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should retry on connection reset errors', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ECONNRESET',
        message: 'Connection reset by peer',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should retry on connection aborted errors', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ECONNABORTED',
        message: 'Connection aborted',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });
  });

  describe('Validation Errors (Should NOT Retry - FR-017b)', () => {
    test('should NOT retry on status code validation failures', () => {
      const error: RetryableError = {
        type: 'validation',
        code: 'INVALID_STATUS',
        message: 'Expected status 200, got 404',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });

    test('should NOT retry on text validation failures', () => {
      const error: RetryableError = {
        type: 'validation',
        code: 'TEXT_NOT_FOUND',
        message: 'Expected text not found in response',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });

    test('should NOT retry on header validation failures', () => {
      const error: RetryableError = {
        type: 'validation',
        code: 'INVALID_HEADER',
        message: 'Expected header Location not found',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });

    test('should NOT retry on HTTP 4xx client errors', () => {
      const error: RetryableError = {
        type: 'http',
        code: 'HTTP_404',
        message: 'Not Found',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });

    test('should NOT retry on HTTP 5xx server errors', () => {
      const error: RetryableError = {
        type: 'http',
        code: 'HTTP_500',
        message: 'Internal Server Error',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });
  });

  describe('SSL/TLS Errors', () => {
    test('should retry on SSL handshake timeout', () => {
      const error: RetryableError = {
        type: 'network',
        code: 'ETIMEDOUT',
        message: 'SSL handshake timeout',
      };

      const result = shouldRetry(error);

      expect(result).toBe(true);
    });

    test('should NOT retry on certificate validation failures', () => {
      const error: RetryableError = {
        type: 'ssl',
        code: 'CERT_HAS_EXPIRED',
        message: 'Certificate has expired',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });

    test('should NOT retry on self-signed certificate errors', () => {
      const error: RetryableError = {
        type: 'ssl',
        code: 'SELF_SIGNED_CERT_IN_CHAIN',
        message: 'Self-signed certificate in chain',
      };

      const result = shouldRetry(error);

      expect(result).toBe(false);
    });
  });
});

describe('performHealthCheckWithRetry (T028a - TDD Phase)', () => {
  let mockHealthCheck: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHealthCheck = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Max 3 Immediate Retries', () => {
    test('should perform max 3 retries for network errors', async () => {
      const config: HealthCheckConfig = {
        url: 'https://unreachable.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Connection refused',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
          message: 'Connection refused',
        },
      } as HealthCheckResult;

      // Mock health check to always fail with network error
      mockHealthCheck.mockResolvedValue(networkError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Should be called 4 times total: 1 initial + 3 retries
      expect(mockHealthCheck).toHaveBeenCalledTimes(4);
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('Connection refused');
    });

    test('should stop retrying after successful response', async () => {
      const config: HealthCheckConfig = {
        url: 'https://intermittent.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Connection refused',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      const successResult: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      // Fail twice, then succeed
      mockHealthCheck
        .mockResolvedValueOnce(networkError)
        .mockResolvedValueOnce(networkError)
        .mockResolvedValueOnce(successResult);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Should stop after 3rd call (2 failures + 1 success)
      expect(mockHealthCheck).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
    });

    test('should return final result after all retries exhausted', async () => {
      const config: HealthCheckConfig = {
        url: 'https://always-failing.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Connection timeout',
        correlation_id: 'test-id',
        error: {
          type: 'timeout',
          code: 'ETIMEDOUT',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(networkError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Should try 4 times total
      expect(mockHealthCheck).toHaveBeenCalledTimes(4);
      expect(result).toEqual(networkError);
    });
  });

  describe('Immediate Retries (No Delays)', () => {
    test('should perform retries immediately without delays', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ENETUNREACH',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(networkError);

      const startTime = Date.now();
      await performHealthCheckWithRetry(config, mockHealthCheck);
      const duration = Date.now() - startTime;

      // Should complete quickly (no exponential backoff)
      // Allow generous 2000ms tolerance for test execution overhead
      expect(duration).toBeLessThan(2000);
      expect(mockHealthCheck).toHaveBeenCalledTimes(4);
    });

    test('should NOT use exponential backoff', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(networkError);

      const callTimes: number[] = [];
      mockHealthCheck.mockImplementation(async () => {
        callTimes.push(Date.now());
        return networkError;
      });

      await performHealthCheckWithRetry(config, mockHealthCheck);

      // Verify retries are immediate (no increasing delays)
      expect(callTimes.length).toBe(4);

      // Check delays between retries are consistent and minimal
      for (let i = 1; i < callTimes.length; i++) {
        const delay = callTimes[i]! - callTimes[i - 1]!;
        expect(delay).toBeLessThan(100); // Immediate, no backoff
      }
    });
  });

  describe('No Retry for Validation Failures (FR-017b)', () => {
    test('should NOT retry on status code validation failure', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com/not-found',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const validationError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 120,
        http_status_code: 404,
        expected_status: 200,
        failure_reason: 'Expected status 200, got 404',
        correlation_id: 'test-id',
        error: {
          type: 'validation',
          code: 'INVALID_STATUS',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(validationError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Should be called only once (no retries for validation errors)
      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
      expect(result).toEqual(validationError);
    });

    test('should NOT retry on text validation failure', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedText: 'Expected Content',
      };

      const validationError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: 'Expected text "Expected Content" not found',
        correlation_id: 'test-id',
        error: {
          type: 'validation',
          code: 'TEXT_NOT_FOUND',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(validationError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
      expect(result).toEqual(validationError);
    });

    test('should NOT retry on header validation failure', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com/redirect',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [302],
        expectedHeaders: {
          location: 'https://expected.com',
        },
      };

      const validationError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 120,
        http_status_code: 302,
        expected_status: 302,
        failure_reason: 'Expected header Location not found',
        correlation_id: 'test-id',
        error: {
          type: 'validation',
          code: 'INVALID_HEADER',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(validationError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
      expect(result).toEqual(validationError);
    });
  });

  describe('Retries Do Not Count Toward Consecutive Failure Threshold', () => {
    test('should track retry attempts separately from consecutive failures', async () => {
      const config: HealthCheckConfig = {
        url: 'https://intermittent.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Connection refused',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      const successResult: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      // Fail 3 times (retries), then succeed
      mockHealthCheck
        .mockResolvedValueOnce(networkError)
        .mockResolvedValueOnce(networkError)
        .mockResolvedValueOnce(networkError)
        .mockResolvedValueOnce(successResult);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Result should be success
      expect(result.status).toBe('PASS');

      // Retries should not count as consecutive failures for HTML display
      // This will be validated in CSV writer tests (only final result recorded)
    });

    test('should only record final result to CSV', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(networkError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Only the final result should be returned (not retry results)
      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');

      // Implementation should only write this single result to CSV,
      // not the intermediate retry attempts
    });
  });

  describe('Edge Cases', () => {
    test('should handle first attempt success (no retries needed)', async () => {
      const config: HealthCheckConfig = {
        url: 'https://healthy.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const successResult: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      mockHealthCheck.mockResolvedValue(successResult);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      expect(mockHealthCheck).toHaveBeenCalledTimes(1);
      expect(result).toEqual(successResult);
    });

    test('should handle alternating network errors and validation errors', async () => {
      const config: HealthCheckConfig = {
        url: 'https://complex.example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error',
        correlation_id: 'test-id',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      const validationError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 120,
        http_status_code: 404,
        expected_status: 200,
        failure_reason: 'Expected status 200, got 404',
        correlation_id: 'test-id',
        error: {
          type: 'validation',
          code: 'INVALID_STATUS',
        },
      } as HealthCheckResultWithError;

      // Network error (retry), then validation error (stop)
      mockHealthCheck.mockResolvedValueOnce(networkError).mockResolvedValueOnce(validationError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Should stop after validation error (no retry for validation)
      expect(mockHealthCheck).toHaveBeenCalledTimes(2);
      expect(result).toEqual(validationError);
    });

    test('should preserve correlation ID across retries', async () => {
      const config: HealthCheckConfig = {
        url: 'https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const networkError: HealthCheckResult = {
        serviceName: config.url,
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Network error',
        correlation_id: 'preserved-id-12345',
        error: {
          type: 'network',
          code: 'ECONNREFUSED',
        },
      } as HealthCheckResultWithError;

      mockHealthCheck.mockResolvedValue(networkError);

      const result = await performHealthCheckWithRetry(config, mockHealthCheck);

      // Correlation ID should be preserved through retries
      expect(result.correlation_id).toBe('preserved-id-12345');
    });
  });
});
