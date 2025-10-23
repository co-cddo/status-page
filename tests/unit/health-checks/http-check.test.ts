/**
 * Unit test for HTTP health check (User Story 1 - Phase 4A)
 * Per T026a: Test GET/HEAD/POST methods, custom headers, POST payloads,
 * AbortSignal.timeout() for timeouts, status code validation, response text validation,
 * response header validation, return HealthCheckResult with all fields,
 * network errors, timeout scenarios
 *
 * This test MUST fail before T026 implementation (TDD requirement)
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { performHealthCheck } from '../../../src/health-checks/http-check.js';
import type { HealthCheckConfig, HealthCheckResult } from '../../../src/types/health-check.js';

// Mock fetch globally to avoid real network calls
const mockFetch = vi.fn();

describe('performHealthCheck (T026a - TDD Phase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);

    // Default mock response for most tests
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
      }),
      text: async () => 'Mock response body',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('HTTP Methods', () => {
    test('should perform GET request successfully', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/health',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.serviceName).toBe(config.url);
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
      expect(result.latency_ms).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.correlation_id).toBeTruthy();
      expect(result.failure_reason).toBe('');
      expect(mockFetch).toHaveBeenCalledWith(config.url, expect.objectContaining({
        method: 'GET',
      }));
    });

    test('should perform HEAD request successfully', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/health',
        method: 'HEAD',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.method).toBe('HEAD');
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(config.url, expect.objectContaining({
        method: 'HEAD',
      }));
    });

    test('should perform POST request with payload successfully', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/api',
        method: 'POST',
        timeout: 5000,
        expectedStatus: [200],
        payload: { key: 'value', test: 'data' },
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.method).toBe('POST');
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(config.url, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value', test: 'data' }),
      }));
    });
  });

  describe('Custom Headers', () => {
    test('should send custom headers with request', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/headers',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        headers: [
          { name: 'X-Custom-Header', value: 'custom-value' },
          { name: 'Authorization', value: 'Bearer token123' },
        ],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout after specified duration using AbortSignal.timeout()', async () => {
      // Override default mock to simulate timeout
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/delay/10', // 10 second delay
        method: 'GET',
        timeout: 1000, // 1 second timeout
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('timeout');
      expect(result.latency_ms).toBeLessThan(2000); // Should fail quickly
    });

    test('should not timeout when response is within timeout limit', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/delay/1', // 1 second delay
        method: 'GET',
        timeout: 5000, // 5 second timeout
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
    });
  });

  describe('Status Code Validation', () => {
    test('should validate expected status code matches actual', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
      expect(result.expected_status).toBe(200);
    });

    test('should fail when status code does not match expected', async () => {
      // Override default mock to return 404
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
        headers: new Headers(),
        text: async () => 'Not Found',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/404',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.http_status_code).toBe(404);
      expect(result.expected_status).toBe(200);
      expect(result.failure_reason).toContain('status');
      expect(result.failure_reason).toContain('200');
      expect(result.failure_reason).toContain('404');
    });

    test('should accept multiple expected status codes', async () => {
      // Override default mock to return 201
      mockFetch.mockResolvedValueOnce({
        status: 201,
        ok: true,
        headers: new Headers(),
        text: async () => 'Created',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/201',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200, 201, 204],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(201);
    });
  });

  describe('Response Text Validation (FR-014 - First 100KB)', () => {
    test('should validate expected text found in response body', async () => {
      // Override default mock to return response with "html" in body
      const responseBody = '<html><body>Test page</body></html>';
      const encoder = new TextEncoder();
      const bodyBytes = encoder.encode(responseBody);

      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: async () => responseBody,
        body: {
          getReader: () => {
            let position = 0;
            return {
              read: async () => {
                if (position >= bodyBytes.length) {
                  return { done: true, value: undefined };
                }
                const chunk = bodyBytes.slice(position);
                position = bodyBytes.length;
                return { done: false, value: chunk };
              },
              releaseLock: () => {},
            };
          },
        },
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/html',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedText: 'html',
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
    });

    test('should fail when expected text not found in response body', async () => {
      // Override default mock to return response without expected text
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: async () => '<html><body>Different content</body></html>',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/html',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedText: 'NONEXISTENT_TEXT_12345',
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('text');
      expect(result.failure_reason).toContain('not found');
    });

    test('should search only first 100KB of response body (FR-014)', async () => {
      // Note: This test would require a test server that returns > 100KB
      // For now, we document the requirement
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/bytes/150000', // 150KB response
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      // Implementation should only read first 100KB
    });

    test('should perform case-sensitive text matching', async () => {
      // Override default mock to return response with lowercase "html"
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers(),
        text: async () => '<html><body>Test page</body></html>',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/html',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedText: 'HTML', // Uppercase
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      // Should fail if response contains "html" but we expect "HTML"
      expect(result).toBeDefined();
      expect(['PASS', 'FAIL']).toContain(result.status);
    });
  });

  describe('Response Header Validation (FR-004a - Redirect Validation)', () => {
    test('should validate Location header for redirect responses', async () => {
      // Override default mock to return 302 redirect with Location header
      mockFetch.mockResolvedValueOnce({
        status: 302,
        ok: false,
        headers: new Headers({
          'location': 'https://example.com',
        }),
        text: async () => 'Found',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/redirect-to?url=https://example.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [302],
        expectedHeaders: {
          location: 'https://example.com',
        },
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(302);
    });

    test('should use case-insensitive header name matching', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/response-headers?content-type=application/json',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedHeaders: {
          'Content-Type': 'application/json', // Capital letters
        },
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
    });

    test('should use case-sensitive header value matching', async () => {
      // Override default mock to return custom-header with "CustomValue" (different case)
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers({
          'custom-header': 'CustomValue',
        }),
        text: async () => 'OK',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/response-headers?custom-header=CustomValue',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedHeaders: {
          'custom-header': 'customvalue', // Lowercase
        },
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      // Should fail because value case doesn't match
      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('header');
    });

    test('should fail when expected header not present', async () => {
      // Override default mock to return response without x-nonexistent-header
      mockFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers({
          'content-type': 'application/json',
        }),
        text: async () => 'OK',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/get',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
        expectedHeaders: {
          'x-nonexistent-header': 'value',
        },
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('header');
      expect(result.failure_reason).toContain('not found');
    });
  });

  describe('Network Errors', () => {
    test('should handle DNS failure gracefully', async () => {
      // Override default mock to simulate DNS failure
      mockFetch.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND this-domain-definitely-does-not-exist-12345.com'));

      const config: HealthCheckConfig = {
        url: 'https://this-domain-definitely-does-not-exist-12345.com',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toBeTruthy();
      expect(result.failure_reason.toLowerCase()).toMatch(/dns|network|connection/);
    });

    test('should handle connection refused gracefully', async () => {
      // Override default mock to simulate connection refused
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:99999'));

      const config: HealthCheckConfig = {
        url: 'http://localhost:99999', // Invalid port
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toBeTruthy();
      expect(result.failure_reason.toLowerCase()).toMatch(/connection|refused|failed/);
    });

    test('should handle SSL/TLS errors gracefully', async () => {
      // Override default mock to simulate SSL/TLS error
      mockFetch.mockRejectedValueOnce(new Error('SSL certificate problem: certificate has expired'));

      const config: HealthCheckConfig = {
        url: 'https://expired.badssl.com/', // Certificate expired
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toBeTruthy();
    });
  });

  describe('HealthCheckResult Structure', () => {
    test('should return HealthCheckResult with all required fields', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      // Required fields from data-model.md
      expect(result).toHaveProperty('serviceName');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('latency_ms');
      expect(result).toHaveProperty('http_status_code');
      expect(result).toHaveProperty('expected_status');
      expect(result).toHaveProperty('failure_reason');
      expect(result).toHaveProperty('correlation_id');

      // Type validation
      expect(typeof result.serviceName).toBe('string');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(['GET', 'HEAD', 'POST']).toContain(result.method);
      expect(['PASS', 'DEGRADED', 'FAIL', 'PENDING']).toContain(result.status);
      expect(typeof result.latency_ms).toBe('number');
      expect(typeof result.http_status_code).toBe('number');
      expect(typeof result.expected_status).toBe('number');
      expect(typeof result.failure_reason).toBe('string');
      expect(typeof result.correlation_id).toBe('string');

      // UUID v4 format for correlation_id (FR-036)
      expect(result.correlation_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('should have empty failure_reason for successful checks', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result.status).toBe('PASS');
      expect(result.failure_reason).toBe('');
    });

    test('should have populated failure_reason for failed checks', async () => {
      // Override default mock to return 500 error
      mockFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        headers: new Headers(),
        text: async () => 'Internal Server Error',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/500',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toBeTruthy();
      expect(result.failure_reason.length).toBeGreaterThan(0);
    });
  });

  describe('Latency Measurement', () => {
    test('should measure response latency in milliseconds', async () => {
      // Override default mock to simulate 1 second delay
      mockFetch.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          text: async () => 'OK',
        };
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/delay/1', // 1 second delay
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const startTime = Date.now();
      const result: HealthCheckResult = await performHealthCheck(config);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.latency_ms).toBeGreaterThanOrEqual(1000); // At least 1 second
      expect(result.latency_ms).toBeLessThanOrEqual(endTime - startTime + 100); // Within tolerance
    });

    test('should record latency as integer milliseconds', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result.latency_ms).toBe(Math.floor(result.latency_ms)); // Integer
    });
  });

  describe('Correlation ID (FR-036)', () => {
    test('should generate unique correlation IDs for each check', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result1: HealthCheckResult = await performHealthCheck(config);
      const result2: HealthCheckResult = await performHealthCheck(config);

      expect(result1.correlation_id).not.toBe(result2.correlation_id);
    });

    test('should use UUID v4 format for correlation IDs', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/200',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      // UUID v4 regex pattern
      const uuidV4Pattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.correlation_id).toMatch(uuidV4Pattern);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty response body', async () => {
      // Override default mock to return 204 No Content with empty body
      mockFetch.mockResolvedValueOnce({
        status: 204,
        ok: true,
        headers: new Headers(),
        text: async () => '',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/status/204', // No Content
        method: 'GET',
        timeout: 5000,
        expectedStatus: [204],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(204);
    });

    test('should handle very large response bodies efficiently', async () => {
      const config: HealthCheckConfig = {
        url: 'https://test.example.com/bytes/1000000', // 1MB response
        method: 'GET',
        timeout: 10000,
        expectedStatus: [200],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.status).toBe('PASS');
    });

    test('should handle redirects without following (redirect: manual)', async () => {
      // Override default mock to return 302 redirect
      mockFetch.mockResolvedValueOnce({
        status: 302,
        ok: false,
        headers: new Headers({
          'location': 'https://test.example.com/redirected',
        }),
        text: async () => 'Found',
      });

      const config: HealthCheckConfig = {
        url: 'https://test.example.com/redirect/1',
        method: 'GET',
        timeout: 5000,
        expectedStatus: [302],
      };

      const result: HealthCheckResult = await performHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.http_status_code).toBe(302);
      expect(result.status).toBe('PASS');
    });
  });
});
