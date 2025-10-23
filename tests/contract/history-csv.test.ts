/**
 * Contract test for CSV format validation (User Story 1)
 * Per T030b: Validate history.csv format and RFC 4180 compliance
 *
 * This test MUST fail before T030 implementation (TDD requirement)
 *
 * Requirements:
 * - Validate history.csv format (columns: timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id)
 * - Verify timestamp is ISO 8601
 * - Verify status is PASS/DEGRADED/FAIL uppercase
 * - Verify latency_ms is integer
 * - Verify correlation_id is UUID v4
 * - Test parsing and type validation
 * - Test RFC 4180 compliance
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { HealthCheckResult } from '../../src/types/health-check.js';
import { CsvWriter } from '../../src/storage/csv-writer.js';
import { parseCsvLine, CSV_HEADERS } from '../../src/utils/csv.js';

/**
 * Helper to create mock HealthCheckResult
 */
function createMockResult(
  serviceName: string,
  status: 'PENDING' | 'PASS' | 'DEGRADED' | 'FAIL',
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
    timestamp: new Date('2025-10-21T14:30:00.000Z'),
    method: 'GET',
    expected_status: 200,
    correlation_id: randomUUID(),
  };
}

/**
 * Validates ISO 8601 timestamp format
 */
function isValidISO8601(timestamp: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Validates UUID v4 format
 */
function isValidUUIDv4(uuid: string): boolean {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(uuid);
}

describe('CSV Format Contract (US1)', () => {
  let testDir: string;
  let csvPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), 'csv-format-test-' + randomUUID());
    await mkdir(testDir, { recursive: true });
    csvPath = join(testDir, 'history.csv');
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  test('validates CSV header format', async () => {
    // Write a single record to create CSV with header
    const result = createMockResult('Test Service', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    // Read CSV file
    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Verify header line exists
    expect(lines.length).toBeGreaterThan(0);

    const headerLine = lines[0];
    expect(headerLine).toBeDefined();
    const headers = headerLine!.split(',');

    // Verify column names
    expect(headers).toEqual(Array.from(CSV_HEADERS));
  });

  test('validates timestamp is ISO 8601 format', async () => {
    const result = createMockResult('Test Service', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Skip header, parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // First column is timestamp
    const timestamp = values[0];
    expect(timestamp).toBeDefined();

    expect(isValidISO8601(timestamp!)).toBe(true);
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('validates status is uppercase PASS/DEGRADED/FAIL', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 120, 200, ''),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
      createMockResult('Service C', 'FAIL', 0, 500, 'Error'),
    ];

    const csvWriter = new CsvWriter(csvPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data lines (skip header)
    const dataLines = lines.slice(1);

    expect(dataLines).toHaveLength(3);

    const statuses = dataLines.map(line => {
      const values = parseCsvLine(line);
      return values[2]; // status column
    });

    expect(statuses[0]).toBe('PASS');
    expect(statuses[1]).toBe('DEGRADED');
    expect(statuses[2]).toBe('FAIL');

    // Verify all statuses are uppercase
    for (const status of statuses) {
      expect(status).toBeDefined();
      expect(status!).toMatch(/^(PASS|DEGRADED|FAIL)$/);
      expect(status!).toBe(status!.toUpperCase());
    }
  });

  test('validates latency_ms is integer', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 120, 200, ''),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
      createMockResult('Service C', 'FAIL', 0, 500, 'Error'),
    ];

    const csvWriter = new CsvWriter(csvPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data lines
    const dataLines = lines.slice(1);

    const latencies = dataLines.map(line => {
      const values = parseCsvLine(line);
      return values[3]; // latency_ms column
    });

    expect(latencies[0]).toBe('120');
    expect(latencies[1]).toBe('2500');
    expect(latencies[2]).toBe('0');

    // Verify all latencies are valid integers
    for (const latency of latencies) {
      expect(latency).toBeDefined();
      expect(latency!).toMatch(/^\d+$/);
      expect(Number.isInteger(parseInt(latency!, 10))).toBe(true);
    }
  });

  test('validates http_status_code is integer', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 120, 200, ''),
      createMockResult('Service B', 'FAIL', 0, 500, 'Error'),
      createMockResult('Service C', 'FAIL', 0, 0, 'Connection refused'),
    ];

    const csvWriter = new CsvWriter(csvPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data lines
    const dataLines = lines.slice(1);

    const statusCodes = dataLines.map(line => {
      const values = parseCsvLine(line);
      return values[4]; // http_status_code column
    });

    expect(statusCodes[0]).toBe('200');
    expect(statusCodes[1]).toBe('500');
    expect(statusCodes[2]).toBe('0');

    // Verify all status codes are valid integers
    for (const code of statusCodes) {
      expect(code).toBeDefined();
      expect(code!).toMatch(/^\d+$/);
      expect(Number.isInteger(parseInt(code!, 10))).toBe(true);
    }
  });

  test('validates correlation_id is UUID v4', async () => {
    const result = createMockResult('Test Service', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // Last column is correlation_id
    const correlationId = values[6]!;

    expect(isValidUUIDv4(correlationId)).toBe(true);
    expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('validates empty failure_reason for passing services', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 120, 200, ''),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
    ];

    const csvWriter = new CsvWriter(csvPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data lines
    const dataLines = lines.slice(1);

    const failureReasons = dataLines.map(line => {
      const values = parseCsvLine(line);
      return values[5]; // failure_reason column
    });

    // Passing services should have empty failure reason
    expect(failureReasons[0]).toBe('');
    expect(failureReasons[1]).toBe('');
  });

  test('validates non-empty failure_reason for failed services', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'FAIL', 0, 500, 'Expected status 200, got 500'),
      createMockResult('Service B', 'FAIL', 0, 0, 'Connection timeout'),
    ];

    const csvWriter = new CsvWriter(csvPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data lines
    const dataLines = lines.slice(1);

    const failureReasons = dataLines.map(line => {
      const values = parseCsvLine(line);
      return values[5]; // failure_reason column
    });

    expect(failureReasons[0]).toBe('Expected status 200, got 500');
    expect(failureReasons[1]).toBe('Connection timeout');
  });

  test('RFC 4180: handles commas in service names', async () => {
    const result = createMockResult('Service with, commas', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line with RFC 4180 parser
    const dataLine = lines[1]!;
    const values = parseCsvLine(dataLine);

    // Service name should be preserved with commas
    const serviceName = values[1]!;
    expect(serviceName).toBe('Service with, commas');
  });

  test('RFC 4180: handles quotes in service names', async () => {
    const result = createMockResult('Service "with quotes"', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // Service name should preserve quotes
    const serviceName = values[1];
    expect(serviceName).toBe('Service "with quotes"');
  });

  test('RFC 4180: handles newlines in failure reasons', async () => {
    const result = createMockResult('Service A', 'FAIL', 0, 500, 'Error:\nLine 1\nLine 2');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');

    // For multiline values, CSV should use quoted values
    // Parser should correctly handle this
    expect(csvContent).toContain('Error:\nLine 1\nLine 2');
  });

  test('RFC 4180: handles special characters in failure reasons', async () => {
    const failureReason = 'Expected text "OK" not found; got "ERROR" instead';
    const result = createMockResult('Service A', 'FAIL', 0, 500, failureReason);

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // Failure reason should be preserved
    const parsedFailureReason = values[5];
    expect(parsedFailureReason).toBe(failureReason);
  });

  test('validates complete record structure', async () => {
    const result = createMockResult('Test Service', 'PASS', 120, 200, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // Verify all 7 columns present
    expect(values).toHaveLength(7);

    // Verify column order
    const [timestamp, serviceName, status, latency, httpCode, failureReason, correlationId] = values;

    expect(isValidISO8601(timestamp!)).toBe(true);
    expect(serviceName).toBe('Test Service');
    expect(status).toBe('PASS');
    expect(latency).toBe('120');
    expect(httpCode).toBe('200');
    expect(failureReason).toBe('');
    expect(isValidUUIDv4(correlationId!)).toBe(true);
  });

  test('handles batch writes correctly', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 100, 200, ''),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
      createMockResult('Service C', 'FAIL', 0, 500, 'Error'),
    ];

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.appendBatch(results);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Should have header + 3 data lines
    expect(lines).toHaveLength(4);

    // Verify header
    expect(lines[0]).toBe(CSV_HEADERS.join(','));

    // Verify all records are valid
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]!);
      expect(values).toHaveLength(7);

      // Validate each field
      expect(isValidISO8601(values[0]!)).toBe(true);
      expect(values[1]).toBeTruthy();
      expect(['PASS', 'DEGRADED', 'FAIL']).toContain(values[2]);
      expect(Number.isInteger(parseInt(values[3]!, 10))).toBe(true);
      expect(Number.isInteger(parseInt(values[4]!, 10))).toBe(true);
      expect(isValidUUIDv4(values[6]!)).toBe(true);
    }
  });

  test('handles sequential appends without duplicate headers', async () => {
    const csvWriter = new CsvWriter(csvPath);

    // First append
    await csvWriter.append(createMockResult('Service A', 'PASS', 100, 200, ''));

    // Second append
    await csvWriter.append(createMockResult('Service B', 'DEGRADED', 2500, 200, ''));

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Should have 1 header + 2 data lines
    expect(lines).toHaveLength(3);

    // First line should be header
    expect(lines[0]).toBe(CSV_HEADERS.join(','));

    // Subsequent lines should be data
    const dataLines = lines.slice(1);
    for (const line of dataLines) {
      // Should not contain header again
      expect(line).not.toBe(CSV_HEADERS.join(','));

      // Should be valid data
      const values = parseCsvLine(line);
      expect(values).toHaveLength(7);
    }
  });

  test('validates large dataset (100+ records)', async () => {
    const results: HealthCheckResult[] = [];

    for (let i = 0; i < 100; i++) {
      const status = i % 3 === 0 ? 'FAIL' : i % 3 === 1 ? 'DEGRADED' : 'PASS';
      results.push(createMockResult('Service ' + i, status, 100 + i, 200, ''));
    }

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.appendBatch(results);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Should have header + 100 data lines
    expect(lines).toHaveLength(101);

    // Verify all records are valid
    const dataLines = lines.slice(1);
    for (const line of dataLines) {
      const values = parseCsvLine(line);
      expect(values).toHaveLength(7);
      expect(isValidISO8601(values[0]!)).toBe(true);
      expect(isValidUUIDv4(values[6]!)).toBe(true);
    }
  });

  test('validates PENDING status is not written to CSV', async () => {
    // PENDING services should not appear in historical CSV
    // Per csv-writer.ts, PENDING is converted to FAIL in CSV
    const result = createMockResult('New Service', 'PENDING', 0, 0, '');

    const csvWriter = new CsvWriter(csvPath);
    await csvWriter.append(result);

    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    // Parse data line
    const dataLine = lines[1];
    expect(dataLine).toBeDefined();
    const values = parseCsvLine(dataLine!);

    // Status should be FAIL, not PENDING
    const status = values[2];
    expect(status).toBe('FAIL');
    expect(status).not.toBe('PENDING');
  });
});
