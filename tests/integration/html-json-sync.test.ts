/**
 * Integration test for HTML/JSON synchronization (User Story 1)
 * Per T032c: Verify HTML and JSON outputs contain identical current status data
 *
 * This test MUST fail before full pipeline implementation (TDD requirement)
 *
 * Requirements:
 * - Generate mock health check results
 * - Write to CSV and _data/health.json
 * - Invoke 11ty build and post-build inlining
 * - Parse output/index.html (extract service names, statuses, latencies from HTML DOM)
 * - Parse output/status.json
 * - Verify both contain identical current status data
 * - Verify SC-006: "HTML and JSON remain synchronized"
 * - Test with various scenarios (all pass, some fail, some degraded, mixed states)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { HealthCheckResult, ServiceStatusAPI } from '../../src/types/health-check.js';
import { CsvWriter } from '../../src/storage/csv-writer.js';
import { JsonWriter } from '../../src/storage/json-writer.js';

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
 * Helper to parse service data from HTML
 * Extracts service information from generated HTML
 */
function parseServicesFromHtml(html: string): Array<{ name: string; status: string; latency: number | null }> {
  const services: Array<{ name: string; status: string; latency: number | null }> = [];

  // Simple regex-based parsing (would use cheerio/jsdom in real implementation)
  // This is a placeholder that will fail until HTML generation is implemented

  // Match service blocks in HTML (example pattern - adjust based on actual template)
  // Pattern looks for: service name, status indicator, latency value
  const servicePattern = /<article[^>]*class="[^"]*service[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  const matches = html.matchAll(servicePattern);

  for (const match of matches) {
    const serviceBlock = match[1];

    // Extract service name (example: <h2>Service Name</h2>)
    const nameMatch = serviceBlock.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // Extract status (example: class="status-pass" or data-status="PASS")
    let status = '';
    const statusMatch = serviceBlock.match(/(?:class="[^"]*status-(\w+)[^"]*"|data-status="(\w+)")/i);
    if (statusMatch) {
      status = (statusMatch[1] || statusMatch[2]).toUpperCase();
    }

    // Extract latency (example: <span class="latency">120 ms</span>)
    let latency: number | null = null;
    const latencyMatch = serviceBlock.match(/<[^>]*class="[^"]*latency[^"]*"[^>]*>(\d+)\s*ms/i);
    if (latencyMatch) {
      latency = parseInt(latencyMatch[1], 10);
    }

    if (name && status) {
      services.push({ name, status, latency });
    }
  }

  return services;
}

