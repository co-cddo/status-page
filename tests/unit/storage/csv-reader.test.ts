/**
 * Unit test for CSV reader (User Story 1 - Phase 4A)
 * Per T031a: Test read history.csv, format validation (headers present, parse sample rows),
 * consecutive failure derivation (count consecutive FAIL statuses per service from recent records),
 * handling of corrupted CSV (log error, emit alert, return validation errors),
 * verify fallback to next tier on corruption, test empty CSV file handling
 *
 * This test MUST fail before T031 implementation (TDD requirement)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CsvReader,
  type CsvValidationResult,
  type ConsecutiveFailures,
} from '../../../src/storage/csv-reader.ts';
import type { HistoricalRecord } from '../../../src/types/health-check.ts';

describe('CsvReader (T031a - TDD Phase)', () => {
  const testDir = path.join(__dirname, 'test-csv-data');
  const testCsvPath = path.join(testDir, 'test-history.csv');
  let csvReader: CsvReader;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    csvReader = new CsvReader(testCsvPath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Read history.csv', () => {
    test('should read and parse valid CSV file', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
2025-01-01T12:01:00.000Z,service-2,DEGRADED,2500,200,,id-2
2025-01-01T12:02:00.000Z,service-3,FAIL,0,500,Internal Server Error,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records).toBeDefined();
      expect(records.length).toBe(3);
      expect(records[0]?.service_name).toBe('service-1');
      expect(records[1]?.service_name).toBe('service-2');
      expect(records[2]?.service_name).toBe('service-3');
    });

    test('should parse ISO 8601 timestamps correctly', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:34:56.789Z,test-service,PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.timestamp).toBe('2025-01-01T12:34:56.789Z');
    });

    test('should parse status values (PASS/DEGRADED/FAIL)', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
2025-01-01T12:01:00.000Z,service-2,DEGRADED,2500,200,,id-2
2025-01-01T12:02:00.000Z,service-3,FAIL,0,500,Error,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.status).toBe('PASS');
      expect(records[1]?.status).toBe('DEGRADED');
      expect(records[2]?.status).toBe('FAIL');
    });

    test('should parse latency_ms as integer', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,PASS,123,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.latency_ms).toBe(123);
      expect(typeof records[0]?.latency_ms).toBe('number');
    });

    test('should parse http_status_code as integer', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,FAIL,0,404,Not Found,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.http_status_code).toBe(404);
      expect(typeof records[0]?.http_status_code).toBe('number');
    });

    test('should handle empty failure_reason for passing checks', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.failure_reason).toBe('');
    });

    test('should preserve failure_reason text for failed checks', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,FAIL,0,500,Connection timeout,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.failure_reason).toBe('Connection timeout');
    });

    test('should parse UUID correlation_id', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,PASS,120,200,,550e8400-e29b-41d4-a716-446655440000`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.correlation_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(records[0]?.correlation_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('should handle large CSV files efficiently', async () => {
      // Generate 1000 records
      const records = ['timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id'];
      for (let i = 0; i < 1000; i++) {
        const timestamp = new Date(2025, 0, 1, 12, i % 60, i % 60).toISOString();
        records.push(`${timestamp},service-${i % 10},PASS,${100 + i},200,,id-${i}`);
      }

      await fs.writeFile(testCsvPath, records.join('\n'), 'utf-8');

      const startTime = Date.now();
      const parsedRecords = await csvReader.readAll();
      const duration = Date.now() - startTime;

      expect(parsedRecords.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Format Validation', () => {
    test('should validate CSV headers are present', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(true);
      expect(validation.hasHeaders).toBe(true);
    });

    test('should fail validation when headers are missing', async () => {
      const csvContent = `2025-01-01T12:00:00.000Z,test-service,PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.hasHeaders).toBe(false);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors!.length).toBeGreaterThan(0);
      expect(validation.errors![0]).toContain('header');
    });

    test('should fail validation when headers are in wrong order', async () => {
      const csvContent = `service_name,timestamp,status,latency_ms,http_status_code,failure_reason,correlation_id
test-service,2025-01-01T12:00:00.000Z,PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors![0]).toContain('order');
    });

    test('should validate sample rows can be parsed', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
2025-01-01T12:01:00.000Z,service-2,DEGRADED,2500,200,,id-2
2025-01-01T12:02:00.000Z,service-3,FAIL,0,500,Error,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(true);
      expect(validation.sampleRowsParsed).toBe(true);
    });

    test('should detect malformed rows', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
this,is,not,valid,data
2025-01-01T12:02:00.000Z,service-3,FAIL,0,500,Error,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors!.some(e => e.includes('malformed'))).toBe(true);
    });

    test('should validate column count matches headers', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200
2025-01-01T12:01:00.000Z,service-2,DEGRADED,2500,200,,id-2`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors!.some(e => e.includes('column'))).toBe(true);
    });
  });

  describe('Consecutive Failure Derivation (FR-015a)', () => {
    test('should count consecutive FAIL statuses for a service', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
2025-01-01T12:01:00.000Z,service-1,FAIL,0,500,Error 1,id-2
2025-01-01T12:02:00.000Z,service-1,FAIL,0,500,Error 2,id-3
2025-01-01T12:03:00.000Z,service-1,FAIL,0,500,Error 3,id-4`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      expect(failures['service-1']).toBe(3);
    });

    test('should reset count when service returns to PASS', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,FAIL,0,500,Error 1,id-1
2025-01-01T12:01:00.000Z,service-1,FAIL,0,500,Error 2,id-2
2025-01-01T12:02:00.000Z,service-1,PASS,120,200,,id-3
2025-01-01T12:03:00.000Z,service-1,FAIL,0,500,Error 3,id-4`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      expect(failures['service-1']).toBe(1);
    });

    test('should handle multiple services independently', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,FAIL,0,500,Error,id-1
2025-01-01T12:01:00.000Z,service-2,FAIL,0,500,Error,id-2
2025-01-01T12:02:00.000Z,service-1,FAIL,0,500,Error,id-3
2025-01-01T12:03:00.000Z,service-2,PASS,120,200,,id-4
2025-01-01T12:04:00.000Z,service-1,FAIL,0,500,Error,id-5`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      expect(failures['service-1']).toBe(3);
      expect(failures['service-2']).toBe(0);
    });

    test('should count from most recent records only', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,FAIL,0,500,Old Error,id-1
2025-01-01T12:01:00.000Z,service-1,FAIL,0,500,Old Error,id-2
2025-01-01T12:02:00.000Z,service-1,PASS,120,200,,id-3
2025-01-01T12:03:00.000Z,service-1,FAIL,0,500,Recent Error,id-4
2025-01-01T12:04:00.000Z,service-1,FAIL,0,500,Recent Error,id-5`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      expect(failures['service-1']).toBe(2);
    });

    test('should not count DEGRADED as failure', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,FAIL,0,500,Error,id-1
2025-01-01T12:01:00.000Z,service-1,DEGRADED,2500,200,,id-2
2025-01-01T12:02:00.000Z,service-1,FAIL,0,500,Error,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      // DEGRADED breaks the consecutive failure chain
      expect(failures['service-1']).toBe(1);
    });

    test('should return 0 for services with no failures', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,120,200,,id-1
2025-01-01T12:01:00.000Z,service-1,PASS,150,200,,id-2
2025-01-01T12:02:00.000Z,service-1,DEGRADED,2500,200,,id-3`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const failures: ConsecutiveFailures = await csvReader.getConsecutiveFailures();

      expect(failures['service-1']).toBe(0);
    });
  });

  describe('Corrupted CSV Handling', () => {
    test('should detect and report corrupted CSV', async () => {
      const csvContent = `This is not a valid CSV file at all`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.corrupted).toBe(true);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });

    test('should log error for corrupted CSV', async () => {
      const csvContent = `timestamp,service_name,status
CORRUPTED DATA HERE`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.corrupted).toBe(true);
      // Implementation should log error with correlation ID
    });

    test('should return validation errors for corrupted CSV', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,service-1,PASS,NOT_A_NUMBER,200,,id-1`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeTruthy();
      expect(validation.errors!.some(e => e.includes('latency'))).toBe(true);
    });

    test('should emit alert for corrupted CSV', async () => {
      const csvContent = `CORRUPTED`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.corrupted).toBe(true);
      expect(validation.alertEmitted).toBe(true);
    });

    test('should suggest fallback to next tier on corruption', async () => {
      const csvContent = `CORRUPTED DATA`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.fallbackSuggested).toBe(true);
      expect(validation.suggestedAction).toContain('next tier');
    });
  });

  describe('Empty CSV File Handling', () => {
    test('should handle empty CSV file', async () => {
      await fs.writeFile(testCsvPath, '', 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records).toBeDefined();
      expect(records.length).toBe(0);
    });

    test('should validate empty CSV as invalid (no headers)', async () => {
      await fs.writeFile(testCsvPath, '', 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(false);
      expect(validation.empty).toBe(true);
    });

    test('should handle CSV with headers only (no data)', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records.length).toBe(0);
    });

    test('should validate CSV with headers only as valid', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const validation: CsvValidationResult = await csvReader.validate();

      expect(validation.valid).toBe(true);
      expect(validation.hasHeaders).toBe(true);
      expect(validation.empty).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle CSV with RFC 4180 escaped commas', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,"service, with, commas",PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.service_name).toBe('service, with, commas');
    });

    test('should handle CSV with RFC 4180 escaped quotes', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,FAIL,0,500,"Error with ""quotes"" in message",test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.failure_reason).toBe('Error with "quotes" in message');
    });

    test('should handle CSV with newlines in quoted fields', async () => {
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,test-service,FAIL,0,500,"Error on
line 1
and line 2",test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.failure_reason).toBe('Error on\nline 1\nand line 2');
    });

    test('should handle missing CSV file gracefully', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.csv');
      const reader = new CsvReader(nonExistentPath);

      await expect(reader.readAll()).rejects.toThrow();
    });

    test('should handle very long service names', async () => {
      const longName = 'a'.repeat(1000);
      const csvContent = `timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-01-01T12:00:00.000Z,"${longName}",PASS,120,200,,test-id`;

      await fs.writeFile(testCsvPath, csvContent, 'utf-8');

      const records: HistoricalRecord[] = await csvReader.readAll();

      expect(records[0]?.service_name).toBe(longName);
    });
  });
});
