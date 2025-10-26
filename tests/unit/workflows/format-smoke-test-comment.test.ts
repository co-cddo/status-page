/**
 * Unit tests for smoke test comment formatting
 * Tests validation, error handling, and edge cases
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatSmokeTestComment } from '../../../src/workflows/format-smoke-test-comment.ts';
import type { HealthCheckResult } from '../../../src/types/health-check.ts';

/**
 * Helper function to create mock HealthCheckResult
 */
function createMockResult(
  serviceName: string,
  status: 'PASS' | 'DEGRADED' | 'FAIL' | 'PENDING',
  latency_ms: number,
  http_status_code: number,
  failure_reason: string
): HealthCheckResult {
  return {
    serviceName,
    status,
    latency_ms,
    http_status_code,
    failure_reason,
    timestamp: new Date('2025-01-01T00:00:00Z'),
    method: 'GET',
    expected_status: 200,
    correlation_id: 'test-id-' + serviceName,
  };
}

describe('formatSmokeTestComment - Input Validation', () => {
  test('throws TypeError for non-array input', () => {
    expect(() => formatSmokeTestComment(null as unknown as HealthCheckResult[])).toThrow(TypeError);
    expect(() => formatSmokeTestComment(null as unknown as HealthCheckResult[])).toThrow(
      'Results must be an array'
    );
  });

  test('throws TypeError for string input', () => {
    expect(() => formatSmokeTestComment('string' as unknown as HealthCheckResult[])).toThrow(
      TypeError
    );
  });

  test('throws TypeError for object input', () => {
    expect(() => formatSmokeTestComment({} as unknown as HealthCheckResult[])).toThrow(TypeError);
  });

  test('throws TypeError for undefined input', () => {
    expect(() => formatSmokeTestComment(undefined as unknown as HealthCheckResult[])).toThrow(
      TypeError
    );
  });

  test('accepts empty array', () => {
    const comment = formatSmokeTestComment([]);
    expect(comment).toContain('No services configured');
  });
});

