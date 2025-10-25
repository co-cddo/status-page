/**
 * Timeout constants for various operations throughout the application
 * All values in milliseconds
 */

export const TIMEOUTS = {
  /**
   * Maximum time to wait for graceful shutdown (30 seconds)
   * Used in: index.ts gracefulShutdown()
   */
  GRACEFUL_SHUTDOWN: 30_000,

  /**
   * Maximum time to wait for worker threads to shutdown (5 seconds)
   * Used in: index.ts worker pool shutdown
   */
  WORKER_SHUTDOWN: 5_000,

  /**
   * Interval for periodic health data writes (10 seconds)
   * Used in: index.ts writeHealthData interval
   */
  DATA_WRITE_INTERVAL: 10_000,

  /**
   * Default interval for health checks if not specified in config (60 seconds)
   * Used in: Configuration defaults
   */
  DEFAULT_CHECK_INTERVAL: 60_000,

  /**
   * Maximum time to wait for metrics server to shutdown (5 seconds)
   * Used in: index.ts metrics server shutdown
   */
  METRICS_SHUTDOWN: 5_000,

  /**
   * Default timeout for Eleventy build process (120 seconds)
   * Used in: orchestrator/eleventy-runner.ts
   */
  ELEVENTY_BUILD_TIMEOUT: 120_000,
} as const;
