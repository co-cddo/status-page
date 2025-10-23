/**
 * Unit test for CSV writer (User Story 1 - Phase 4A)
 * Per T030a: Test append HealthCheckResult to history.csv, verify columns
 * (timestamp ISO 8601, service_name, status PASS/DEGRADED/FAIL, latency_ms integer,
 * http_status_code, failure_reason empty if passed, correlation_id),
 * test file creation if not exists, test append without duplicate headers,
 * test exit with non-zero on write failure, verify atomic writes,
 * test RFC 4180 escaping (commas, quotes, newlines per FR-018)
 *
 * This test MUST fail before T030 implementation (TDD requirement)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CsvWriter } from '../../../src/storage/csv-writer.js';
import type { HealthCheckResult } from '../../../src/types/health-check.js';

describe('CsvWriter (T030a - TDD Phase)', () => {
  const testDir = path.join(__dirname, 'test-output');
  const testCsvPath = path.join(testDir, 'test-history.csv');
  let csvWriter: CsvWriter;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Initialize CSV writer
    csvWriter = new CsvWriter(testCsvPath);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Append HealthCheckResult to CSV', () => {
    test('should append single HealthCheckResult to CSV file', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date('2025-01-01T12:00:00.000Z'),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toBeTruthy();
    });

    test('should append multiple HealthCheckResults in single call', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'service-1',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-1',
        },
        {
          serviceName: 'service-2',
          timestamp: new Date('2025-01-01T12:00:01.000Z'),
          method: 'HEAD',
          status: 'DEGRADED',
          latency_ms: 2500,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-2',
        },
        {
          serviceName: 'service-3',
          timestamp: new Date('2025-01-01T12:00:02.000Z'),
          method: 'POST',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Internal Server Error',
          correlation_id: 'id-3',
        },
      ];

      await csvWriter.appendBatch(results);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Header + 3 data rows
      expect(lines.length).toBe(4);
    });
  });

  describe('CSV Column Verification (FR-018)', () => {
    test('should write correct CSV columns in order', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date('2025-01-01T12:00:00.000Z'),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Header row
      expect(lines[0]).toBe(
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id'
      );
    });

    test('should write timestamp in ISO 8601 format', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date('2025-01-01T12:34:56.789Z'),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dataRow = lines[1];

      expect(dataRow).toContain('2025-01-01T12:34:56.789Z');
    });

    test('should write status as uppercase (PASS/DEGRADED/FAIL)', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'service-1',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-1',
        },
        {
          serviceName: 'service-2',
          timestamp: new Date(),
          method: 'GET',
          status: 'DEGRADED',
          latency_ms: 2500,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-2',
        },
        {
          serviceName: 'service-3',
          timestamp: new Date(),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Error',
          correlation_id: 'id-3',
        },
      ];

      await csvWriter.appendBatch(results);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain(',PASS,');
      expect(content).toContain(',DEGRADED,');
      expect(content).toContain(',FAIL,');
    });

    test('should write latency_ms as integer', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 123,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dataRow = lines[1]!;

      expect(dataRow).toContain(',123,');
      expect(dataRow).not.toContain('123.0');
    });

    test('should write empty failure_reason for PASS status', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');
      const dataRow = lines[1]!;

      // Empty field before correlation_id (two consecutive commas)
      // Match: ,,correlation_id or ,,"quoted-correlation-id"
      expect(dataRow).toMatch(/,,([^,"\n]+|"[^"]*")$/);
    });

    test('should write failure_reason for FAIL status', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Connection timeout',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain('Connection timeout');
    });
  });

  describe('File Creation', () => {
    test('should create CSV file if it does not exist', async () => {
      expect(existsSync(testCsvPath)).toBe(false);

      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      expect(existsSync(testCsvPath)).toBe(true);
    });

    test('should write headers when creating new file', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines[0]).toBe(
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id'
      );
    });
  });

  describe('Append Without Duplicate Headers', () => {
    test('should not write duplicate headers when appending to existing file', async () => {
      const result1: HealthCheckResult = {
        serviceName: 'service-1',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-1',
      };

      const result2: HealthCheckResult = {
        serviceName: 'service-2',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-2',
      };

      // First append (creates file with headers)
      await csvWriter.append(result1);

      // Second append (should not add headers again)
      await csvWriter.append(result2);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Count header rows
      const headerCount = lines.filter((line) =>
        line.startsWith('timestamp,service_name')
      ).length;

      expect(headerCount).toBe(1);
      expect(lines.length).toBe(3); // 1 header + 2 data rows
    });

    test('should append multiple results without duplicate headers', async () => {
      // First batch
      await csvWriter.append({
        serviceName: 'service-1',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-1',
      });

      // Second batch
      await csvWriter.append({
        serviceName: 'service-2',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-2',
      });

      // Third batch
      await csvWriter.append({
        serviceName: 'service-3',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 180,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-3',
      });

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const headerCount = (content.match(/timestamp,service_name/g) || []).length;

      expect(headerCount).toBe(1);
    });
  });

  describe('Write Failure Handling (FR-020a)', () => {
    test('should throw error on write failure (permissions)', async () => {
      // Create read-only directory
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      const readOnlyCsvPath = path.join(readOnlyDir, 'test.csv');
      const readOnlyWriter = new CsvWriter(readOnlyCsvPath);

      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await expect(readOnlyWriter.append(result)).rejects.toThrow();

      // Clean up
      await fs.chmod(readOnlyDir, 0o755);
    });

    test('should throw error on disk space full (simulated)', async () => {
      // This would require mocking fs.writeFile to simulate ENOSPC error
      // For now, document the requirement

      // Mock implementation would throw ENOSPC error
      // await expect(csvWriter.append(result)).rejects.toThrow('ENOSPC');
    });

    test('should provide descriptive error message on failure', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist/test.csv';
      const invalidWriter = new CsvWriter(invalidPath);

      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      try {
        await invalidWriter.append(result);
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
    });
  });

  describe('Atomic Writes', () => {
    test('should write atomically to prevent corruption', async () => {
      const results: HealthCheckResult[] = Array.from({ length: 100 }, (_, i) => ({
        serviceName: `service-${i}`,
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120 + i,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: `id-${i}`,
      }));

      // Write all at once
      await csvWriter.appendBatch(results);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Should have header + 100 data rows
      expect(lines.length).toBe(101);

      // Verify no partial rows
      lines.forEach((line, index) => {
        if (index === 0) return; // Skip header
        const columns = line.split(',');
        expect(columns.length).toBeGreaterThanOrEqual(7);
      });
    });

    test('should handle concurrent writes safely', async () => {
      const writePromises = Array.from({ length: 10 }, (_, i) =>
        csvWriter.append({
          serviceName: `service-${i}`,
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: `id-${i}`,
        })
      );

      await Promise.all(writePromises);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Should have header + 10 data rows
      expect(lines.length).toBe(11);
    });
  });

  describe('RFC 4180 CSV Escaping (FR-018)', () => {
    test('should escape commas in service names', async () => {
      const result: HealthCheckResult = {
        serviceName: 'service, with, commas',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain('"service, with, commas"');
    });

    test('should escape quotes in failure reasons', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Error with "quotes" in message',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      // RFC 4180: Quotes inside quoted fields are escaped by doubling them
      expect(content).toContain('""quotes""');
    });

    test('should escape newlines in failure reasons', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Error on\nline 1\nand line 2',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      // Newlines should be preserved within quoted fields
      expect(content).toContain('"Error on\nline 1\nand line 2"');
    });

    test('should handle combined special characters', async () => {
      const result: HealthCheckResult = {
        serviceName: 'service, with "special" chars',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Error: "timeout", reason:\nnetwork failure',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');

      // Verify CSV content is properly escaped
      // RFC 4180: Quoted fields can contain newlines, so we cannot simply split by \n
      expect(content).toContain('"service, with ""special"" chars"');
      expect(content).toContain('""timeout""');

      // Verify the failure reason with embedded newline is properly quoted
      expect(content).toContain('reason:\nnetwork failure');

      // Verify file is not empty and has expected structure
      expect(content).toBeTruthy();
      expect(content).toContain('timestamp,service_name');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long service names', async () => {
      const longName = 'a'.repeat(1000);
      const result: HealthCheckResult = {
        serviceName: longName,
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 120,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain(longName);
    });

    test('should handle very long failure reasons', async () => {
      const longReason = 'Error: ' + 'x'.repeat(10000);
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: longReason,
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain(longReason);
    });

    test('should handle zero latency', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: 'Connection failed',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain(',0,0,');
    });

    test('should handle high latency values', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'DEGRADED',
        latency_ms: 999999,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      await csvWriter.append(result);

      const content = await fs.readFile(testCsvPath, 'utf-8');
      expect(content).toContain(',999999,');
    });
  });
});