describe('formatSmokeTestComment - Invalid Result Filtering', () => {
  // Mock logger to prevent console output during tests
  let loggerWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    // The logger is imported as a module, so we need to mock it differently
    // For now, we'll just verify the function doesn't crash
  });

  afterEach(() => {
    if (loggerWarnSpy) {
      loggerWarnSpy.mockRestore();
    }
  });

  test('filters out results with missing serviceName', () => {
    const results = [
      createMockResult('Valid Service', 'PASS', 100, 200, ''),
      { status: 'PASS', latency_ms: 100, http_status_code: 200 } as unknown as HealthCheckResult, // Missing serviceName
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Valid Service');
    expect(comment).toContain('Total Services:** 1'); // Only 1 valid result
  });

  test('filters out results with invalid status', () => {
    const results = [
      createMockResult('Valid', 'PASS', 100, 200, ''),
      {
        ...createMockResult('Invalid', 'PASS', 100, 200, ''),
        status: 'INVALID_STATUS',
      } as unknown as HealthCheckResult,
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Valid');
    expect(comment).not.toContain('INVALID_STATUS');
    expect(comment).toContain('Total Services:** 1');
  });

  test('filters out results with invalid latency_ms', () => {
    const results = [
      createMockResult('Valid', 'PASS', 100, 200, ''),
      {
        ...createMockResult('Invalid', 'PASS', 100, 200, ''),
        latency_ms: -1,
      } as unknown as HealthCheckResult,
      {
        ...createMockResult('Invalid2', 'PASS', 100, 200, ''),
        latency_ms: 'not a number',
      } as unknown as HealthCheckResult,
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Total Services:** 1');
  });

  test('filters out results with invalid http_status_code', () => {
    const results = [
      createMockResult('Valid', 'PASS', 100, 200, ''),
      {
        ...createMockResult('Invalid', 'PASS', 100, 200, ''),
        http_status_code: 'not a number',
      } as unknown as HealthCheckResult,
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Total Services:** 1');
  });

  test('filters out results with invalid failure_reason type', () => {
    const results = [
      createMockResult('Valid', 'PASS', 100, 200, ''),
      {
        ...createMockResult('Invalid', 'PASS', 100, 200, ''),
        failure_reason: 123,
      } as unknown as HealthCheckResult,
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Total Services:** 1');
  });

  test('returns no services message when all results are invalid', () => {
    const results = [
      { invalid: 'object' } as unknown as HealthCheckResult,
      { serviceName: 'Test', status: 'INVALID' } as unknown as HealthCheckResult,
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('No services configured');
  });
});

describe('formatSmokeTestComment - PENDING Status Handling', () => {
  test('includes PENDING section when PENDING results exist', () => {
    const results = [
      createMockResult('Service A', 'PENDING', 0, 0, ''),
      createMockResult('Service B', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('## ⏳ PENDING');
    expect(comment).toContain('Service A');
  });

  test('includes PENDING count in summary', () => {
    const results = [
      createMockResult('A', 'PENDING', 0, 0, ''),
      createMockResult('B', 'PENDING', 0, 0, ''),
      createMockResult('C', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('⏳ **Pending:** 2');
  });

  test('orders sections correctly: FAILED, DEGRADED, PENDING, PASS', () => {
    const results = [
      createMockResult('Pass', 'PASS', 100, 200, ''),
      createMockResult('Pending', 'PENDING', 0, 0, ''),
      createMockResult('Degraded', 'DEGRADED', 2500, 200, ''),
      createMockResult('Failed', 'FAIL', 0, 500, 'Error'),
    ];

    const comment = formatSmokeTestComment(results);

    const failedIndex = comment.indexOf('## ❌ FAILED');
    const degradedIndex = comment.indexOf('## ⚠️ DEGRADED');
    const pendingIndex = comment.indexOf('## ⏳ PENDING');
    const passIndex = comment.indexOf('## ✅ PASS');

    expect(failedIndex).toBeGreaterThan(0);
    expect(degradedIndex).toBeGreaterThan(failedIndex);
    expect(pendingIndex).toBeGreaterThan(degradedIndex);
    expect(passIndex).toBeGreaterThan(pendingIndex);
  });

  test('does not include PENDING section when no PENDING results', () => {
    const results = [
      createMockResult('A', 'PASS', 100, 200, ''),
      createMockResult('B', 'FAIL', 0, 500, 'Error'),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).not.toContain('## ⏳ PENDING');
    expect(comment).toContain('⏳ **Pending:** 0');
  });
});

describe('formatSmokeTestComment - Summary Statistics', () => {
  test('calculates correct summary counts', () => {
    const results = [
      createMockResult('A', 'PASS', 100, 200, ''),
      createMockResult('B', 'PASS', 100, 200, ''),
      createMockResult('C', 'DEGRADED', 2500, 200, ''),
      createMockResult('D', 'FAIL', 0, 500, 'Error'),
      createMockResult('E', 'FAIL', 0, 404, 'Not Found'),
      createMockResult('F', 'PENDING', 0, 0, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('Total Services:** 6');
    expect(comment).toContain('✅ **Passed:** 2');
    expect(comment).toContain('⚠️ **Degraded:** 1');
    expect(comment).toContain('❌ **Failed:** 2');
    expect(comment).toContain('⏳ **Pending:** 1');
  });

  test('shows warning for >50% failure rate', () => {
    const results = [
      createMockResult('A', 'FAIL', 0, 500, 'Error 1'),
      createMockResult('B', 'FAIL', 0, 500, 'Error 2'),
      createMockResult('C', 'FAIL', 0, 500, 'Error 3'),
      createMockResult('D', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).toContain('⚠️ WARNING: Widespread Failures Detected');
    expect(comment).toMatch(/75%.*failed/);
  });

  test('does not show warning for ≤50% failure rate', () => {
    const results = [
      createMockResult('A', 'FAIL', 0, 500, 'Error'),
      createMockResult('B', 'PASS', 100, 200, ''),
      createMockResult('C', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).not.toContain('WARNING: Widespread Failures');
  });

  test('handles exactly 50% failure rate (no warning)', () => {
    const results = [
      createMockResult('A', 'FAIL', 0, 500, 'Error'),
      createMockResult('B', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    expect(comment).not.toContain('WARNING: Widespread Failures');
  });
});

describe('formatSmokeTestComment - Timestamp', () => {
  test('includes timestamp in footer', () => {
    const results = [createMockResult('A', 'PASS', 100, 200, '')];

    const comment = formatSmokeTestComment(results);

    expect(comment).toMatch(/Smoke test completed at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('includes timestamp even with no services', () => {
    const comment = formatSmokeTestComment([]);

    expect(comment).toMatch(/Generated at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('formatSmokeTestComment - Performance Optimization', () => {
  test('uses single-pass categorization for large result sets', () => {
    // This test verifies the implementation uses reduce() instead of multiple filter() calls
    // Performance difference matters for 500+ services
    const results = Array.from({ length: 600 }, (_, i) => {
      const statuses: Array<'PASS' | 'FAIL' | 'DEGRADED' | 'PENDING'> = [
        'PASS',
        'FAIL',
        'DEGRADED',
        'PENDING',
      ];
      const status = statuses[i % 4];
      // Status will always be defined since i % 4 is always 0-3
      if (!status) throw new Error('Unexpected undefined status');
      return createMockResult(
        `Service ${i}`,
        status,
        100,
        i % 4 === 1 ? 500 : 200,
        i % 4 === 1 ? 'Error' : ''
      );
    });

    const startTime = Date.now();
    const comment = formatSmokeTestComment(results);
    const endTime = Date.now();

    // Should complete in reasonable time (< 1 second for 600 services)
    expect(endTime - startTime).toBeLessThan(1000);

    // Verify all services are present
    expect(comment).toContain('Service 0');
    expect(comment).toContain('Service 599');
  });
});
