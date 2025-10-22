/**
 * Test assertion helpers for type-safe null checks
 *
 * These helpers provide runtime safety guards beyond TypeScript's toBeDefined() checks,
 * ensuring tests fail gracefully when assumptions are violated.
 */

import { expect } from 'vitest';

/**
 * Assert that a value is defined (not null or undefined)
 *
 * This function combines Vitest's expect with TypeScript's assertion signature
 * to provide both runtime checking and compile-time type narrowing.
 *
 * @param value - Value to check
 * @param message - Optional error message
 * @throws Error if value is null or undefined
 *
 * @example
 * ```typescript
 * const job = workflow.jobs.test;
 * assertDefined(job, 'Test job not found');
 * // Now TypeScript knows job is not undefined
 * const steps = job.steps;
 * ```
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string
): asserts value is T {
  expect(value).toBeDefined();
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Assert that an object has a specific property and it's defined
 *
 * @param obj - Object to check
 * @param key - Property key
 * @param message - Optional error message
 *
 * @example
 * ```typescript
 * const workflow = load(yaml) as GitHubActionsWorkflow;
 * assertHasProperty(workflow, 'jobs', 'Workflow missing jobs');
 * // Now TypeScript knows workflow.jobs exists
 * ```
 */
export function assertHasProperty<T extends object, K extends string>(
  obj: T,
  key: K,
  message?: string
): asserts obj is T & Record<K, unknown> {
  expect(obj).toHaveProperty(key);
  if (!(key in obj)) {
    throw new Error(message || `Expected object to have property '${key}'`);
  }
}

/**
 * Assert that an array has at least one element
 *
 * @param arr - Array to check
 * @param message - Optional error message
 *
 * @example
 * ```typescript
 * const steps = job.steps;
 * assertNotEmpty(steps, 'Job has no steps');
 * const firstStep = steps[0]; // Now safe to access
 * ```
 */
export function assertNotEmpty<T>(
  arr: T[],
  message?: string
): asserts arr is [T, ...T[]] {
  expect(arr.length).toBeGreaterThan(0);
  if (arr.length === 0) {
    throw new Error(message || 'Expected array to have at least one element');
  }
}

/**
 * Assert that a value is truthy
 *
 * @param value - Value to check
 * @param message - Optional error message
 *
 * @example
 * ```typescript
 * const result = workflow.on?.schedule?.[0]?.cron;
 * assertTruthy(result, 'Cron schedule not found');
 * // Now TypeScript knows result is truthy
 * expect(result).toMatch(/\d+/);
 * ```
 */
export function assertTruthy<T>(
  value: T,
  message?: string
): asserts value is NonNullable<T> {
  expect(value).toBeTruthy();
  if (!value) {
    throw new Error(message || 'Expected value to be truthy');
  }
}
