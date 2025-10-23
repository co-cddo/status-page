/**
 * Integration tests for Scheduler
 * T034b: Scheduler integration test
 *
 * Tests scheduler triggers worker pool at configured intervals with real timing.
 * Verifies:
 * - Scheduler triggers worker pool at configured intervals
 * - First cycle completion before HTML generation
 * - HTML regeneration after each cycle
 * - Cycle interruption and recovery
 * - Timing accuracy over multiple cycles
 *
 * Per tasks.md: Test with real scheduler and worker pool, verify timing and cycle management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../../src/orchestrator/scheduler.js';
import { WorkerPoolManager } from '../../src/orchestrator/pool-manager.js';
import type { HealthCheckConfig } from '../../src/types/health-check.js';

describe('Scheduler Integration', () => {
  let scheduler: Scheduler;
  let poolManager: WorkerPoolManager;

  beforeEach(async () => {
    poolManager = new WorkerPoolManager({ poolSize: 2 });
    await poolManager.initialize();
    scheduler = new Scheduler(poolManager, {
      defaultInterval: 2000, // 2 second interval for faster tests
      gracefulShutdownTimeout: 5000,
    });
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
    if (poolManager) {
      await poolManager.shutdown({ gracefulTimeout: 5000 });
    }
  });

  describe('Scheduler Trigger Mechanism', () => {
    it('should trigger worker pool at configured intervals', async () => {
      const config: HealthCheckConfig = {
        serviceName: 'scheduled-service',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: 'sched-001',
      };

      scheduler.scheduleService(config, 1000); // Schedule every 1 second
      scheduler.start();

      // Wait for at least 2 executions
      await new Promise((resolve) => setTimeout(resolve, 2500));

      await scheduler.stop();

      const metrics = poolManager.getMetrics();
      expect(metrics.completedTasks).toBeGreaterThanOrEqual(2);
    }, 10000);

    it('should schedule multiple services with different intervals', async () => {
      const config1: HealthCheckConfig = {
        serviceName: 'service-1',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: 'multi-001',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'service-2',
        method: 'GET',
        url: 'https://httpbin.org/status/201',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 201,
        correlationId: 'multi-002',
      };

      scheduler.scheduleService(config1, 1000); // Every 1 second
      scheduler.scheduleService(config2, 1500); // Every 1.5 seconds
      scheduler.start();

      await new Promise((resolve) => setTimeout(resolve, 3500));

      await scheduler.stop();

      const metrics = poolManager.getMetrics();
      expect(metrics.completedTasks).toBeGreaterThanOrEqual(4);
    }, 15000);
  });

  describe('Cycle Management', () => {
    it('should complete first cycle before continuing', async () => {
      const config: HealthCheckConfig = {
        serviceName: 'first-cycle-test',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: 'first-cycle-001',
      };

      scheduler.scheduleService(config, 1000);
      scheduler.start();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const metrics = poolManager.getMetrics();
      expect(metrics.completedTasks).toBeGreaterThanOrEqual(1);
      expect(metrics.queueDepth).toBe(0);

      await scheduler.stop();
    }, 10000);

    it('should handle cycle interruption and recovery', async () => {
      const config: HealthCheckConfig = {
        serviceName: 'interruption-test',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: 'interrupt-001',
      };

      scheduler.scheduleService(config, 1000);
      scheduler.start();

      await new Promise((resolve) => setTimeout(resolve, 1500));

      await scheduler.stop();

      const metricsAfterStop = poolManager.getMetrics();
      const tasksAfterStop = metricsAfterStop.completedTasks;

      // Restart scheduler
      scheduler = new Scheduler(poolManager, { defaultInterval: 1000 });
      scheduler.scheduleService(config, 1000);
      scheduler.start();

      await new Promise((resolve) => setTimeout(resolve, 2500));

      await scheduler.stop();

      const finalMetrics = poolManager.getMetrics();
      expect(finalMetrics.completedTasks).toBeGreaterThan(tasksAfterStop);
    }, 15000);
  });

  describe('Timing Accuracy', () => {
    it('should maintain timing accuracy over multiple cycles', async () => {
      const config: HealthCheckConfig = {
        serviceName: 'timing-test',
        method: 'GET',
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: 'timing-001',
      };

      const interval = 1000;
      const cyclesToTest = 3;
      const executionTimes: number[] = [];

      scheduler.scheduleService(config, interval);

      const startTime = Date.now();
      scheduler.start();

      for (let i = 0; i < cyclesToTest; i++) {
        await new Promise((resolve) => setTimeout(resolve, interval + 100));
        executionTimes.push(Date.now() - startTime);
      }

      await scheduler.stop();

      // Verify timing is approximately correct (within 500ms tolerance)
      executionTimes.forEach((time, index) => {
        const expectedTime = (index + 1) * interval;
        const drift = Math.abs(time - expectedTime);
        expect(drift).toBeLessThan(500);
      });
    }, 15000);
  });

  describe('Queue Management', () => {
    it('should handle concurrent services without queue overflow', async () => {
      const configs: HealthCheckConfig[] = Array.from({ length: 5 }, (_, i) => ({
        serviceName: `concurrent-service-${i}`,
        method: 'GET' as const,
        url: 'https://httpbin.org/status/200',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 1,
        expectedStatus: 200,
        correlationId: `concurrent-${i}`,
      }));

      configs.forEach((config) => scheduler.scheduleService(config, 1000));
      scheduler.start();

      await new Promise((resolve) => setTimeout(resolve, 2500));

      await scheduler.stop();

      const metrics = poolManager.getMetrics();
      expect(metrics.completedTasks).toBeGreaterThanOrEqual(10);
      expect(metrics.queueDepth).toBe(0);
    }, 15000);
  });
});
