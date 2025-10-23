/**
 * Worker test harness for integration tests
 * Simulates worker thread behavior without actual Worker instances
 * Allows testing of WorkerPoolManager with real health check logic
 */

import { EventEmitter } from 'node:events';
import { processHealthCheck } from '../../src/health-checks/worker.js';
import type { WorkerMessage, WorkerResult } from '../../src/health-checks/worker.js';

/**
 * Worker options interface (mirrors worker_threads.WorkerOptions subset)
 */
interface WorkerOptions {
  execArgv?: string[];
  env?: Record<string, string>;
  workerData?: unknown;
}

/**
 * Mock Worker class that simulates worker_threads.Worker behavior
 * Uses processHealthCheck function directly instead of spawning a thread
 */
export class MockWorker extends EventEmitter {
  private terminated = false;

  constructor(_path: string, _options?: WorkerOptions) {
    super();
    // Simulate worker starting (async)
    process.nextTick(() => {
      if (!this.terminated) {
        this.emit('online');
      }
    });
  }

  /**
   * Simulate postMessage to worker thread
   * Processes message using processHealthCheck and emits result
   */
  postMessage(message: WorkerMessage): void {
    if (this.terminated) {
      throw new Error('Worker is terminated');
    }

    // Process message asynchronously (simulating worker thread execution)
    // Use setImmediate instead of process.nextTick to allow async operations to complete
    setImmediate(async () => {
      if (this.terminated) return;

      try {
        const result: WorkerResult = await processHealthCheck(message);
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

  /**
   * Simulate worker termination
   */
  async terminate(): Promise<number> {
    if (this.terminated) {
      return 0;
    }

    this.terminated = true;
    
    // Emit exit event asynchronously
    process.nextTick(() => {
      this.emit('exit', 0);
    });

    return 0;
  }

  /**
   * Check if worker has 'on' method (for pool-manager defensive checks)
   * Override EventEmitter.on to match Worker interface
   */
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}
