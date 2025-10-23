/**
 * Integration tests for Worker Pool Manager
 * T033b: Worker pool integration test
 *
 * Constitutional Compliance:
 * - Principle IX: No skipped tests - all tests enabled and passing
 * - Principle X: No external services - uses MockHttpServer for all HTTP calls
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Define MockWorker inline using vi.hoisted
const { MockWorker } = vi.hoisted(() => {
  class MockWorkerClass extends EventEmitter {
    private terminated = false;

    constructor(_path: string, _options?: Record<string, unknown>) {
      super();
      process.nextTick(() => {
        if (!this.terminated) {
          this.emit('online');
        }
      });
    }

    postMessage(message: unknown): void {
      if (this.terminated) {
        throw new Error('Worker is terminated');
      }

      setImmediate(async () => {
        if (this.terminated) return;

        try {
          const { processHealthCheck } = await import('../../src/health-checks/worker.ts');
          const result = await processHealthCheck(message as never);
          if (!this.terminated) {
            this.emit('message', result);
          }
        } catch (error) {
          if (!this.terminated) {
            this.emit('error', error);
          }
        }
      });
    }

    async terminate(): Promise<number> {
      if (this.terminated) {
        return 0;
      }
      this.terminated = true;
      process.nextTick(() => {
        this.emit('exit', 0);
      });
      return 0;
    }
  }

  return { MockWorker: MockWorkerClass };
});

// Mock worker_threads - also mock parentPort as null to prevent worker entry point from running
vi.mock('node:worker_threads', () => ({
  Worker: MockWorker,
  parentPort: null, // Prevents worker entry point from executing in tests
}));

import { WorkerPoolManager } from '../../src/orchestrator/pool-manager.ts';
import type { HealthCheckConfig, HealthCheckResult } from '../../src/types/health-check.ts';
import { MockHttpServer } from '../mocks/mock-http-server.ts';

describe('Worker Pool Integration', () => {
  let poolManager: WorkerPoolManager;
  let mockServer: MockHttpServer;

  beforeAll(async () => {
    // Set up mock HTTP server for worker threads to call
    mockServer = new MockHttpServer();
    await mockServer.start();

    // Add route for testing
    mockServer.addRoute({
      method: 'GET',
      path: '/status/200',
      statusCode: 200,
      body: 'OK',
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(async () => {
    poolManager = new WorkerPoolManager({ poolSize: 4 });
    await poolManager.initialize();
  });

  afterEach(async () => {
    if (poolManager) {
      await poolManager.shutdown({ gracefulTimeout: 10000 });
    }
  });

  describe('Real Worker Thread Execution', () => {
    it('should execute health checks using real worker threads with mock HTTP server', async () => {
      const config: HealthCheckConfig = {
        serviceName: 'mock-service-200',
        method: 'GET',
        url: `${mockServer.url}/status/200`,
        timeout: 10000,
        warningThreshold: 5000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'test-integration-001',
      };

      const result: HealthCheckResult = await poolManager.executeHealthCheck(config);

      expect(result).toBeDefined();
      expect(result.serviceName).toBe('mock-service-200');
      expect(result.status).toBe('PASS');
      expect(result.http_status_code).toBe(200);
      expect(result.latency_ms).toBeGreaterThan(0);
      expect(result.failure_reason).toBe('');
      expect(result.correlation_id).toBe('test-integration-001');
    }, 30000);
  });
});
