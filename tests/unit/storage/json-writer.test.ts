/**
 * Unit test for JSON writer (User Story 1 - Phase 4A)
 * Per T032a: Test write _data/health.json from HealthCheckResult array,
 * mapping to ServiceStatusAPI format (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason),
 * sorting (FAIL → DEGRADED → PASS → PENDING), null values for PENDING services,
 * exit with non-zero on write failure, verify JSON structure matches OpenAPI schema
 *
 * This test MUST fail before T032 implementation (TDD requirement)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { JsonWriter } from '../../../src/storage/json-writer.ts';
import type { HealthCheckResult, ServiceStatusAPI } from '../../../src/types/health-check.ts';

describe('JsonWriter (T032a - TDD Phase)', () => {
  const testDir = path.join(__dirname, 'test-json-data');
  const testJsonPath = path.join(testDir, 'test-health.json');
  let jsonWriter: JsonWriter;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    jsonWriter = new JsonWriter(testJsonPath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Write _data/health.json from HealthCheckResult Array', () => {
    test('should write JSON file from health check results', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const fileExists = await fs
        .access(testJsonPath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });

    test('should create valid JSON structure', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed)).toBe(true);
    });

    test('should write multiple services', async () => {
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
          timestamp: new Date('2025-01-01T12:01:00.000Z'),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Internal Server Error',
          correlation_id: 'id-2',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed.length).toBe(2);
    });
  });

  describe('Mapping to ServiceStatusAPI Format', () => {
    test('should map name field correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Example Service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('Example Service');
    });

    test('should map status field correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'DEGRADED',
          latency_ms: 2500,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.status).toBe('DEGRADED');
    });

    test('should map latency_ms field correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 245,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.latency_ms).toBe(245);
    });

    test('should map last_check_time as ISO 8601 string', async () => {
      const timestamp = new Date('2025-01-01T12:34:56.789Z');
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp,
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.last_check_time).toBe('2025-01-01T12:34:56.789Z');
    });

    test('should include tags array (empty if no tags)', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.tags).toBeDefined();
      expect(Array.isArray(parsed[0]?.tags)).toBe(true);
      expect(parsed[0]?.tags.length).toBe(0);
    });

    test('should map http_status_code field correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 404,
          expected_status: 200,
          failure_reason: 'Not Found',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.http_status_code).toBe(404);
    });

    test('should map failure_reason field correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Connection timeout',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.failure_reason).toBe('Connection timeout');
    });

    test('should have empty failure_reason for passing services', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.failure_reason).toBe('');
    });

    test('should map resource field correctly when provided', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      const resources = new Map([['test-service', 'https://example.com/test']]);

      await jsonWriter.write(results, undefined, resources);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.resource).toBe('https://example.com/test');
    });

    test('should have empty resource field when not provided', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.resource).toBe('');
    });
  });

  describe('Sorting (FAIL → DEGRADED → PASS → PENDING)', () => {
    test('should sort FAIL services first', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pass-service',
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
          serviceName: 'fail-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Error',
          correlation_id: 'id-2',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('fail-service');
      expect(parsed[1]?.name).toBe('pass-service');
    });

    test('should sort DEGRADED services second', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pass-service',
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
          serviceName: 'degraded-service',
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
          serviceName: 'fail-service',
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

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('fail-service');
      expect(parsed[1]?.name).toBe('degraded-service');
      expect(parsed[2]?.name).toBe('pass-service');
    });

    test('should sort PENDING services last', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pending-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-1',
        },
        {
          serviceName: 'pass-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-2',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('pass-service');
      expect(parsed[1]?.name).toBe('pending-service');
    });

    test('should maintain complete sort order (FAIL → DEGRADED → PASS → PENDING)', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pending',
          timestamp: new Date(),
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-1',
        },
        {
          serviceName: 'pass',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-2',
        },
        {
          serviceName: 'degraded',
          timestamp: new Date(),
          method: 'GET',
          status: 'DEGRADED',
          latency_ms: 2500,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'id-3',
        },
        {
          serviceName: 'fail',
          timestamp: new Date(),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 0,
          http_status_code: 500,
          expected_status: 200,
          failure_reason: 'Error',
          correlation_id: 'id-4',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('fail');
      expect(parsed[1]?.name).toBe('degraded');
      expect(parsed[2]?.name).toBe('pass');
      expect(parsed[3]?.name).toBe('pending');
    });
  });

  describe('Null Values for PENDING Services', () => {
    test('should set latency_ms to null for PENDING services', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pending-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.latency_ms).toBeNull();
    });

    test('should set last_check_time to null for PENDING services', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pending-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.last_check_time).toBeNull();
    });

    test('should set http_status_code to null for PENDING services', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pending-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PENDING',
          latency_ms: 0,
          http_status_code: 0,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.http_status_code).toBeNull();
    });

    test('should NOT set null values for non-PENDING services', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'pass-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.latency_ms).not.toBeNull();
      expect(parsed[0]?.last_check_time).not.toBeNull();
      expect(parsed[0]?.http_status_code).not.toBeNull();
    });
  });

  describe('Write Failure Handling', () => {
    test('should throw error on write failure (permissions)', async () => {
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      const readOnlyJsonPath = path.join(readOnlyDir, 'test.json');
      const readOnlyWriter = new JsonWriter(readOnlyJsonPath);

      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await expect(readOnlyWriter.write(results)).rejects.toThrow();

      // Clean up
      await fs.chmod(readOnlyDir, 0o755);
    });

    test('should provide descriptive error message on failure', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist/test.json';
      const invalidWriter = new JsonWriter(invalidPath);

      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      try {
        await invalidWriter.write(results);
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
    });
  });

  describe('JSON Structure Matches OpenAPI Schema', () => {
    test('should have all required ServiceStatusAPI fields', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);
      const service = parsed[0]!;

      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('latency_ms');
      expect(service).toHaveProperty('last_check_time');
      expect(service).toHaveProperty('tags');
      expect(service).toHaveProperty('http_status_code');
      expect(service).toHaveProperty('failure_reason');
      expect(service).toHaveProperty('resource');
    });

    test('should have correct field types per OpenAPI schema', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date('2025-01-01T12:00:00.000Z'),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);
      const service = parsed[0]!;

      expect(typeof service.name).toBe('string');
      expect(['PENDING', 'PASS', 'DEGRADED', 'FAIL']).toContain(service.status);
      expect(typeof service.latency_ms).toBe('number');
      expect(typeof service.last_check_time).toBe('string');
      expect(Array.isArray(service.tags)).toBe(true);
      expect(typeof service.http_status_code).toBe('number');
      expect(typeof service.failure_reason).toBe('string');
    });

    test('should format JSON with pretty printing (2 spaces)', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'test-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');

      // Pretty printed JSON should have indentation
      expect(content).toContain('  ');
      expect(content.split('\n').length).toBeGreaterThan(5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty results array', async () => {
      const results: HealthCheckResult[] = [];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed).toEqual([]);
    });

    test('should handle very long service names', async () => {
      const longName = 'a'.repeat(1000);
      const results: HealthCheckResult[] = [
        {
          serviceName: longName,
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe(longName);
    });

    test('should handle large number of services (100+)', async () => {
      const results: HealthCheckResult[] = Array.from({ length: 100 }, (_, i) => ({
        serviceName: `service-${i}`,
        timestamp: new Date(),
        method: 'GET' as const,
        status: 'PASS' as const,
        latency_ms: 100 + i,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: `id-${i}`,
      }));

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed.length).toBe(100);
    });

    test('should handle special characters in service names', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'Service with "quotes" and \'apostrophes\'',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 120,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'test-id',
        },
      ];

      await jsonWriter.write(results);

      const content = await fs.readFile(testJsonPath, 'utf-8');
      const parsed: ServiceStatusAPI[] = JSON.parse(content);

      expect(parsed[0]?.name).toBe('Service with "quotes" and \'apostrophes\'');
    });
  });
});
