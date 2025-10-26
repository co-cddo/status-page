/**
 * Unit tests for markdown utility functions
 * Tests table generation with various inputs and edge cases
 */

import { describe, test, expect } from 'vitest';
import { generateHealthCheckTable } from '../../../src/utils/markdown.ts';
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

describe('generateHealthCheckTable', () => {
  test('returns empty string for empty results array', () => {
    const table = generateHealthCheckTable([]);
    expect(table).toBe('');
  });

  test('generates table with single result', () => {
    const results = [createMockResult('Test Service', 'PASS', 150, 200, '')];

    const table = generateHealthCheckTable(results);

    expect(table).toContain('| Service | Status | Latency | HTTP Code | Failure Reason |');
    expect(table).toContain('|---------|--------|---------|-----------|----------------|');
    expect(table).toContain('| Test Service');
    expect(table).toContain('| PASS |');
    expect(table).toContain('| 200 |');
    expect(table).toMatch(/\|\s*-\s*\|/); // Failure reason should be '-'
  });

  test('generates table with multiple results', () => {
    const results = [
      createMockResult('Service A', 'PASS', 100, 200, ''),
      createMockResult('Service B', 'FAIL', 0, 500, 'Server Error'),
      createMockResult('Service C', 'DEGRADED', 2500, 200, ''),
    ];

    const table = generateHealthCheckTable(results);

    expect(table).toContain('Service A');
    expect(table).toContain('Service B');
    expect(table).toContain('Service C');
    expect(table).toContain('PASS');
    expect(table).toContain('FAIL');
    expect(table).toContain('DEGRADED');
    expect(table).toContain('Server Error');
  });

  test('escapes special markdown characters in service names', () => {
    const results = [
      createMockResult('Service | With | Pipes', 'PASS', 100, 200, ''),
      createMockResult('Service *with* asterisks', 'PASS', 100, 200, ''),
    ];

    const table = generateHealthCheckTable(results);

    // Should escape the characters
    expect(table).toContain('\\|');
    expect(table).toContain('\\*');
  });

  test('truncates long failure reasons', () => {
    const longReason = 'A'.repeat(500);
    const results = [createMockResult('Service', 'FAIL', 0, 500, longReason)];

    const table = generateHealthCheckTable(results);

    // Default max length is 100, plus ellipsis
    const reasonMatch = table.match(/\| ([A]{1,150})/);
    expect(reasonMatch).toBeDefined();
    if (reasonMatch) {
      expect(reasonMatch[1].length).toBeLessThanOrEqual(103); // 100 + '...'
    }
  });

  test('respects custom maxReasonLength option', () => {
    const longReason = 'B'.repeat(500);
    const results = [createMockResult('Service', 'FAIL', 0, 500, longReason)];

    const table = generateHealthCheckTable(results, { maxReasonLength: 50 });

    const reasonMatch = table.match(/\| ([B]{1,100})/);
    expect(reasonMatch).toBeDefined();
    if (reasonMatch) {
      expect(reasonMatch[1].length).toBeLessThanOrEqual(53); // 50 + '...'
    }
  });

  test('handles special characters in failure reasons', () => {
    const results = [
      createMockResult('Service', 'FAIL', 0, 500, 'Error with | pipes | and * asterisks *'),
    ];

    const table = generateHealthCheckTable(results);

    expect(table).toContain('\\|');
    expect(table).toContain('\\*');
  });

  test('formats latency correctly', () => {
    const results = [
      createMockResult('Fast', 'PASS', 50, 200, ''),
      createMockResult('Slow', 'DEGRADED', 3000, 200, ''),
    ];

    const table = generateHealthCheckTable(results);

    // Should contain formatted latency
    expect(table).toMatch(/50\s*ms|0\.05\s*s/);
    expect(table).toMatch(/3000\s*ms|3\.0\s*s/);
  });

  test('handles N/A for missing HTTP status code', () => {
    const result = createMockResult('Service', 'FAIL', 0, 0, 'Timeout');
    result.http_status_code = 0;

    const table = generateHealthCheckTable([result]);

    // Should show N/A for 0 status code (falsy value)
    expect(table).toMatch(/\|\s*N\/A\s*\|/);
  });

  test('shows dash for empty failure reason', () => {
    const results = [createMockResult('Service', 'PASS', 100, 200, '')];

    const table = generateHealthCheckTable(results);

    expect(table).toMatch(/\|\s*-\s*\|$/m);
  });

  test('ends with newline', () => {
    const results = [createMockResult('Service', 'PASS', 100, 200, '')];

    const table = generateHealthCheckTable(results);

    expect(table).toMatch(/\n$/);
  });

  test('handles all status types', () => {
    const results = [
      createMockResult('A', 'PASS', 100, 200, ''),
      createMockResult('B', 'FAIL', 0, 500, 'Error'),
      createMockResult('C', 'DEGRADED', 2500, 200, ''),
      createMockResult('D', 'PENDING', 0, 0, ''),
    ];

    const table = generateHealthCheckTable(results);

    expect(table).toContain('PASS');
    expect(table).toContain('FAIL');
    expect(table).toContain('DEGRADED');
    expect(table).toContain('PENDING');
  });

  test('generates valid markdown table structure', () => {
    const results = [createMockResult('Service', 'PASS', 100, 200, '')];

    const table = generateHealthCheckTable(results);

    const lines = table.split('\n').filter((line) => line.length > 0);

    // Should have at least 3 lines: header, separator, data row
    expect(lines.length).toBeGreaterThanOrEqual(3);

    // All lines should have 5 pipes (6 columns)
    lines.forEach((line) => {
      const pipeCount = (line.match(/\|/g) || []).length;
      expect(pipeCount).toBe(6);
    });
  });

  test('handles large number of results', () => {
    const results = Array.from({ length: 100 }, (_, i) =>
      createMockResult(`Service ${i}`, 'PASS', 100, 200, '')
    );

    const table = generateHealthCheckTable(results);

    // Should contain all services
    expect(table).toContain('Service 0');
    expect(table).toContain('Service 99');

    // Should have correct number of data rows
    const lines = table.split('\n').filter((line) => line.length > 0);
    expect(lines.length).toBe(102); // header + separator + 100 data rows
  });
});
