/**
 * TypeScript type definitions for worker thread message passing
 * Per ADR-0001: Worker threads communicate via structured message passing
 */

import type { HealthCheckConfig, HealthCheckResult, HealthCheckError } from './health-check.ts';

/**
 * Message types for worker thread communication
 */
export enum WorkerMessageType {
  /** Execute health check */
  HEALTH_CHECK = 'HEALTH_CHECK',

  /** Terminate worker gracefully */
  TERMINATE = 'TERMINATE',

  /** Health check ping (keep-alive) */
  PING = 'PING',
}

/**
 * Result types for worker responses
 */
export enum WorkerResultType {
  /** Health check completed successfully */
  SUCCESS = 'SUCCESS',

  /** Health check failed */
  ERROR = 'ERROR',

  /** Worker is ready */
  READY = 'READY',

  /** Pong response to ping */
  PONG = 'PONG',

  /** Worker terminating */
  TERMINATED = 'TERMINATED',
}

/**
 * Message sent from main thread to worker thread
 * Discriminated union based on type
 */
export type WorkerMessage =
  | {
      type: WorkerMessageType.HEALTH_CHECK;
      payload: HealthCheckConfig;
    }
  | {
      type: WorkerMessageType.TERMINATE;
      payload?: undefined;
    }
  | {
      type: WorkerMessageType.PING;
      payload?: undefined;
    };

/**
 * Result sent from worker thread to main thread
 * Discriminated union based on type
 */
export type WorkerResult =
  | {
      type: WorkerResultType.SUCCESS;
      payload: HealthCheckResult;
    }
  | {
      type: WorkerResultType.ERROR;
      payload: WorkerErrorPayload;
    }
  | {
      type: WorkerResultType.READY;
      payload?: undefined;
    }
  | {
      type: WorkerResultType.PONG;
      payload?: undefined;
    }
  | {
      type: WorkerResultType.TERMINATED;
      payload?: undefined;
    };

/**
 * Error payload for failed health checks or worker errors
 */
export interface WorkerErrorPayload {
  /** Service name that failed (if applicable) */
  serviceName?: string;

  /** Correlation ID for tracing */
  correlationId?: string;

  /** Structured error information */
  error: HealthCheckError;

  /** Stack trace (in development/debug mode) */
  stack?: string;

  /** Timestamp of error */
  timestamp: Date;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Number of worker threads (0 = auto: 2x CPU cores) */
  poolSize: number;

  /** Maximum tasks per worker before restart */
  maxTasksPerWorker?: number;

  /** Worker idle timeout in milliseconds */
  idleTimeout?: number;

  /** Maximum retries for worker failures */
  maxRetries?: number;
}

/**
 * Worker pool statistics
 */
export interface WorkerPoolStats {
  /** Total workers in pool */
  totalWorkers: number;

  /** Active workers (executing tasks) */
  activeWorkers: number;

  /** Idle workers (waiting for tasks) */
  idleWorkers: number;

  /** Terminated workers */
  terminatedWorkers: number;

  /** Total tasks completed */
  tasksCompleted: number;

  /** Total tasks failed */
  tasksFailed: number;

  /** Pending tasks in queue */
  pendingTasks: number;
}

/**
 * Worker state
 */
export enum WorkerState {
  IDLE = 'IDLE',
  BUSY = 'BUSY',
  TERMINATING = 'TERMINATING',
  TERMINATED = 'TERMINATED',
  ERROR = 'ERROR',
}

/**
 * Worker metadata for pool management
 */
export interface WorkerMetadata {
  /** Worker ID (unique within pool) */
  id: number;

  /** Current worker state */
  state: WorkerState;

  /** Tasks completed by this worker */
  tasksCompleted: number;

  /** Tasks failed by this worker */
  tasksFailed: number;

  /** Worker creation timestamp */
  createdAt: Date;

  /** Last activity timestamp */
  lastActivity: Date;
}