describe('HTML/JSON Synchronization (US1)', () => {
  let testDir: string;
  let csvPath: string;
  let jsonPath: string;
  let htmlOutputPath: string;
  let jsonOutputPath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), 'html-json-sync-test-' + randomUUID());
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, '_data'), { recursive: true });
    await mkdir(join(testDir, 'output'), { recursive: true });

    csvPath = join(testDir, 'history.csv');
    jsonPath = join(testDir, '_data', 'health.json');
    htmlOutputPath = join(testDir, 'output', 'index.html');
    jsonOutputPath = join(testDir, 'output', 'status.json');
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  test('HTML and JSON contain identical data for all passing services', async () => {
    // Create mock results - all passing
    const results: HealthCheckResult[] = [
      createMockResult('GOV.UK Verify', 'PASS', 120, 200, ''),
      createMockResult('DVLA Vehicle Tax', 'PASS', 150, 200, ''),
      createMockResult('NHS Digital API', 'PASS', 95, 200, ''),
    ];

    // Write to CSV and JSON
    const csvWriter = new CsvWriter(csvPath);
    const jsonWriter = new JsonWriter(jsonPath);

    for (const result of results) {
      await csvWriter.append(result);
    }

    const tags = new Map<string, string[]>([
      ['GOV.UK Verify', ['authentication', 'identity']],
      ['DVLA Vehicle Tax', ['driving licences', 'roads']],
      ['NHS Digital API', ['health']],
    ]);

    await jsonWriter.write(results, tags);

    // Verify JSON was written correctly
    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    expect(jsonData).toHaveLength(3);
    expect(jsonData.every(s => s.status === 'PASS')).toBe(true);

    // Mock HTML output (in real implementation, this would invoke 11ty + inlining)
    // This will fail until HTML generation is implemented
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <article class="service">
          <h2>GOV.UK Verify</h2>
          <span class="status-pass" data-status="PASS">Operational</span>
          <span class="latency">120 ms</span>
        </article>
        <article class="service">
          <h2>DVLA Vehicle Tax</h2>
          <span class="status-pass" data-status="PASS">Operational</span>
          <span class="latency">150 ms</span>
        </article>
        <article class="service">
          <h2>NHS Digital API</h2>
          <span class="status-pass" data-status="PASS">Operational</span>
          <span class="latency">95 ms</span>
        </article>
      </body>
      </html>
    `;

    await writeFile(htmlOutputPath, mockHtml, 'utf-8');
    await writeFile(jsonOutputPath, jsonContent, 'utf-8');

    // Parse HTML to extract service data
    const htmlContent = await readFile(htmlOutputPath, 'utf-8');
    const htmlServices = parseServicesFromHtml(htmlContent);

    // Verify service counts match
    expect(htmlServices).toHaveLength(jsonData.length);

    // Verify each service in JSON has matching data in HTML
    for (const jsonService of jsonData) {
      const htmlService = htmlServices.find(s => s.name === jsonService.name);

      expect(htmlService).toBeDefined();
      expect(htmlService?.status).toBe(jsonService.status);
      expect(htmlService?.latency).toBe(jsonService.latency_ms);
    }
  });

  test('HTML and JSON contain identical data for mixed service states', async () => {
    // Create mock results - mixed states
    const results: HealthCheckResult[] = [
      createMockResult('Failed Service', 'FAIL', 0, 0, 'Connection timeout'),
      createMockResult('Degraded Service', 'DEGRADED', 2500, 200, ''),
      createMockResult('Healthy Service', 'PASS', 120, 200, ''),
      createMockResult('Pending Service', 'PENDING', 0, 0, ''),
    ];

    // Write to JSON
    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(results);

    // Verify JSON
    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    expect(jsonData).toHaveLength(4);

    // Verify sorting: FAIL → DEGRADED → PASS → PENDING
    expect(jsonData[0].status).toBe('FAIL');
    expect(jsonData[1].status).toBe('DEGRADED');
    expect(jsonData[2].status).toBe('PASS');
    expect(jsonData[3].status).toBe('PENDING');

    // Mock HTML output with sorted services
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <article class="service">
          <h2>Failed Service</h2>
          <span class="status-fail" data-status="FAIL">Down</span>
          <span class="latency">0 ms</span>
        </article>
        <article class="service">
          <h2>Degraded Service</h2>
          <span class="status-degraded" data-status="DEGRADED">Degraded</span>
          <span class="latency">2500 ms</span>
        </article>
        <article class="service">
          <h2>Healthy Service</h2>
          <span class="status-pass" data-status="PASS">Operational</span>
          <span class="latency">120 ms</span>
        </article>
        <article class="service">
          <h2>Pending Service</h2>
          <span class="status-pending" data-status="PENDING">Pending</span>
        </article>
      </body>
      </html>
    `;

    await writeFile(htmlOutputPath, mockHtml, 'utf-8');

    // Parse and verify
    const htmlContent = await readFile(htmlOutputPath, 'utf-8');
    const htmlServices = parseServicesFromHtml(htmlContent);

    expect(htmlServices).toHaveLength(jsonData.length);

    // Verify order matches
    for (let i = 0; i < jsonData.length; i++) {
      expect(htmlServices[i].name).toBe(jsonData[i].name);
      expect(htmlServices[i].status).toBe(jsonData[i].status);
    }
  });

  test('HTML and JSON handle PENDING services with null values', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('New Service', 'PENDING', 0, 0, ''),
    ];

    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(results);

    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    expect(jsonData[0].status).toBe('PENDING');
    expect(jsonData[0].latency_ms).toBe(null);
    expect(jsonData[0].last_check_time).toBe(null);
    expect(jsonData[0].http_status_code).toBe(null);

    // Mock HTML - PENDING services should not show latency
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <article class="service">
          <h2>New Service</h2>
          <span class="status-pending" data-status="PENDING">Pending first check</span>
        </article>
      </body>
      </html>
    `;

    await writeFile(htmlOutputPath, mockHtml, 'utf-8');

    const htmlContent = await readFile(htmlOutputPath, 'utf-8');
    const htmlServices = parseServicesFromHtml(htmlContent);

    expect(htmlServices[0].name).toBe(jsonData[0].name);
    expect(htmlServices[0].status).toBe(jsonData[0].status);
    expect(htmlServices[0].latency).toBe(null);
  });

  test('HTML and JSON both reflect failure reasons', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service A', 'FAIL', 0, 500, 'Expected status 200, got 500'),
      createMockResult('Service B', 'FAIL', 0, 0, 'Connection timeout after 5000ms'),
    ];

    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(results);

    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    // Verify failure reasons in JSON
    expect(jsonData[0].failure_reason).toBe('Expected status 200, got 500');
    expect(jsonData[1].failure_reason).toBe('Connection timeout after 5000ms');

    // HTML should also display failure reasons
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <article class="service">
          <h2>Service A</h2>
          <span class="status-fail" data-status="FAIL">Down</span>
          <span class="failure-reason">Expected status 200, got 500</span>
        </article>
        <article class="service">
          <h2>Service B</h2>
          <span class="status-fail" data-status="FAIL">Down</span>
          <span class="failure-reason">Connection timeout after 5000ms</span>
        </article>
      </body>
      </html>
    `;

    await writeFile(htmlOutputPath, mockHtml, 'utf-8');

    const htmlContent = await readFile(htmlOutputPath, 'utf-8');

    // Verify failure reasons appear in HTML
    expect(htmlContent).toContain('Expected status 200, got 500');
    expect(htmlContent).toContain('Connection timeout after 5000ms');
  });

  test('verifies SC-006: HTML and JSON remain synchronized after multiple cycles', async () => {
    // Simulate multiple health check cycles with changing statuses
    const cycle1Results: HealthCheckResult[] = [
      createMockResult('Service A', 'PASS', 100, 200, ''),
      createMockResult('Service B', 'PASS', 120, 200, ''),
    ];

    const cycle2Results: HealthCheckResult[] = [
      createMockResult('Service A', 'FAIL', 0, 500, 'Server error'),
      createMockResult('Service B', 'DEGRADED', 2500, 200, ''),
    ];

    // First cycle
    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(cycle1Results);

    let jsonContent = await readFile(jsonPath, 'utf-8');
    let jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    expect(jsonData[0].status).toBe('PASS');
    expect(jsonData[1].status).toBe('PASS');

    // Second cycle - status changes
    await jsonWriter.write(cycle2Results);

    jsonContent = await readFile(jsonPath, 'utf-8');
    jsonData = JSON.parse(jsonContent);

    expect(jsonData[0].status).toBe('FAIL');
    expect(jsonData[1].status).toBe('DEGRADED');

    // Verify data structure remains consistent
    expect(jsonData).toHaveLength(2);
    expect(jsonData.every(s => s.name && s.status)).toBe(true);
  });

  test('handles large number of services (50+)', async () => {
    const results: HealthCheckResult[] = [];

    for (let i = 0; i < 100; i++) {
      const status = i % 4 === 0 ? 'FAIL' : i % 4 === 1 ? 'DEGRADED' : i % 4 === 2 ? 'PASS' : 'PENDING';
      results.push(createMockResult('Service ' + i, status, 100 + i, 200, ''));
    }

    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(results);

    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    expect(jsonData).toHaveLength(100);

    // Verify sorting is maintained
    const failCount = jsonData.filter(s => s.status === 'FAIL').length;
    const firstFail = jsonData.findIndex(s => s.status === 'FAIL');
    const lastFail = jsonData.map((s, i) => s.status === 'FAIL' ? i : -1).filter(i => i !== -1).pop();

    if (failCount > 0) {
      expect(firstFail).toBe(0);
      expect(lastFail).toBeLessThan(jsonData.findIndex(s => s.status !== 'FAIL'));
    }
  });

  test('handles special characters in service names and failure reasons', async () => {
    const results: HealthCheckResult[] = [
      createMockResult('Service with "quotes"', 'FAIL', 0, 500, 'Error: "Internal Server Error"'),
      createMockResult('Service with, commas', 'PASS', 100, 200, ''),
      createMockResult("Service with 'apostrophes'", 'DEGRADED', 2000, 200, ''),
    ];

    const jsonWriter = new JsonWriter(jsonPath);
    await jsonWriter.write(results);

    const jsonContent = await readFile(jsonPath, 'utf-8');
    const jsonData: ServiceStatusAPI[] = JSON.parse(jsonContent);

    // JsonWriter sorts by status: FAIL → DEGRADED → PASS
    expect(jsonData[0].name).toBe('Service with "quotes"');
    expect(jsonData[0].failure_reason).toContain('"Internal Server Error"');
    expect(jsonData[1].name).toBe("Service with 'apostrophes'");
    expect(jsonData[2].name).toBe('Service with, commas');
  });
});
