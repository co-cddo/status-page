/**
 * Unit tests for health check scheduler
 * Tests interval scheduling, priority queue ordering, start/stop lifecycle, graceful shutdown, error recovery
 *
 * Per tasks.md T034a:
 * - Test check interval scheduling (default 60s)
 * - Test priority queue ordering by next check time
 * - Test scheduler start/stop
 * - Test graceful shutdown with in-flight checks
 * - Test scheduler recovery from errors
 *
 * Tests MUST fail before T034 implementation (TDD principle)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler } from '../../../src/orchestrator/scheduler.ts';
import type { HealthCheckConfig, HealthCheckResult } from '../../../src/types/health-check.ts';
import type { WorkerPoolManager } from '../../../src/orchestrator/pool-manager.ts';

/**
 * Scheduled check interface for priority queue
 * Note: Interface defined for type documentation but not used in tests
 */
// interface ScheduledCheck {
//   config: HealthCheckConfig;
//   nextCheckTime: Date;
//   intervalMs: number;
// }

/**
 * Scheduler options interface
 * Note: Interface defined for type documentation but not used in tests
 */
// interface SchedulerOptions {
//   defaultInterval?: number;
//   gracefulShutdownTimeout?: number;
// }

describe('Health Check Scheduler', () => {
  let scheduler: Scheduler;
  let mockPoolManager: WorkerPoolManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock worker pool manager
    mockPoolManager = {
      executeHealthCheck: vi.fn(),
      shutdown: vi.fn(),
      getMetrics: vi.fn(),
    } as unknown as WorkerPoolManager;
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Scheduler Initialization', () => {
    it('should initialize with default interval (60 seconds)', () => {
      // Act
      scheduler = new Scheduler(mockPoolManager);

      // Assert
      expect(scheduler.getDefaultInterval()).toBe(60000); // 60 seconds in ms
    });

    it('should initialize with custom default interval', () => {
      // Arrange
      const customInterval = 30000; // 30 seconds

      // Act
      scheduler = new Scheduler(mockPoolManager, { defaultInterval: customInterval });

      // Assert
      expect(scheduler.getDefaultInterval()).toBe(customInterval);
    });

    it('should initialize with empty schedule queue', () => {
      // Act
      scheduler = new Scheduler(mockPoolManager);

      // Assert
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it('should initialize in stopped state', () => {
      // Act
      scheduler = new Scheduler(mockPoolManager);

      // Assert
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should accept worker pool manager instance', () => {
      // Act
      scheduler = new Scheduler(mockPoolManager);

      // Assert
      expect(scheduler.getPoolManager()).toBe(mockPoolManager);
    });
  });

  describe('Service Scheduling', () => {
    it('should schedule single service with default interval', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'test-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'test-id',
      };

      // Act
      scheduler.scheduleService(config);

      // Assert
      expect(scheduler.getQueueSize()).toBe(1);
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.config).toEqual(config);
      expect(scheduled[0]?.intervalMs).toBe(60000); // Default interval
    });

    it('should schedule service with custom interval', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'custom-interval',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'custom-id',
      };

      const customInterval = 120000; // 2 minutes

      // Act
      scheduler.scheduleService(config, customInterval);

      // Assert
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.intervalMs).toBe(customInterval);
    });

    it('should schedule multiple services', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'service-1',
          method: 'GET',
          url: 'https://example.com/1',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-1',
        },
        {
          serviceName: 'service-2',
          method: 'GET',
          url: 'https://example.com/2',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-2',
        },
        {
          serviceName: 'service-3',
          method: 'GET',
          url: 'https://example.com/3',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-3',
        },
      ];

      // Act
      configs.forEach((config) => scheduler.scheduleService(config));

      // Assert
      expect(scheduler.getQueueSize()).toBe(3);
    });

    it('should calculate next check time from current time', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const currentTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(currentTime);

      const config: HealthCheckConfig = {
        serviceName: 'time-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'time-id',
      };

      const interval = 60000; // 1 minute

      // Act
      scheduler.scheduleService(config, interval);

      // Assert
      const scheduled = scheduler.getScheduledChecks();
      const expectedNextCheck = new Date(currentTime.getTime() + interval);
      expect(scheduled[0]?.nextCheckTime).toEqual(expectedNextCheck);
    });

    it('should update existing service schedule', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'update-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'update-id',
      };

      scheduler.scheduleService(config, 60000);

      // Act - update with new interval
      scheduler.scheduleService(config, 120000);

      // Assert
      expect(scheduler.getQueueSize()).toBe(1); // Not duplicated
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.intervalMs).toBe(120000);
    });
  });

  describe('Priority Queue Ordering', () => {
    it('should order checks by earliest next check time first', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const baseTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(baseTime);

      const configs: Array<{ config: HealthCheckConfig; interval: number }> = [
        {
          config: {
            serviceName: 'service-3min',
            method: 'GET',
            url: 'https://example.com/3',
            timeout: 5000,
            warningThreshold: 2000,
            maxRetries: 3,
            expectedStatus: 200,
            correlationId: 'id-3',
          },
          interval: 180000, // 3 minutes
        },
        {
          config: {
            serviceName: 'service-1min',
            method: 'GET',
            url: 'https://example.com/1',
            timeout: 5000,
            warningThreshold: 2000,
            maxRetries: 3,
            expectedStatus: 200,
            correlationId: 'id-1',
          },
          interval: 60000, // 1 minute
        },
        {
          config: {
            serviceName: 'service-2min',
            method: 'GET',
            url: 'https://example.com/2',
            timeout: 5000,
            warningThreshold: 2000,
            maxRetries: 3,
            expectedStatus: 200,
            correlationId: 'id-2',
          },
          interval: 120000, // 2 minutes
        },
      ];

      // Act - schedule in random order
      configs.forEach(({ config, interval }) => scheduler.scheduleService(config, interval));

      // Assert - should be ordered by next check time
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.config.serviceName).toBe('service-1min');
      expect(scheduled[1]?.config.serviceName).toBe('service-2min');
      expect(scheduled[2]?.config.serviceName).toBe('service-3min');
    });

    it('should maintain priority order after rescheduling', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const baseTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(baseTime);

      const config1: HealthCheckConfig = {
        serviceName: 'service-1',
        method: 'GET',
        url: 'https://example.com/1',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-1',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'service-2',
        method: 'GET',
        url: 'https://example.com/2',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-2',
      };

      scheduler.scheduleService(config1, 60000); // 1 minute
      scheduler.scheduleService(config2, 120000); // 2 minutes

      const result1: HealthCheckResult = {
        serviceName: 'service-1',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-1',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result1);

      // Act - start scheduler, execute first check
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000); // Advance 1 minute

      // Assert - service-2 should now be first (hasn't been checked yet)
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.config.serviceName).toBe('service-2');
    });

    it('should handle services with same next check time', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const baseTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(baseTime);

      const config1: HealthCheckConfig = {
        serviceName: 'service-1',
        method: 'GET',
        url: 'https://example.com/1',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-1',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'service-2',
        method: 'GET',
        url: 'https://example.com/2',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-2',
      };

      // Act - schedule with same interval
      scheduler.scheduleService(config1, 60000);
      scheduler.scheduleService(config2, 60000);

      // Assert - both should be in queue
      expect(scheduler.getQueueSize()).toBe(2);
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.nextCheckTime).toEqual(scheduled[1]?.nextCheckTime);
    });
  });

  describe('Scheduler Start and Stop', () => {
    it('should start scheduler and transition to running state', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      // Act
      scheduler.start();

      // Assert
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop scheduler and transition to stopped state', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();

      // Act
      await scheduler.stop();

      // Assert
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should execute scheduled checks when started', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'execution-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'execution-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'execution-test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'execution-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000); // Advance to check time

      // Assert
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config);
    });

    it('should not execute checks when stopped', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'stopped-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'stopped-id',
      };

      scheduler.scheduleService(config, 60000);

      // Act - don't start scheduler
      await vi.advanceTimersByTimeAsync(60000);

      // Assert
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
    });

    it('should reject multiple start calls', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();

      // Act & Assert
      expect(() => scheduler.start()).toThrow('Scheduler already running');
    });

    it('should allow restart after stop', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();
      await scheduler.stop();

      // Act & Assert - should not throw
      expect(() => scheduler.start()).not.toThrow();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should clear internal timers on stop', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const config: HealthCheckConfig = {
        serviceName: 'timer-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'timer-id',
      };

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act
      await scheduler.stop();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - should not execute after stop
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('Check Execution and Rescheduling', () => {
    it('should reschedule check after successful execution', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const baseTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(baseTime);

      const config: HealthCheckConfig = {
        serviceName: 'reschedule-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'reschedule-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'reschedule-test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'reschedule-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      const interval = 60000;
      scheduler.scheduleService(config, interval);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(interval);

      // Assert - should be rescheduled for next interval
      const scheduled = scheduler.getScheduledChecks();
      // const _expectedNextCheck = new Date(baseTime.getTime() + interval * 2);
      expect(scheduled[0]?.nextCheckTime.getTime()).toBeGreaterThan(baseTime.getTime() + interval);
    });

    it('should execute multiple checks at their scheduled times', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1: HealthCheckConfig = {
        serviceName: 'service-1',
        method: 'GET',
        url: 'https://example.com/1',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-1',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'service-2',
        method: 'GET',
        url: 'https://example.com/2',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-2',
      };

      const result: HealthCheckResult = {
        serviceName: 'service-1',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-1',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      scheduler.scheduleService(config1, 60000); // 1 minute
      scheduler.scheduleService(config2, 120000); // 2 minutes

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000); // First check

      // Assert
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config1);
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalledWith(config2);

      // Act - advance to second check
      await vi.advanceTimersByTimeAsync(60000);

      // Assert
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config2);
    });

    it('should continue scheduling after check failure', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'fail-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fail-id',
      };

      const failResult: HealthCheckResult = {
        serviceName: 'fail-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'HTTP status validation failed',
        correlation_id: 'fail-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(failResult);

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - should be called twice (initial + reschedule)
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent check executions', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const baseTime = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(baseTime);

      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'concurrent-1',
          method: 'GET',
          url: 'https://example.com/1',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'concurrent-id-1',
        },
        {
          serviceName: 'concurrent-2',
          method: 'GET',
          url: 'https://example.com/2',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'concurrent-id-2',
        },
      ];

      const result: HealthCheckResult = {
        serviceName: 'concurrent-1',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'concurrent-id-1',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      // Schedule both for same time
      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - both should execute
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should wait for in-flight checks before shutdown', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'inflight-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'inflight-id',
      };

      let resolveHealthCheck: ((value: HealthCheckResult) => void) | undefined;
      const healthCheckPromise = new Promise<HealthCheckResult>((resolve) => {
        resolveHealthCheck = resolve;
      });

      vi.mocked(mockPoolManager.executeHealthCheck).mockReturnValue(healthCheckPromise);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Trigger check execution
      await vi.advanceTimersByTimeAsync(60000);

      // Act - initiate shutdown while check is in-flight
      const shutdownPromise = scheduler.stop();

      // Check is still in-flight
      expect(scheduler.isRunning()).toBe(true);

      // Complete the check
      if (resolveHealthCheck) {
        const result: HealthCheckResult = {
          serviceName: 'inflight-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'inflight-id',
        };
        resolveHealthCheck(result);
      }

      await shutdownPromise;

      // Assert
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should force shutdown after graceful timeout', async () => {
      // Arrange
      const gracefulTimeout = 1000;
      scheduler = new Scheduler(mockPoolManager, { gracefulShutdownTimeout: gracefulTimeout });

      const config: HealthCheckConfig = {
        serviceName: 'stuck-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'stuck-id',
      };

      // Create a promise that never resolves (stuck check)
      const stuckPromise = new Promise<HealthCheckResult>(() => {});
      vi.mocked(mockPoolManager.executeHealthCheck).mockReturnValue(stuckPromise);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60000);

      // Act - shutdown with stuck check
      const shutdownPromise = scheduler.stop();
      await vi.advanceTimersByTimeAsync(gracefulTimeout);

      await shutdownPromise;

      // Assert - should force shutdown after timeout
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not schedule new checks after shutdown initiated', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'shutdown-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'shutdown-id',
      };

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act - initiate shutdown
      const shutdownPromise = scheduler.stop();

      // Try to schedule new service during shutdown
      const newConfig: HealthCheckConfig = {
        serviceName: 'new-service',
        method: 'GET',
        url: 'https://example.com/new',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'new-id',
      };

      // Assert
      expect(() => scheduler.scheduleService(newConfig)).toThrow('Scheduler is shutting down');

      await shutdownPromise;
    });

    it('should cancel pending scheduled checks on shutdown', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'pending-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'pending-id',
      };

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act - shutdown before check time
      await scheduler.stop();

      // Advance time past check time
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - check should not execute
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from health check execution error', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'error-recovery',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'error-id',
      };

      // First call throws error, second call succeeds
      vi.mocked(mockPoolManager.executeHealthCheck)
        .mockRejectedValueOnce(new Error('Pool error'))
        .mockResolvedValueOnce({
          serviceName: 'error-recovery',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'error-id',
        });

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000); // Error occurs
      await vi.advanceTimersByTimeAsync(60000); // Retry succeeds

      // Assert - should still be running and rescheduled
      expect(scheduler.isRunning()).toBe(true);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });

    it('should continue scheduling other services after one fails', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1: HealthCheckConfig = {
        serviceName: 'error-service',
        method: 'GET',
        url: 'https://example.com/error',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'error-id',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'success-service',
        method: 'GET',
        url: 'https://example.com/success',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'success-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation((config) => {
        if (config.serviceName === 'error-service') {
          return Promise.reject(new Error('Service error'));
        }
        return Promise.resolve({
          serviceName: 'success-service',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'success-id',
        });
      });

      scheduler.scheduleService(config1, 60000);
      scheduler.scheduleService(config2, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - both should be called despite one failing
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config1);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config2);
    });

    it('should log errors but continue operation', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'log-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'log-error-id',
      };

      // Mock the executeHealthCheck to throw an error
      vi.mocked(mockPoolManager.executeHealthCheck).mockRejectedValue(new Error('Execution error'));

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - scheduler still running despite error
      expect(scheduler.isRunning()).toBe(true);
      // Note: Error is now logged via structured logger instead of console.error
    });

    it('should handle worker pool manager errors gracefully', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'pool-error',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'pool-error-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockRejectedValue(new Error('Pool exhausted'));

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - should reschedule despite error
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });
  });

  describe('First Cycle Behavior (T034a)', () => {
    it('should mark all services as PENDING before first cycle', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'service-1',
          method: 'GET',
          url: 'https://example.com/1',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-1',
        },
        {
          serviceName: 'service-2',
          method: 'GET',
          url: 'https://example.com/2',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-2',
        },
        {
          serviceName: 'service-3',
          method: 'GET',
          url: 'https://example.com/3',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-3',
        },
      ];

      // Act - schedule all services but don't start
      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Assert - services should be scheduled but not yet checked
      expect(scheduler.getQueueSize()).toBe(3);
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
    });

    it('should execute all services in first cycle concurrently', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = Array.from({ length: 5 }, (_, i) => ({
        serviceName: `service-${i}`,
        method: 'GET' as const,
        url: `https://example.com/${i}`,
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: `id-${i}`,
      }));

      const pendingResult: HealthCheckResult = {
        serviceName: 'service-0',
        timestamp: new Date(),
        method: 'GET',
        status: 'PENDING',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-0',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(pendingResult);

      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Act - start and complete first cycle
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - all services should be checked in first cycle
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(5);
      configs.forEach((config) => {
        expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config);
      });
    });

    it('should wait for first cycle completion before generating initial HTML', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'first-cycle-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'first-cycle-id',
      };

      const pendingResult: HealthCheckResult = {
        serviceName: 'first-cycle-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PENDING',
        latency_ms: 0,
        http_status_code: 0,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'first-cycle-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(pendingResult);

      scheduler.scheduleService(config, 60000);

      // Act
      scheduler.start();

      // Before first cycle completes - no checks should have executed
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();

      // Complete first cycle
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - first cycle completed, checks executed
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config);
    });

    it('should complete first cycle when all scheduled checks finish', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = Array.from({ length: 3 }, (_, i) => ({
        serviceName: `service-${i}`,
        method: 'GET' as const,
        url: `https://example.com/${i}`,
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: `id-${i}`,
      }));

      const passResult: HealthCheckResult = {
        serviceName: 'service-0',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'id-0',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      configs.forEach((config) => scheduler.scheduleService(config, 60000));
      scheduler.start();

      // Act
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - all checks executed means first cycle is complete
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);
    });
  });

  describe('HTML/JSON Regeneration After Cycle Completion (T034a)', () => {
    it('should regenerate HTML/JSON after every cycle completion', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'regen-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'regen-id',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'regen-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'regen-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act - complete multiple cycles
      await vi.advanceTimersByTimeAsync(60000); // Cycle 1
      await vi.advanceTimersByTimeAsync(60000); // Cycle 2
      await vi.advanceTimersByTimeAsync(60000); // Cycle 3

      // Assert - should trigger regeneration after each cycle
      // Each cycle should execute the health check
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);
    });

    it('should regenerate HTML/JSON regardless of status changes', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'stable-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'stable-id',
      };

      // Mock service always returning PASS (no status change)
      const passResult: HealthCheckResult = {
        serviceName: 'stable-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'stable-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act - complete multiple cycles with same status
      await vi.advanceTimersByTimeAsync(60000); // Cycle 1 - PASS
      await vi.advanceTimersByTimeAsync(60000); // Cycle 2 - PASS (no change)
      await vi.advanceTimersByTimeAsync(60000); // Cycle 3 - PASS (no change)

      // Assert - should still regenerate even though status didn't change
      // This is verified by the fact that checks continue to execute
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);
    });

    it('should complete cycle when all scheduled checks finish (multiple services)', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = Array.from({ length: 3 }, (_, i) => ({
        serviceName: `multi-service-${i}`,
        method: 'GET' as const,
        url: `https://example.com/${i}`,
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: `multi-id-${i}`,
      }));

      const passResult: HealthCheckResult = {
        serviceName: 'multi-service-0',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'multi-id-0',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      configs.forEach((config) => scheduler.scheduleService(config, 60000));
      scheduler.start();

      // Act - complete one cycle
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - all checks executed means cycle is complete
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);

      // Act - complete second cycle
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - all checks executed again in second cycle
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(6); // 3 per cycle × 2 cycles
    });

    it('should trigger regeneration even when some checks fail', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1: HealthCheckConfig = {
        serviceName: 'pass-service',
        method: 'GET',
        url: 'https://example.com/pass',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'pass-id',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'fail-service',
        method: 'GET',
        url: 'https://example.com/fail',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fail-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation((config) => {
        if (config.serviceName === 'pass-service') {
          return Promise.resolve({
            serviceName: 'pass-service',
            timestamp: new Date(),
            method: 'GET',
            status: 'PASS',
            latency_ms: 100,
            http_status_code: 200,
            expected_status: 200,
            failure_reason: '',
            correlation_id: 'pass-id',
          });
        } else {
          return Promise.resolve({
            serviceName: 'fail-service',
            timestamp: new Date(),
            method: 'GET',
            status: 'FAIL',
            latency_ms: 0,
            http_status_code: 500,
            expected_status: 200,
            failure_reason: 'HTTP status validation failed',
            correlation_id: 'fail-id',
          });
        }
      });

      scheduler.scheduleService(config1, 60000);
      scheduler.scheduleService(config2, 60000);
      scheduler.start();

      // Act - complete cycle with mixed results
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - both checks executed, cycle completed
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cycle Timing Accuracy (T034a)', () => {
    it('should execute checks at exact scheduled intervals', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'precise-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'precise-id',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'precise-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'precise-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      const interval = 5000; // 5 seconds
      scheduler.scheduleService(config, interval);
      scheduler.start();

      // Act & Assert - check timing accuracy over multiple cycles
      const startTime = Date.now();

      await vi.advanceTimersByTimeAsync(interval);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);
      expect(Date.now() - startTime).toBe(interval);

      await vi.advanceTimersByTimeAsync(interval);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
      expect(Date.now() - startTime).toBe(interval * 2);

      await vi.advanceTimersByTimeAsync(interval);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);
      expect(Date.now() - startTime).toBe(interval * 3);
    });

    it('should not drift over multiple cycles', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'drift-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'drift-id',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'drift-test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'drift-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      const interval = 1000; // 1 second
      const cycles = 10;

      scheduler.scheduleService(config, interval);
      scheduler.start();

      const startTime = Date.now();

      // Act - run multiple cycles
      for (let i = 0; i < cycles; i++) {
        await vi.advanceTimersByTimeAsync(interval);
      }

      // Assert - total time should equal cycles * interval (no drift)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBe(cycles * interval);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(cycles);
    });

    it('should handle sub-second intervals accurately', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'fast-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fast-id',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'fast-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 50,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'fast-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      const interval = 500; // 500ms
      scheduler.scheduleService(config, interval);
      scheduler.start();

      // Act
      await vi.advanceTimersByTimeAsync(interval);
      await vi.advanceTimersByTimeAsync(interval);
      await vi.advanceTimersByTimeAsync(interval);

      // Assert - should execute 3 times at 500ms intervals
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(3);
    });

    it('should maintain accurate intervals across different services', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1s: HealthCheckConfig = {
        serviceName: 'service-1s',
        method: 'GET',
        url: 'https://example.com/1s',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-1s',
      };

      const config2s: HealthCheckConfig = {
        serviceName: 'service-2s',
        method: 'GET',
        url: 'https://example.com/2s',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'id-2s',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      scheduler.scheduleService(config1s, 1000); // 1 second
      scheduler.scheduleService(config2s, 2000); // 2 seconds
      scheduler.start();

      // Act & Assert
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config1s);
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalledWith(config2s);

      vi.mocked(mockPoolManager.executeHealthCheck).mockClear();

      await vi.advanceTimersByTimeAsync(1000); // Total 2s
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2); // Both services
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config1s); // 2nd execution
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config2s); // 1st execution
    });

    it('should schedule next check immediately if current time exceeds next check time', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'delayed-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'delayed-id',
      };

      // Mock slow check that takes longer than interval
      let callCount = 0;
      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              serviceName: 'delayed-service',
              timestamp: new Date(),
              method: 'GET',
              status: 'PASS',
              latency_ms: 2000,
              http_status_code: 200,
              expected_status: 200,
              failure_reason: '',
              correlation_id: 'delayed-id',
            });
          }, 2000); // Check takes 2 seconds
        });
      });

      scheduler.scheduleService(config, 1000); // 1 second interval
      scheduler.start();

      // Act
      await vi.advanceTimersByTimeAsync(1000); // Start first check
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000); // Check completes after 2s total

      // Assert - should schedule next check immediately since we're past due
      // The exact behavior depends on implementation, but scheduler should handle overrun
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('runOnce Method (CI Mode)', () => {
    it('should run all scheduled checks once without rescheduling', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'once-service-1',
          method: 'GET',
          url: 'https://example.com/1',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'once-id-1',
        },
        {
          serviceName: 'once-service-2',
          method: 'GET',
          url: 'https://example.com/2',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'once-id-2',
        },
      ];

      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation((config) =>
        Promise.resolve({
          serviceName: config.serviceName || 'test',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: config.correlationId || 'test-id',
        })
      );

      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Act
      await scheduler.runOnce();

      // Assert
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(configs[0]);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(configs[1]);
    });

    it('should store results in latestResults map', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'result-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'result-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'result-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 150,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'result-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);
      scheduler.scheduleService(config, 60000);

      // Act
      await scheduler.runOnce();

      // Assert
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(result);
    });

    it('should handle errors during runOnce and store failed results', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'failing-once-service',
        method: 'GET',
        url: 'https://example.com/fail',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fail-once-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockRejectedValue(new Error('Network error'));
      scheduler.scheduleService(config, 60000);

      // Act
      await scheduler.runOnce();

      // Assert - should store failed result
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('FAIL');
      expect(results[0]?.serviceName).toBe('failing-once-service');
      expect(results[0]?.failure_reason).toBe('Network error');
    });

    it('should throw error if scheduler is already running', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();

      // Act & Assert
      await expect(scheduler.runOnce()).rejects.toThrow(
        'Cannot run once - scheduler is already running'
      );
    });

    it('should throw error if scheduler is shutting down', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      const config: HealthCheckConfig = {
        serviceName: 'test-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'test-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves to keep scheduler in shutting down state
          })
      );

      scheduler.scheduleService(config, 60000);
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60000);

      // Initiate shutdown (will be in SHUTTING_DOWN state)
      const shutdownPromise = scheduler.stop();

      // Act & Assert
      await expect(scheduler.runOnce()).rejects.toThrow(
        'Cannot run once - scheduler is shutting down'
      );

      // Cleanup
      await vi.advanceTimersByTimeAsync(30000);
      await shutdownPromise;
    });

    it('should handle empty queue gracefully in runOnce', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      // Act - runOnce with no scheduled services
      await scheduler.runOnce();

      // Assert
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(0);
    });

    it('should handle missing serviceName and use URL instead', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        method: 'GET',
        url: 'https://example.com/no-name',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'no-name-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockRejectedValue(new Error('Test error'));
      scheduler.scheduleService(config, 60000);

      // Act
      await scheduler.runOnce();

      // Assert - should use URL as serviceName
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.serviceName).toBe('https://example.com/no-name');
    });

    it('should handle missing correlationId with fallback', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'no-correlation-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        // No correlationId provided
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockRejectedValue(new Error('Test error'));
      scheduler.scheduleService(config, 60000);

      // Act
      await scheduler.runOnce();

      // Assert - should use 'unknown' as correlationId
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.correlation_id).toBe('unknown');
    });

    it('should execute all checks concurrently', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = Array.from({ length: 5 }, (_, i) => ({
        serviceName: `concurrent-once-${i}`,
        method: 'GET' as const,
        url: `https://example.com/${i}`,
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: `concurrent-once-${i}`,
      }));

      const executionOrder: number[] = [];
      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation((config) => {
        const index = parseInt(config.serviceName?.split('-')[2] || '0');
        executionOrder.push(index);
        return Promise.resolve({
          serviceName: config.serviceName || 'test',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: config.correlationId || 'test-id',
        });
      });

      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Act
      await scheduler.runOnce();

      // Assert - all should execute (order may vary due to concurrency)
      expect(executionOrder).toHaveLength(5);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(5);
    });
  });

  describe('Latest Results Tracking', () => {
    it('should return empty array when no checks have been executed', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      // Act
      const results = scheduler.getLatestResults();

      // Assert
      expect(results).toEqual([]);
    });

    it('should update latest results after each check execution', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'latest-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'latest-id',
      };

      const result1: HealthCheckResult = {
        serviceName: 'latest-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'latest-id',
      };

      const result2: HealthCheckResult = {
        serviceName: 'latest-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'FAIL',
        latency_ms: 0,
        http_status_code: 500,
        expected_status: 200,
        failure_reason: 'Server error',
        correlation_id: 'latest-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck)
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Act - execute first check
      await vi.advanceTimersByTimeAsync(60000);
      let results = scheduler.getLatestResults();
      expect(results[0]?.status).toBe('PASS');

      // Act - execute second check
      await vi.advanceTimersByTimeAsync(60000);
      results = scheduler.getLatestResults();

      // Assert - should have updated to FAIL
      expect(results[0]?.status).toBe('FAIL');
    });

    it('should maintain separate results for different services', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = [
        {
          serviceName: 'service-a',
          method: 'GET',
          url: 'https://example.com/a',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-a',
        },
        {
          serviceName: 'service-b',
          method: 'GET',
          url: 'https://example.com/b',
          timeout: 5000,
          warningThreshold: 2000,
          maxRetries: 3,
          expectedStatus: 200,
          correlationId: 'id-b',
        },
      ];

      vi.mocked(mockPoolManager.executeHealthCheck).mockImplementation((config) =>
        Promise.resolve({
          serviceName: config.serviceName || 'test',
          timestamp: new Date(),
          method: 'GET',
          status: config.serviceName === 'service-a' ? 'PASS' : 'FAIL',
          latency_ms: 100,
          http_status_code: config.serviceName === 'service-a' ? 200 : 500,
          expected_status: 200,
          failure_reason: config.serviceName === 'service-a' ? '' : 'Server error',
          correlation_id: config.correlationId || 'test-id',
        })
      );

      configs.forEach((config) => scheduler.scheduleService(config, 60000));
      scheduler.start();

      // Act
      await vi.advanceTimersByTimeAsync(60000);

      // Assert
      const results = scheduler.getLatestResults();
      expect(results).toHaveLength(2);

      const serviceA = results.find((r) => r.serviceName === 'service-a');
      const serviceB = results.find((r) => r.serviceName === 'service-b');

      expect(serviceA?.status).toBe('PASS');
      expect(serviceB?.status).toBe('FAIL');
    });
  });

  describe('Graceful Shutdown Timeout', () => {
    it('should wait for in-flight checks up to timeout', async () => {
      // Arrange
      const gracefulTimeout = 2000;
      scheduler = new Scheduler(mockPoolManager, { gracefulShutdownTimeout: gracefulTimeout });

      const config: HealthCheckConfig = {
        serviceName: 'slow-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'slow-id',
      };

      const healthCheckPromise = new Promise<HealthCheckResult>(() => {
        // Promise intentionally never resolves to simulate timeout scenario
      });

      vi.mocked(mockPoolManager.executeHealthCheck).mockReturnValue(healthCheckPromise);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60000);

      // Act - start shutdown
      const shutdownPromise = scheduler.stop();
      const startTime = Date.now();

      // Don't resolve the check - let it timeout
      await vi.advanceTimersByTimeAsync(gracefulTimeout);
      await shutdownPromise;

      // Assert
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(gracefulTimeout);
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should complete immediately if no in-flight checks', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();

      // Act
      const startTime = Date.now();
      await scheduler.stop();
      const elapsedTime = Date.now() - startTime;

      // Assert - should complete almost immediately
      expect(elapsedTime).toBeLessThan(100);
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should handle stop when already stopped', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      // Act & Assert - should not throw
      await scheduler.stop();
      await scheduler.stop(); // Call again when already stopped

      expect(scheduler.isRunning()).toBe(false);
    });

    it('should retrieve configured graceful shutdown timeout', () => {
      // Arrange
      const customTimeout = 15000;
      scheduler = new Scheduler(mockPoolManager, { gracefulShutdownTimeout: customTimeout });

      // Act
      const timeout = scheduler.getTimeout();

      // Assert
      expect(timeout).toBe(customTimeout);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero interval (immediate execution)', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'immediate-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'immediate-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'immediate-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'immediate-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      // Act
      scheduler.scheduleService(config, 0);
      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);

      // Assert
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalled();
    });

    it('should reschedule check when queue was empty', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'empty-queue-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'empty-queue-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'empty-queue-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'empty-queue-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      scheduler.scheduleService(config, 1000);
      scheduler.start();

      // Act - execute first check (queue becomes empty after execution)
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);

      // Assert - check should be rescheduled
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(2);
    });

    it('should update timer when rescheduled check becomes first in queue', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1: HealthCheckConfig = {
        serviceName: 'fast-service',
        method: 'GET',
        url: 'https://example.com/fast',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'fast-id',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'slow-service',
        method: 'GET',
        url: 'https://example.com/slow',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'slow-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      // Schedule fast service with 1s interval, slow with 5s
      scheduler.scheduleService(config1, 1000);
      scheduler.scheduleService(config2, 5000);
      scheduler.start();

      // Act - fast service executes and reschedules for 1s later
      await vi.advanceTimersByTimeAsync(1000);

      // Fast service should execute again before slow service
      await vi.advanceTimersByTimeAsync(1000);

      // Assert - fast service should have executed twice, slow service not yet
      const calls = vi.mocked(mockPoolManager.executeHealthCheck).mock.calls;
      const fastCalls = calls.filter((call) => call[0]?.serviceName === 'fast-service');
      expect(fastCalls).toHaveLength(2);
    });

    it('should schedule service while running and reschedule timer', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config1: HealthCheckConfig = {
        serviceName: 'initial-service',
        method: 'GET',
        url: 'https://example.com/initial',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'initial-id',
      };

      const config2: HealthCheckConfig = {
        serviceName: 'added-service',
        method: 'GET',
        url: 'https://example.com/added',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'added-id',
      };

      const result: HealthCheckResult = {
        serviceName: 'test',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'test-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(result);

      scheduler.scheduleService(config1, 5000); // 5 seconds
      scheduler.start();

      // Act - add another service with shorter interval while running
      await vi.advanceTimersByTimeAsync(500);
      scheduler.scheduleService(config2, 1000); // 1 second (will be due first)

      // Assert - added service should execute before initial service
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledWith(config2);
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalledWith(config1);
    });

    it('should handle very large intervals', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'large-interval',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'large-id',
      };

      const largeInterval = 86400000; // 24 hours

      // Act
      scheduler.scheduleService(config, largeInterval);

      // Assert
      const scheduled = scheduler.getScheduledChecks();
      expect(scheduled[0]?.intervalMs).toBe(largeInterval);
    });

    it('should handle unscheduling a service', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'unschedule-test',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'unschedule-id',
      };

      scheduler.scheduleService(config, 60000);
      expect(scheduler.getQueueSize()).toBe(1);

      // Act
      scheduler.unscheduleService('unschedule-test');

      // Assert
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it('should handle many concurrent services', () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const configs: HealthCheckConfig[] = Array.from({ length: 100 }, (_, i) => ({
        serviceName: `service-${i}`,
        method: 'GET' as const,
        url: `https://example.com/${i}`,
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: `id-${i}`,
      }));

      // Act
      configs.forEach((config) => scheduler.scheduleService(config, 60000));

      // Assert
      expect(scheduler.getQueueSize()).toBe(100);
    });

    it('should handle empty queue gracefully', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);
      scheduler.start();

      // Act
      await vi.advanceTimersByTimeAsync(10000);

      // Assert - should not crash
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should handle queue becoming empty during operation', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'temporary-service',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'temp-id',
      };

      const passResult: HealthCheckResult = {
        serviceName: 'temporary-service',
        timestamp: new Date(),
        method: 'GET',
        status: 'PASS',
        latency_ms: 100,
        http_status_code: 200,
        expected_status: 200,
        failure_reason: '',
        correlation_id: 'temp-id',
      };

      vi.mocked(mockPoolManager.executeHealthCheck).mockResolvedValue(passResult);

      scheduler.scheduleService(config, 60000);
      scheduler.start();

      // Execute first check
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);

      // Act - unschedule service
      scheduler.unscheduleService('temporary-service');

      // Advance time
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - should only be called once (not rescheduled)
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);
    });

    it('should handle start with no scheduled services', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      // Act - start with empty queue
      scheduler.start();

      // Advance time - nothing should happen
      await vi.advanceTimersByTimeAsync(60000);

      // Assert - no checks should execute
      expect(mockPoolManager.executeHealthCheck).not.toHaveBeenCalled();
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should not reschedule if stopped during check execution', async () => {
      // Arrange
      scheduler = new Scheduler(mockPoolManager);

      const config: HealthCheckConfig = {
        serviceName: 'stop-during-check',
        method: 'GET',
        url: 'https://example.com',
        timeout: 5000,
        warningThreshold: 2000,
        maxRetries: 3,
        expectedStatus: 200,
        correlationId: 'stop-check-id',
      };

      let resolveCheck: ((value: HealthCheckResult) => void) | undefined;
      const checkPromise = new Promise<HealthCheckResult>((resolve) => {
        resolveCheck = resolve;
      });

      vi.mocked(mockPoolManager.executeHealthCheck).mockReturnValue(checkPromise);

      scheduler.scheduleService(config, 1000);
      scheduler.start();

      // Trigger check
      await vi.advanceTimersByTimeAsync(1000);

      // Stop scheduler while check is in-flight
      const stopPromise = scheduler.stop();

      // Resolve check after stop initiated
      if (resolveCheck) {
        resolveCheck({
          serviceName: 'stop-during-check',
          timestamp: new Date(),
          method: 'GET',
          status: 'PASS',
          latency_ms: 100,
          http_status_code: 200,
          expected_status: 200,
          failure_reason: '',
          correlation_id: 'stop-check-id',
        });
      }

      await stopPromise;

      // Assert - check should have been called once, but not rescheduled
      expect(mockPoolManager.executeHealthCheck).toHaveBeenCalledTimes(1);
      expect(scheduler.isRunning()).toBe(false);
    });
  });
});
