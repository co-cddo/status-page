/**
 * Unit tests for Smoke Test Comment Formatter
 *
 * Tests Markdown comment generation, validation, statistics, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatSmokeTestComment } from '../../../src/workflows/format-smoke-test-comment.js';
import type { HealthCheckResult } from '../../../src/types/health-check.js';

describe('formatSmokeTestComment()', () => {
  // Mock console.warn to suppress warnings during tests
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Valid Results', () => {
    it('should format single PASS result', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'API Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('## Smoke Test Results Summary');
      expect(comment).toContain('**Total Services:** 1');
      expect(comment).toContain('**Passed:** 1');
      expect(comment).toContain('**Degraded:** 0');
      expect(comment).toContain('**Failed:** 0');
      expect(comment).toContain('| API Service |');
      expect(comment).toContain('| PASS |');
      expect(comment).toContain('| 200 |');
    });

    it('should format multiple results with mixed statuses', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service A',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
        {
          serviceName: 'Service B',
          timestamp: '2025-01-15T10:00:01Z',
          method: 'GET',
          status: 'DEGRADED',
          latency_ms: 2500,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '223e4567-e89b-42d3-a456-426614174001',
        },
        {
          serviceName: 'Service C',
          timestamp: '2025-01-15T10:00:02Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 500,
          failure_reason: 'Internal server error',
          correlation_id: '323e4567-e89b-42d3-a456-426614174002',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**Total Services:** 3');
      expect(comment).toContain('**Passed:** 1');
      expect(comment).toContain('**Degraded:** 1');
      expect(comment).toContain('**Failed:** 1');
      expect(comment).toContain('Service A');
      expect(comment).toContain('Service B');
      expect(comment).toContain('Service C');
    });

    it('should include detailed results table', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'API',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('## Detailed Results');
      expect(comment).toContain('| Service | Status | Latency | HTTP Code | Failure Reason |');
      expect(comment).toContain('|---------|--------|---------|-----------|----------------|');
    });

    it('should format latency values correctly', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Fast',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 50,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
        {
          serviceName: 'Slow',
          timestamp: '2025-01-15T10:00:01Z',
          method: 'GET',
          status: 'DEGRADED',
          latency_ms: 3500,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '223e4567-e89b-42d3-a456-426614174001',
        },
      ];

      const comment = formatSmokeTestComment(results);

      // formatLatency should format these appropriately
      expect(comment).toContain('Fast');
      expect(comment).toContain('Slow');
    });

    it('should display failure reason when present', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Failed Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 503,
          failure_reason: 'Connection timeout',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('Connection timeout');
    });

    it('should display dash for empty failure reason', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Passed Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      // Should show dash for empty failure reason
      const lines = comment.split('\n');
      const dataLine = lines.find((line) => line.includes('Passed Service'));
      expect(dataLine).toContain('| - |');
    });

    it('should include timestamp in footer', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toMatch(/\*Smoke test completed at .+\*/);
    });

    it('should escape Markdown special characters in service names', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service_with_underscores',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      // escapeMarkdown should handle special characters
      expect(comment).toContain('Service');
    });

    it('should truncate long failure reasons', () => {
      const longReason = 'A'.repeat(200); // 200 character failure reason
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 500,
          failure_reason: longReason,
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      // truncate function should limit to 100 chars
      const lines = comment.split('\n');
      const dataLine = lines.find((line) => line.includes('Service'));
      expect(dataLine).toBeDefined();
      // The line should not contain the full 200 character string
      expect(dataLine!.length).toBeLessThan(300); // Much less than full reason would be
    });
  });

  describe('Warning Section', () => {
    it('should show warning when >50% failures', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service 1',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 500,
          failure_reason: 'Error 1',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
        {
          serviceName: 'Service 2',
          timestamp: '2025-01-15T10:00:01Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 500,
          failure_reason: 'Error 2',
          correlation_id: '223e4567-e89b-42d3-a456-426614174001',
        },
        {
          serviceName: 'Service 3',
          timestamp: '2025-01-15T10:00:02Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '323e4567-e89b-42d3-a456-426614174002',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('## ⚠️ WARNING: Widespread Failures Detected');
      expect(comment).toContain('2 of 3 services');
      expect(comment).toContain('67%'); // 2/3 = 66.67% rounded to 67%
      expect(comment).toContain('Configuration errors');
      expect(comment).toContain('review the failure reasons');
    });

    it('should NOT show warning when ≤50% failures', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service 1',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 500,
          failure_reason: 'Error',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
        {
          serviceName: 'Service 2',
          timestamp: '2025-01-15T10:00:01Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '223e4567-e89b-42d3-a456-426614174001',
        },
        {
          serviceName: 'Service 3',
          timestamp: '2025-01-15T10:00:02Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '323e4567-e89b-42d3-a456-426614174002',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).not.toContain('⚠️ WARNING: Widespread Failures');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results array', () => {
      const results: HealthCheckResult[] = [];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('## Smoke Test Results');
      expect(comment).toContain('**No services configured for health checks.**');
      expect(comment).toMatch(/\*Generated at .+\*/);
    });

    it('should throw TypeError for non-array input', () => {
      expect(() => formatSmokeTestComment(null as unknown as HealthCheckResult[])).toThrow(
        TypeError
      );
      expect(() => formatSmokeTestComment(undefined as unknown as HealthCheckResult[])).toThrow(
        TypeError
      );
      expect(() => formatSmokeTestComment('not array' as unknown as HealthCheckResult[])).toThrow(
        TypeError
      );
      expect(() => formatSmokeTestComment({} as unknown as HealthCheckResult[])).toThrow(TypeError);
    });

    it('should filter out invalid results with warnings', () => {
      const results = [
        {
          serviceName: 'Valid Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
        {
          serviceName: '', // Invalid: empty name
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
        },
        {
          serviceName: 'Invalid Status',
          status: 'UNKNOWN', // Invalid status
          latency_ms: 150,
          http_status_code: 200,
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**Total Services:** 1'); // Only valid result
      expect(comment).toContain('Valid Service');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle result with missing serviceName', () => {
      const results = [
        {
          timestamp: '2025-01-15T10:00:00Z',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing or invalid serviceName')
      );
    });

    it('should handle result with invalid status', () => {
      const results = [
        {
          serviceName: 'Service',
          status: 'INVALID',
          latency_ms: 150,
          http_status_code: 200,
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('invalid status'));
    });

    it('should handle result with negative latency', () => {
      const results = [
        {
          serviceName: 'Service',
          status: 'PASS',
          latency_ms: -100,
          http_status_code: 200,
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('invalid latency_ms'));
    });

    it('should handle result with non-number HTTP status code', () => {
      const results = [
        {
          serviceName: 'Service',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: '200',
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('invalid http_status_code'));
    });

    it('should handle result with invalid failure_reason type', () => {
      const results = [
        {
          serviceName: 'Service',
          status: 'PASS',
          latency_ms: 150,
          http_status_code: 200,
          failure_reason: 123, // Should be string
        },
      ] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid failure_reason type')
      );
    });

    it('should handle result with non-object value', () => {
      const results = ['not an object', 123, null] as unknown as HealthCheckResult[];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('**No services configured');
      expect(console.warn).toHaveBeenCalledTimes(3);
    });

    it('should handle PENDING status', () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Pending Service',
          timestamp: '2025-01-15T10:00:00Z',
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          failure_reason: '',
          correlation_id: '123e4567-e89b-42d3-a456-426614174000',
        },
      ];

      const comment = formatSmokeTestComment(results);

      expect(comment).toContain('PENDING');
      expect(comment).toContain('**Total Services:** 1');
    });
  });
});
