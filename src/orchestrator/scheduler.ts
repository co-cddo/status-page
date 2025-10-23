/**
 * Health check scheduler implementation
 * Manages periodic health check cycles using priority queue ordered by next check time
 */

import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';
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

enum SchedulerState {
  STOPPED = 'stopped',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
}

export class Scheduler {
  private poolManager: WorkerPoolManager;
  private defaultInterval: number;
  private gracefulShutdownTimeout: number;
  private state: SchedulerState = SchedulerState.STOPPED;
  private queue: ScheduledCheck[] = [];
  private schedulerTimer: NodeJS.Timeout | null = null;
  private inFlightChecks: Set<Promise<void>> = new Set();

  constructor(poolManager: WorkerPoolManager, options?: SchedulerOptions) {
    this.poolManager = poolManager;
    this.defaultInterval = options?.defaultInterval ?? 60000; // Default 60 seconds
    this.gracefulShutdownTimeout = options?.gracefulShutdownTimeout ?? 30000; // Default 30 seconds
  }

  start(): void {
    if (this.state === SchedulerState.RUNNING) {
      throw new Error('Scheduler already running');
    }
    if (this.state === SchedulerState.SHUTTING_DOWN) {
      throw new Error('Scheduler is shutting down');
    }

    this.state = SchedulerState.RUNNING;
    this.scheduleNextCheck();
  }

  async stop(): Promise<void> {
    if (this.state === SchedulerState.STOPPED || this.state === SchedulerState.SHUTTING_DOWN) {
      // If already stopping or stopped, just wait
      if (this.state === SchedulerState.STOPPED) {
        return;
      }
    }

    this.state = SchedulerState.SHUTTING_DOWN;

    // Clear scheduler timer
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Wait for in-flight checks with timeout
    if (this.inFlightChecks.size > 0) {
      const gracefulShutdown = Promise.all(Array.from(this.inFlightChecks));
      const timeout = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), this.gracefulShutdownTimeout);
      });

      await Promise.race([gracefulShutdown, timeout]);
    } else {
      // Ensure async behavior even when no checks are in flight
      // This keeps state as SHUTTING_DOWN until promise is awaited
      await Promise.resolve();
    }

    this.state = SchedulerState.STOPPED;
  }

  scheduleService(config: HealthCheckConfig, intervalMs?: number): void {
    if (this.state === SchedulerState.SHUTTING_DOWN) {
      throw new Error('Scheduler is shutting down');
    }

    const interval = intervalMs ?? this.defaultInterval;
    const nextCheckTime = new Date(Date.now() + interval);

    // Check if service already scheduled
    const existingIndex = this.queue.findIndex(
      (check) => check.config.serviceName === config.serviceName
    );

    if (existingIndex !== -1) {
      // Update existing service schedule
      this.queue[existingIndex] = {
        config,
        nextCheckTime,
        intervalMs: interval,
      };
    } else {
      // Add new service
      this.queue.push({
        config,
        nextCheckTime,
        intervalMs: interval,
      });
    }

    // Maintain priority queue ordering
    this.sortQueue();

    // Reschedule if running
    if (this.state === SchedulerState.RUNNING) {
      if (this.schedulerTimer) {
        clearTimeout(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      this.scheduleNextCheck();
    }
  }

  unscheduleService(serviceName: string): void {
    this.queue = this.queue.filter((check) => check.config.serviceName !== serviceName);
  }

  isRunning(): boolean {
    return this.state === SchedulerState.RUNNING || this.state === SchedulerState.SHUTTING_DOWN;
  }

  getDefaultInterval(): number {
    return this.defaultInterval;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getScheduledChecks(): ScheduledCheck[] {
    // Return a copy to prevent external mutations
    return [...this.queue];
  }

  getPoolManager(): WorkerPoolManager {
    return this.poolManager;
  }

  getTimeout(): number {
    return this.gracefulShutdownTimeout;
  }

  /**
   * Sort queue by next check time (earliest first)
   * For same time, maintain insertion order (FIFO)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const timeDiff = a.nextCheckTime.getTime() - b.nextCheckTime.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // For same time, maintain original order (stable sort)
      return 0;
    });
  }

  /**
   * Schedule next check execution
   */
  private scheduleNextCheck(): void {
    if (this.state !== SchedulerState.RUNNING || this.queue.length === 0) {
      return;
    }

    const now = Date.now();
    const nextCheck = this.queue[0];

    if (!nextCheck) {
      return;
    }

    const delay = Math.max(0, nextCheck.nextCheckTime.getTime() - now);

    this.schedulerTimer = setTimeout(() => {
      this.executeChecks();
    }, delay);
  }

  /**
   * Execute all checks that are due
   */
  private async executeChecks(): Promise<void> {
    if (this.state !== SchedulerState.RUNNING) {
      return;
    }

    const now = Date.now();
    const dueChecks: ScheduledCheck[] = [];

    // Collect all checks that are due
    while (this.queue.length > 0 && this.queue[0]!.nextCheckTime.getTime() <= now) {
      const check = this.queue.shift()!;
      dueChecks.push(check);
    }

    // Execute all due checks concurrently
    for (const check of dueChecks) {
      const checkPromise = this.executeCheck(check);
      this.inFlightChecks.add(checkPromise);

      // Clean up after completion
      checkPromise.finally(() => {
        this.inFlightChecks.delete(checkPromise);
      });
    }

    // Schedule next check
    this.scheduleNextCheck();
  }

  /**
   * Execute a single health check and reschedule
   */
  private async executeCheck(check: ScheduledCheck): Promise<void> {
    try {
      await this.poolManager.executeHealthCheck(check.config);
    } catch (error) {
      // Log error but continue operation
      console.error(
        `Health check failed for ${check.config.serviceName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Reschedule check for next interval (if still running)
    if (this.state === SchedulerState.RUNNING) {
      const nextCheckTime = new Date(Date.now() + check.intervalMs);
      const wasEmpty = this.queue.length === 0;

      this.queue.push({
        ...check,
        nextCheckTime,
      });
      this.sortQueue();

      // If queue was empty or the rescheduled check is now first, update timer
      if (wasEmpty || this.queue[0]?.config.serviceName === check.config.serviceName) {
        if (this.schedulerTimer) {
          clearTimeout(this.schedulerTimer);
          this.schedulerTimer = null;
        }
        this.scheduleNextCheck();
      }
    }
  }
}
