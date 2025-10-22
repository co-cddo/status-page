/**
 * Health check scheduler implementation (stub for TDD)
 * TODO: Implement actual scheduling logic per T034
 */

import type { HealthCheckConfig } from '../types/health-check.js';
import type { WorkerPoolManager } from './pool-manager.js';

export interface ScheduledCheck {
  config: HealthCheckConfig;
  nextCheckTime: Date;
  intervalMs: number;
}

export interface SchedulerOptions {
  defaultInterval?: number;
  gracefulShutdownTimeout?: number;
}

export class Scheduler {
  constructor(poolManager: WorkerPoolManager, options?: SchedulerOptions) {
    // Stub implementation
  }

  start(): void {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  async stop(): Promise<void> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  scheduleService(config: HealthCheckConfig, intervalMs?: number): void {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  unscheduleService(serviceName: string): void {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  isRunning(): boolean {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  getDefaultInterval(): number {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  getQueueSize(): number {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  getScheduledChecks(): ScheduledCheck[] {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  getPoolManager(): WorkerPoolManager {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  getTimeout(): number {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }
}
