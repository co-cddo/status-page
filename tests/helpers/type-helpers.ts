/**
 * Shared type helpers for test files
 *
 * Centralizes common type patterns used across test suite to ensure
 * consistency and reduce duplication.
 */

import type { Counter, Histogram, Gauge } from 'prom-client';
import type { Logger } from 'pino';

/**
 * Process.exit mock type that matches Node.js signature
 * Required because process.exit can accept string | number | null | undefined
 */
export type ProcessExitMock = (code?: string | number | null | undefined) => never;

/**
 * Testable Prometheus Counter type that exposes internal metadata
 * Used for verifying counter configuration in tests
 */
export interface TestableCounter<T extends string = string> extends Counter<T> {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[] | undefined;
  readonly registers: unknown[];
}

/**
 * Testable Prometheus Histogram type that exposes internal metadata
 * Used for verifying histogram configuration in tests
 */
export interface TestableHistogram<T extends string = string> extends Histogram<T> {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[] | undefined;
  readonly buckets: number[];
  readonly registers: unknown[];
}

/**
 * Testable Prometheus Gauge type that exposes internal metadata
 * Used for verifying gauge configuration in tests
 */
export interface TestableGauge<T extends string = string> extends Gauge<T> {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[] | undefined;
  readonly registers: unknown[];
}

/**
 * Logger with event emitter interface for stream testing
 * Required because Pino logger stream events aren't fully typed
 * Note: This is a minimal interface for testing, not a full Logger extension
 */
export interface LoggerWithEvents {
  on(event: 'data', callback: (chunk: string) => void): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Type helper to safely cast metrics to testable types
 * Provides type safety while accessing internal Prometheus metric properties
 */
export function asTestableCounter<T extends string = string>(
  counter: Counter<T>
): TestableCounter<T> {
  return counter as unknown as TestableCounter<T>;
}

export function asTestableHistogram<T extends string = string>(
  histogram: Histogram<T>
): TestableHistogram<T> {
  return histogram as unknown as TestableHistogram<T>;
}

export function asTestableGauge<T extends string = string>(
  gauge: Gauge<T>
): TestableGauge<T> {
  return gauge as unknown as TestableGauge<T>;
}

/**
 * Type helper to safely cast logger to event emitter
 * Used for testing log stream output
 */
export function asLoggerWithEvents(_logger: Logger): LoggerWithEvents {
  // Type assertion through unknown for compatibility with Pino's stream interface
  return _logger as unknown as LoggerWithEvents;
}
