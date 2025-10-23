/**
 * Worker pool manager implementation
 * T033: Implement worker pool manager
 *
 * Manages a pool of Node.js worker threads for concurrent health checks.
 * Features:
 * - Dynamic pool sizing (default: 2x CPU cores)
 * - Task queuing when all workers are busy
 * - Graceful shutdown with timeout
 * - Auto-restart crashed workers
 * - Real-time metrics tracking
 */

import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { HealthCheckConfig, HealthCheckResult } from '../types/health-check.js';
import type { WorkerMessage, WorkerResult } from '../health-checks/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pool metrics interface
 */
export interface PoolMetrics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queueDepth: number;
  completedTasks: number;
  failedTasks: number;
  workerCrashes: number;
}

/**
 * Worker pool options
 */
export interface WorkerPoolOptions {
  poolSize?: number;
}

/**
 * Worker task interface
 */
interface WorkerTask {
  config: HealthCheckConfig;
  resolve: (result: HealthCheckResult) => void;
  reject: (error: Error) => void;
}

/**
 * Worker info interface
 */
interface WorkerInfo {
  worker: Worker;
  isIdle: boolean;
  currentTask: WorkerTask | null;
}

/**
 * Worker pool manager class
 */
export class WorkerPoolManager {
  private poolSize: number;
  private workers: WorkerInfo[] = [];
  private taskQueue: WorkerTask[] = [];
  private initialized = false;
  private shuttingDown = false;

  // Metrics
  private metrics = {
    completedTasks: 0,
    failedTasks: 0,
    workerCrashes: 0,
  };

  constructor(options?: WorkerPoolOptions) {
    // Default pool size: 2x CPU cores, minimum 1
    this.poolSize = options?.poolSize ?? cpus().length * 2;
    this.poolSize = Math.max(1, this.poolSize);
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Pool already initialized');
    }

