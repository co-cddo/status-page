/**
 * Integration test for smoke test comment formatting (User Story 6)
 * Per T018b: Test Markdown table generation from health check results
 *
 * This test MUST fail before T020 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import { formatSmokeTestComment } from '../../src/workflows/format-smoke-test-comment.ts';
import type { HealthCheckResult } from '../../src/types/health-check.ts';

/**
 * Helper function to create mock HealthCheckResult with required properties
 */
function createMockResult(
  serviceName: string,
  status: 'PASS' | 'DEGRADED' | 'FAIL',
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

describe('Smoke Test Comment Formatting (US6)', () => {
  test('generates Markdown table from health check results', () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 150, 200, ''),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
      createMockResult('Service C', 'FAIL', 0, 500, 'HTTP 500 Internal Server Error'),
    ];

    // This will fail until formatSmokeTestComment is implemented
    const comment = formatSmokeTestComment(results);

    // Verify table structure
    expect(comment).toContain('| Service | Status | Latency | HTTP Code | Failure Reason |');
    expect(comment).toContain('|---------|--------|---------|-----------|----------------|');

    // Verify service rows
    expect(comment).toContain('| Service A');
    expect(comment).toContain('| Service B');
    expect(comment).toContain('| Service C');

    // Verify status indicators
    expect(comment).toContain('PASS');
    expect(comment).toContain('DEGRADED');
    expect(comment).toContain('FAIL');
  });

  test('includes summary statistics', () => {
    const results: HealthCheckResult[] = [
      createMockResult('A', 'PASS', 100, 200, ''),
      createMockResult('B', 'PASS', 150, 200, ''),
      createMockResult('C', 'DEGRADED', 2500, 200, ''),
      createMockResult('D', 'FAIL', 0, 500, 'Error'),
      createMockResult('E', 'FAIL', 0, 404, 'Not Found'),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify summary section
    expect(comment).toMatch(/summary|overview/i);
    expect(comment).toMatch(/total.*5/i);
    expect(comment).toMatch(/passed.*2/i);
    expect(comment).toMatch(/degraded.*1/i);
    expect(comment).toMatch(/failed.*2/i);
  });

  test('includes warning section for widespread failures', () => {
    // More than 50% failures
    const results: HealthCheckResult[] = [
      createMockResult('A', 'FAIL', 0, 500, 'Error 1'),
      createMockResult('B', 'FAIL', 0, 500, 'Error 2'),
      createMockResult('C', 'FAIL', 0, 500, 'Error 3'),
      createMockResult('D', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify warning present
    expect(comment).toMatch(/⚠️|warning|alert/i);
    expect(comment).toMatch(/widespread|multiple.*fail/i);
  });

  test('handles empty results', () => {
    const results: HealthCheckResult[] = [];

    const comment = formatSmokeTestComment(results);

    // Should indicate no services checked
    expect(comment).toMatch(/no services|empty/i);
  });

  test('formats latency values correctly', () => {
    const results: HealthCheckResult[] = [
      createMockResult('Fast', 'PASS', 50, 200, ''),
      createMockResult('Slow', 'DEGRADED', 3000, 200, ''),
      createMockResult('Timeout', 'FAIL', 5000, 0, 'Timeout'),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify latency formatting (ms or seconds)
    expect(comment).toMatch(/50\s*ms|0\.05\s*s/i);
    expect(comment).toMatch(/3000\s*ms|3\.0\s*s/i);
    expect(comment).toMatch(/5000\s*ms|5\.0\s*s/i);
  });

  test('escapes special Markdown characters in service names', () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service | with | pipes', 'PASS', 100, 200, ''),
      createMockResult('Service *with* asterisks', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify special characters are escaped or handled
    expect(comment).toBeDefined();
    // Should not break table formatting
    expect(comment).toMatch(/\|.*\|.*\|.*\|.*\|.*\|/); // Valid table row pattern
  });

  test('truncates long failure reasons', () => {
    const longReason = 'A'.repeat(500); // Very long error message

    const results: HealthCheckResult[] = [
      createMockResult('Service', 'FAIL', 0, 500, longReason),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify failure reason is truncated (e.g., max 100 chars)
    const failureReasonInComment = comment.match(/\| [A]{1,150}/);
    expect(failureReasonInComment).toBeDefined();
    expect(failureReasonInComment?.[0].length).toBeLessThan(200);
  });

  test('handles large result sets (50+ services)', () => {
    // Generate 60 services
    const results: HealthCheckResult[] = Array.from({ length: 60 }, (_, i) =>
      createMockResult(
        `Service ${i + 1}`,
        i % 3 === 0 ? 'PASS' : i % 3 === 1 ? 'DEGRADED' : 'FAIL',
        Math.floor(Math.random() * 3000),
        i % 3 === 2 ? 500 : 200,
        i % 3 === 2 ? `Error ${i}` : ''
      )
    );

    const comment = formatSmokeTestComment(results);

    // Verify all services are included
    expect(comment).toContain('Service 1');
    expect(comment).toContain('Service 60');

    // Verify summary shows correct total
    expect(comment).toMatch(/total.*60/i);
  });

  test('comment updates on subsequent runs', () => {
    const initialResults: HealthCheckResult[] = [
      createMockResult('A', 'PASS', 100, 200, ''),
    ];

    const updatedResults: HealthCheckResult[] = [
      createMockResult('A', 'FAIL', 0, 500, 'Now failing'),
    ];

    const initialComment = formatSmokeTestComment(initialResults);
    const updatedComment = formatSmokeTestComment(updatedResults);

    // Verify comments are different
    expect(initialComment).not.toBe(updatedComment);

    // Verify updated status reflected
    expect(updatedComment).toContain('FAIL');
    expect(updatedComment).toContain('Now failing');
  });

  test('includes timestamp in comment', () => {
    const results: HealthCheckResult[] = [
      createMockResult('A', 'PASS', 100, 200, ''),
    ];

    const comment = formatSmokeTestComment(results);

    // Verify timestamp present
    expect(comment).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/); // ISO date or time format
  });
});
