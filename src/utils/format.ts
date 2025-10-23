/**
 * Formatting utilities for display values
 */

/**
 * Format latency value for human-readable display
 * @param latency_ms - Latency in milliseconds
 * @returns Formatted string (e.g., "150 ms" or "3.5 s")
 * @example
 * ```typescript
 * formatLatency(150)  // Returns: "150 ms"
 * formatLatency(3500) // Returns: "3.5 s"
 * formatLatency(-1)   // Returns: "N/A"
 * ```
 */
export function formatLatency(latency_ms: number): string {
  if (typeof latency_ms !== 'number' || latency_ms < 0 || !isFinite(latency_ms)) {
    return 'N/A';
  }

  if (latency_ms < 1000) {
    return `${latency_ms} ms`;
  }

  return `${(latency_ms / 1000).toFixed(1)} s`;
}

/**
 * Format ISO timestamp for display
 * @param timestamp - ISO 8601 timestamp string or Date object
 * @returns Formatted timestamp string
 * @example
 * ```typescript
 * formatTimestamp(new Date())           // Returns: "2025-10-22T20:45:00.000Z"
 * formatTimestamp('2025-10-22T20:45:00') // Returns: "2025-10-22T20:45:00.000Z"
 * ```
 */
export function formatTimestamp(timestamp: Date | string): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toISOString();
  } catch {
    return 'Invalid Date';
  }
}