    // Create workers
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }

    this.initialized = true;
  }

  /**
   * Create a new worker thread
   */
  private createWorker(): Worker {
    // Path to worker script (only use in production, mocked in tests)
    const workerPath = join(__dirname, '../health-checks/worker.js');

    // Create worker (will be mocked in tests)
    const worker = new Worker(workerPath, {
      execArgv: ['--import', 'tsx/esm'],
    });

    // Create worker info
    const workerInfo: WorkerInfo = {
      worker,
      isIdle: true,
      currentTask: null,
    };

    // Add to workers array first
    this.workers.push(workerInfo);

    // Set up event listeners
    // Defensive check for test environments where worker may not have 'on' method
    if (typeof worker.on === 'function') {
      // Pass workerInfo to handlers for efficient lookup
      worker.on('message', (message: WorkerResult) => {
        this.handleWorkerMessage(workerInfo, message);
      });

      worker.on('error', (error: Error) => {
        this.handleWorkerError(workerInfo, error);
      });

      worker.on('exit', (code: number) => {
        this.handleWorkerExit(workerInfo, code);
      });
    }

    return worker;
  }

  /**
   * Handle worker message (result)
   */
  private handleWorkerMessage(workerInfo: WorkerInfo, message: WorkerResult): void {
    const { currentTask } = workerInfo;
    if (!currentTask) return;

    // Check for error in result
    if (message.error) {
      this.metrics.failedTasks++;
      currentTask.reject(new Error(message.error.message));
    } else {
      this.metrics.completedTasks++;
      currentTask.resolve(message.result);
    }

    // Return worker to idle pool
    workerInfo.isIdle = true;
    workerInfo.currentTask = null;

    // Process next queued task if available
    this.processNextTask();
  }

  /**
   * Handle worker error event
   */
  private handleWorkerError(workerInfo: WorkerInfo, error: Error): void {
    // Log error but don't crash the pool
    // Worker error event doesn't mean the worker crashed
    console.error('Worker error:', error);
  }

  /**
   * Handle worker exit event
   */
  private handleWorkerExit(workerInfo: WorkerInfo, code: number): void {
    // Remove worker from pool
    const index = this.workers.indexOf(workerInfo);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    // If non-zero exit code, it's a crash
    if (code !== 0) {
      this.metrics.workerCrashes++;

      // Retry current task if there was one
      if (workerInfo.currentTask) {
        this.taskQueue.unshift(workerInfo.currentTask);
      }

      // Replace crashed worker (unless shutting down)
      if (!this.shuttingDown) {
        this.createWorker();
      }
    }
  }

  /**
   * Execute a health check using the worker pool
   */
  async executeHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
    if (this.shuttingDown) {
      throw new Error('Pool is shutting down');
    }

    return new Promise<HealthCheckResult>((resolve, reject) => {
      const task: WorkerTask = { config, resolve, reject };

      // Try to allocate an idle worker
      const idleWorker = this.getIdleWorker();
      if (idleWorker) {
        this.assignTaskToWorker(idleWorker, task);
      } else {
        // Queue task if all workers are busy
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Get an idle worker from the pool
   */
  private getIdleWorker(): WorkerInfo | null {
    for (const workerInfo of this.workers) {
      if (workerInfo.isIdle) {
        return workerInfo;
      }
    }
    return null;
  }

  /**
   * Assign a task to a worker
   */
  private assignTaskToWorker(workerInfo: WorkerInfo, task: WorkerTask): void {
    workerInfo.isIdle = false;
    workerInfo.currentTask = task;

    // Send message to worker
    const message: WorkerMessage = {
      type: 'health-check',
      config: task.config,
    };
    workerInfo.worker.postMessage(message);
  }

  /**
   * Process next queued task
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    const idleWorker = this.getIdleWorker();
    if (!idleWorker) return;

    const task = this.taskQueue.shift();
    if (task) {
      this.assignTaskToWorker(idleWorker, task);
    }
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(options?: { gracefulTimeout?: number }): Promise<void> {
    this.shuttingDown = true;

    // Use shorter default timeout (5s) to avoid hanging in tests
    // Production can override with longer timeout if needed
    const gracefulTimeout = options?.gracefulTimeout ?? 5000;

    // Clear task queue and reject pending tasks
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        task.reject(new Error('Pool is shutting down'));
      }
    }

    // Wait for in-flight tasks to complete (with timeout)
    const startTime = Date.now();
    while (this.hasActiveTasks() && Date.now() - startTime < gracefulTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force reject any remaining in-flight tasks after timeout
    for (const workerInfo of this.workers) {
      if (workerInfo.currentTask) {
        workerInfo.currentTask.reject(new Error('Pool shutdown: task timeout'));
        workerInfo.currentTask = null;
      }
    }

    // Terminate all workers
    const terminatePromises = this.workers
      .map(workerInfo => {
        // Defensive check for test environments
        if (workerInfo.worker && typeof workerInfo.worker.terminate === 'function') {
          return workerInfo.worker.terminate();
        }
        return Promise.resolve();
      });
    await Promise.all(terminatePromises);

    // Clear workers array
    this.workers = [];
  }

  /**
   * Check if there are active tasks
   */
  private hasActiveTasks(): boolean {
    for (const workerInfo of this.workers) {
      if (!workerInfo.isIdle) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    let activeWorkers = 0;
    let idleWorkers = 0;

    for (const workerInfo of this.workers) {
      if (workerInfo.isIdle) {
        idleWorkers++;
      } else {
        activeWorkers++;
      }
    }

    return {
      totalWorkers: this.workers.length,
      activeWorkers,
      idleWorkers,
      queueDepth: this.taskQueue.length,
      completedTasks: this.metrics.completedTasks,
      failedTasks: this.metrics.failedTasks,
      workerCrashes: this.metrics.workerCrashes,
    };
  }

  /**
   * Get pool manager instance (for compatibility)
   */
  getPoolManager(): WorkerPoolManager {
    return this;
  }
}
