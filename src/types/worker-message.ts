/**
 * TypeScript type definitions for worker thread message passing
 * Per ADR-0001: Worker threads communicate via structured message passing
 */

import type { HealthCheckConfig, HealthCheckResult, HealthCheckError } from './health-check.ts';

/**
 * Message types for worker thread communication
 * Note: Using const object instead of enum for Node.js 22 TypeScript compatibility
 */
export const WorkerMessageTypes = {
  /** Execute health check */
  HEALTH_CHECK: 'HEALTH_CHECK',

  /** Terminate worker gracefully */
  TERMINATE: 'TERMINATE',

  /** Health check ping (keep-alive) */
  PING: 'PING',
} as const;

export type WorkerMessageType = (typeof WorkerMessageTypes)[keyof typeof WorkerMessageTypes];

/**
 * Result types for worker responses
 * Note: Using const object instead of enum for Node.js 22 TypeScript compatibility
 */
export const WorkerResultTypes = {
  /** Health check completed successfully */
  SUCCESS: 'SUCCESS',

  /** Health check failed */
  ERROR: 'ERROR',

  /** Worker is ready */
  READY: 'READY',

  /** Pong response to ping */
  PONG: 'PONG',

  /** Worker terminating */
  TERMINATED: 'TERMINATED',
} as const;

export type WorkerResultType = (typeof WorkerResultTypes)[keyof typeof WorkerResultTypes];

/**
 * Message sent from main thread to worker thread
 * Discriminated union based on type
 */
export type WorkerMessage =
  | {
      type: typeof WorkerMessageTypes.HEALTH_CHECK;
      payload: HealthCheckConfig;
    }
  | {
      type: typeof WorkerMessageTypes.TERMINATE;
      payload?: undefined;
    }
  | {
      type: typeof WorkerMessageTypes.PING;
      payload?: undefined;
    };

/**
 * Result sent from worker thread to main thread
 * Discriminated union based on type
 */
export type WorkerResult =
  | {
      type: typeof WorkerResultTypes.SUCCESS;
      payload: HealthCheckResult;
    }
  | {
      type: typeof WorkerResultTypes.ERROR;
      payload: WorkerErrorPayload;
    }
  | {
      type: typeof WorkerResultTypes.READY;
      payload?: undefined;
    }
  | {
      type: typeof WorkerResultTypes.PONG;
      payload?: undefined;
    }
  | {
      type: typeof WorkerResultTypes.TERMINATED;
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
 * Note: Using const object instead of enum for Node.js 22 TypeScript compatibility
 */
export const WorkerStates = {
  IDLE: 'IDLE',
  BUSY: 'BUSY',
  TERMINATING: 'TERMINATING',
  TERMINATED: 'TERMINATED',
  ERROR: 'ERROR',
} as const;

export type WorkerState = (typeof WorkerStates)[keyof typeof WorkerStates];

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
