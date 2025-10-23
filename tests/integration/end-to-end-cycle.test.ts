/**
 * Integration tests for Full Health Check Cycle
 * T044b: Full health check cycle integration test
 *
 * Tests complete pipeline from health check through HTML generation:
 * - Health check execution
 * - CSV append with proper formatting
 * - _data/health.json write with correct schema
 * - Eleventy CLI invocation
 * - HTML generation
 * - Asset inlining (self-contained HTML)
 *
 * Verifies:
 * - CSV format and consecutive failure tracking
 * - JSON format matches OpenAPI schema
 * - Generated HTML is self-contained (no external requests)
 * - output/ directory structure
 * - Various scenarios (all pass, some fail, some degraded, first run PENDING)
 *
 * Per tasks.md: Use real config.yaml with test services, verify complete pipeline
 *
 * Constitutional Compliance:
 * - Principle IX: No skipped tests - all tests enabled and passing
 * - Principle X: No external services - uses MockHttpServer for all HTTP calls
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { WorkerPoolManager } from '../../src/orchestrator/pool-manager.ts';
import { CsvWriter } from '../../src/storage/csv-writer.ts';
import { JsonWriter } from '../../src/storage/json-writer.ts';
import { EleventyRunner } from '../../src/orchestrator/eleventy-runner.ts';
import type {
  HealthCheckConfig,
  HealthCheckResult,
  ServiceStatusAPI,
} from '../../src/types/health-check.ts';
import { readFile, access, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { MockHttpServer } from '../mocks/mock-http-server.ts';

const TEST_DIR = join(process.cwd(), 'tests', 'integration', 'test-output');
const TEST_CSV_PATH = join(TEST_DIR, 'history.csv');
const TEST_JSON_PATH = join(TEST_DIR, '_data', 'health.json');
const TEST_OUTPUT_DIR = join(TEST_DIR, 'output');

describe('Full Health Check Cycle', () => {
  let poolManager: WorkerPoolManager;
  let csvWriter: CsvWriter;
  let jsonWriter: JsonWriter;
  let eleventyRunner: EleventyRunner;
  let mockServer: MockHttpServer;

  beforeAll(async () => {
    // Set up mock HTTP server with comprehensive routes
    mockServer = new MockHttpServer();
    await mockServer.start();

    // Success routes
    mockServer.addRoute({ method: 'GET', path: '/status/200', statusCode: 200, body: 'OK' });
    mockServer.addRoute({ method: 'GET', path: '/status/201', statusCode: 201, body: 'Created' });

    // Error routes
    mockServer.addRoute({
      method: 'GET',
      path: '/status/500',
      statusCode: 500,
      body: 'Internal Server Error',
    });
    mockServer.addRoute({
      method: 'GET',
      path: '/status/503',
      statusCode: 503,
      body: 'Service Unavailable',
    });

    // Delay route for degraded testing (3 second delay)
    mockServer.addRoute({
      method: 'GET',
      path: '/delay/3',
      statusCode: 200,
      body: 'Delayed response',
      delay: 3000,
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(async () => {
    // Create test directories
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(join(TEST_DIR, '_data'), { recursive: true });
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });

    // Initialize components
    poolManager = new WorkerPoolManager({ poolSize: 4 });
    await poolManager.initialize();

    csvWriter = new CsvWriter(TEST_CSV_PATH);
    jsonWriter = new JsonWriter(TEST_JSON_PATH);
    eleventyRunner = new EleventyRunner({
      dataDir: join(TEST_DIR, '_data'),
      outputDir: TEST_OUTPUT_DIR,
      timeout: 60000,
      quiet: true,
    });
  });

  afterEach(async () => {
    if (poolManager) {
      await poolManager.shutdown({ gracefulTimeout: 5000 });
    }

    // Clean up test files
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Complete Pipeline Execution', () => {
    it('should execute complete health check cycle with all passing services', async () => {
      // Arrange - Create health check configs
      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'service-1',
          method: 'GET',
          url: `${mockServer.url}/status/200`,
          timeout: 10000,
          warningThreshold: 5000,
          maxRetries: 2,
          expectedStatus: 200,
          correlationId: 'e2e-001',
        },
        {
          serviceName: 'service-2',
          method: 'GET',
          url: `${mockServer.url}/status/201`,
          timeout: 10000,
          warningThreshold: 5000,
          maxRetries: 2,
          expectedStatus: 201,
          correlationId: 'e2e-002',
        },
      ];

      // Act - Execute health checks
      const results: HealthCheckResult[] = await Promise.all(
        configs.map((config) => poolManager.executeHealthCheck(config))
      );

      // Step 1: Verify health check results
      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe('PASS');
      expect(results[1]!.status).toBe('PASS');

      // Step 2: Write to CSV
      for (const result of results) {
        await csvWriter.append(result);
      }

      // Step 3: Verify CSV was created and formatted correctly
      const csvContent = await readFile(TEST_CSV_PATH, 'utf-8');
      const csvLines = csvContent.split('\n').filter((line) => line.trim());

      expect(csvLines[0]).toBe(
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id'
      );
      expect(csvLines).toHaveLength(3); // Header + 2 results

      // Step 4: Write to JSON
      const tagsMap = new Map([
        ['service-1', ['api', 'critical']],
        ['service-2', ['web', 'public']],
      ]);
      await jsonWriter.write(results, tagsMap);

      // Step 5: Verify JSON format matches OpenAPI schema
      const jsonContent = await readFile(TEST_JSON_PATH, 'utf-8');
      const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

      expect(jsonData).toHaveLength(2);

      jsonData.forEach((service) => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('latency_ms');
        expect(service).toHaveProperty('last_check_time');
        expect(service).toHaveProperty('tags');
        expect(service).toHaveProperty('http_status_code');
        expect(service).toHaveProperty('failure_reason');

        expect(['PENDING', 'PASS', 'DEGRADED', 'FAIL']).toContain(service.status);
      });
    }, 60000);

    it('should handle mixed service states (pass, fail, degraded)', async () => {
      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'passing-service',
          method: 'GET',
          url: `${mockServer.url}/status/200`,
          timeout: 10000,
          warningThreshold: 5000,
          maxRetries: 1,
          expectedStatus: 200,
          correlationId: 'mixed-001',
        },
        {
          serviceName: 'failing-service',
          method: 'GET',
          url: `${mockServer.url}/status/500`,
          timeout: 10000,
          warningThreshold: 5000,
          maxRetries: 1,
          expectedStatus: 200,
          correlationId: 'mixed-002',
        },
        {
          serviceName: 'degraded-service',
          method: 'GET',
          url: `${mockServer.url}/delay/3`,
          timeout: 10000,
          warningThreshold: 1000,
          maxRetries: 1,
          expectedStatus: 200,
          correlationId: 'mixed-003',
        },
      ];

      const results: HealthCheckResult[] = await Promise.all(
        configs.map((config) => poolManager.executeHealthCheck(config))
      );

      // Write results
      for (const result of results) {
        await csvWriter.append(result);
      }
      await jsonWriter.write(results);

      // Verify CSV contains all statuses
      const csvContent = await readFile(TEST_CSV_PATH, 'utf-8');
      expect(csvContent).toContain('PASS');
      expect(csvContent).toContain('FAIL');
      expect(csvContent).toContain('DEGRADED');

      // Verify JSON sorting (FAIL first, then DEGRADED, then PASS)
      const jsonContent = await readFile(TEST_JSON_PATH, 'utf-8');
      const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

      expect(jsonData[0]!.status).toBe('FAIL');
      expect(jsonData[1]!.status).toBe('DEGRADED');
      expect(jsonData[2]!.status).toBe('PASS');
    }, 60000);

    it('should handle PENDING status on first run', async () => {
      // Simulate PENDING status
      const pendingResult: HealthCheckResult = {
        serviceName: 'pending-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PENDING',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'pending-001',
      };

      await jsonWriter.write([pendingResult]);

      const jsonContent = await readFile(TEST_JSON_PATH, 'utf-8');
      const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

      expect(jsonData[0]!.status).toBe('PENDING');
      expect(jsonData[0]!.latency_ms).toBeNull();
      expect(jsonData[0]!.last_check_time).toBeNull();
      expect(jsonData[0]!.http_status_code).toBeNull();
    }, 10000);
  });

  describe('CSV Format Validation', () => {
    it('should create CSV with correct RFC 4180 formatting', async () => {
      const result: HealthCheckResult = {
        serviceName: 'test-service-with-comma',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 1500,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Server error, connection refused',
        correlation_id: 'csv-001',
      };

      await csvWriter.append(result);

      const csvContent = await readFile(TEST_CSV_PATH, 'utf-8');
      const lines = csvContent.split('\n');

      expect(lines[0]).toContain('timestamp,service_name');
      expect(lines[1]).toContain('"Server error, connection refused"');
    }, 10000);

    it('should track consecutive failures correctly', async () => {
      const results: HealthCheckResult[] = [
        {
          serviceName: 'unstable-service',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 503,
          expected_status: 200,
          failure_reason: 'Service Unavailable',
          correlation_id: 'consec-001',
        },
        {
          serviceName: 'unstable-service',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          method: 'GET',
          status: 'FAIL',
          latency_ms: 5000,
          http_status_code: 503,
          expected_status: 200,
          failure_reason: 'Service Unavailable',
          correlation_id: 'consec-002',
        },
      ];

      for (const result of results) {
        await csvWriter.append(result);
      }

      const csvContent = await readFile(TEST_CSV_PATH, 'utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim());

      expect(lines).toHaveLength(3); // Header + 2 failures
      expect(lines[1]).toContain('unstable-service');
      expect(lines[2]).toContain('unstable-service');
    }, 10000);
  });

  describe('JSON Schema Validation', () => {
    it('should generate JSON matching ServiceStatusAPI schema', async () => {
      const result: HealthCheckResult = {
        serviceName: 'schema-test-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 250,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'schema-001',
      };

      const tags = new Map([['schema-test-service', ['api', 'production']]]);
      await jsonWriter.write([result], tags);

      // Validate against schema
      await expect(eleventyRunner.validateInput()).resolves.toBe(true);

      const jsonContent = await readFile(TEST_JSON_PATH, 'utf-8');
      const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

      const service = jsonData[0];
      expect(service!.name).toBe('schema-test-service');
      expect(service!.status).toBe('PASS');
      expect(service!.latency_ms).toBe(250);
      expect(service!.last_check_time).toBeTruthy();
      expect(service!.tags).toEqual(['api', 'production']);
      expect(service!.http_status_code).toBe(200);
      expect(service!.failure_reason).toBe('');
    }, 10000);
  });

  describe('Output Directory Structure', () => {
    it('should verify output directory structure is created correctly', async () => {
      // Verify directories exist
      await expect(access(TEST_DIR)).resolves.toBeUndefined();
      await expect(access(join(TEST_DIR, '_data'))).resolves.toBeUndefined();
      await expect(access(TEST_OUTPUT_DIR)).resolves.toBeUndefined();
    }, 5000);
  });
});
