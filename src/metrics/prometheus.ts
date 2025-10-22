/**
 * Prometheus metrics setup using prom-client
 * Per FR-035: health_checks_total counter, health_check_latency_seconds histogram, services_failing gauge
 * Per ADR-0006: Bounded labels (service_name, status only) to prevent cardinality explosion
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

/**
 * Prometheus metrics registry
 * Single registry for all application metrics
 */
export const metricsRegistry = new Registry();

/**
 * health_checks_total counter
 * Tracks total number of health checks performed
 * Labels: service_name, status (PASS/DEGRADED/FAIL)
 */
export const healthChecksTotal = new Counter({
  name: 'health_checks_total',
  help: 'Total number of health checks performed',
  labelNames: ['service_name', 'status'] as const,
  registers: [metricsRegistry],
});

/**
 * health_check_latency_seconds histogram
 * Tracks health check response time distribution
 * Labels: service_name
 * Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s (per ADR-0006 research)
 */
export const healthCheckLatency = new Histogram({
  name: 'health_check_latency_seconds',
  help: 'Health check response time distribution in seconds',
  labelNames: ['service_name'] as const,
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
  registers: [metricsRegistry],
});

/**
 * services_failing gauge
 * Current number of services in FAIL status
 * No labels (scalar value per ADR-0006)
 */
export const servicesFailing = new Gauge({
  name: 'services_failing',
  help: 'Current number of services in FAIL status',
  registers: [metricsRegistry],
});

/**
 * Additional operational metrics
 */

/**
 * health_check_errors_total counter
 * Tracks health check errors by error type
 * Labels: service_name, error_type (timeout/network/http_status/validation/unknown)
 */
export const healthCheckErrors = new Counter({
  name: 'health_check_errors_total',
  help: 'Total number of health check errors by type',
  labelNames: ['service_name', 'error_type'] as const,
  registers: [metricsRegistry],
});

/**
 * worker_pool_size gauge
 * Current number of worker threads in the pool
 */
export const workerPoolSize = new Gauge({
  name: 'worker_pool_size',
  help: 'Current number of worker threads in the pool',
  registers: [metricsRegistry],
});

/**
 * worker_tasks_completed_total counter
 * Total tasks completed by worker threads
 */
export const workerTasksCompleted = new Counter({
  name: 'worker_tasks_completed_total',
  help: 'Total tasks completed by worker threads',
  registers: [metricsRegistry],
});

/**
 * csv_writes_total counter
 * Total CSV write operations
 */
export const csvWritesTotal = new Counter({
  name: 'csv_writes_total',
  help: 'Total CSV write operations',
  labelNames: ['status'] as const, // success/failure
  registers: [metricsRegistry],
});

/**
 * csv_records_written_total counter
 * Total health check records written to CSV
 */
export const csvRecordsWritten = new Counter({
  name: 'csv_records_written_total',
  help: 'Total health check records written to CSV',
  registers: [metricsRegistry],
});

/**
 * Record a health check result in Prometheus metrics
 *
 * @param serviceName - Name of the service checked
 * @param status - Health status (PASS/DEGRADED/FAIL)
 * @param latencyMs - Response latency in milliseconds
 */
export function recordHealthCheck(
  serviceName: string,
  status: 'PASS' | 'DEGRADED' | 'FAIL',
  latencyMs: number
): void {
  // Increment counter
  healthChecksTotal.labels(serviceName, status).inc();

  // Record latency histogram (convert ms to seconds)
  healthCheckLatency.labels(serviceName).observe(latencyMs / 1000);
}

/**
 * Record a health check error in Prometheus metrics
 *
 * @param serviceName - Name of the service that failed
 * @param errorType - Type of error (timeout/network/http_status/validation/unknown)
 */
export function recordHealthCheckError(
  serviceName: string,
  errorType: 'timeout' | 'network' | 'http_status' | 'text_validation' | 'header_validation' | 'unknown'
): void {
  healthCheckErrors.labels(serviceName, errorType).inc();
}

/**
 * Update the services_failing gauge
 *
 * This should be called after each health check cycle to reflect the current state
 *
 * @param count - Number of services currently in FAIL status
 */
export function updateServicesFailingCount(count: number): void {
  servicesFailing.set(count);
}

/**
 * Update worker pool metrics
 *
 * @param poolSize - Current number of workers in the pool
 */
export function updateWorkerPoolSize(poolSize: number): void {
  workerPoolSize.set(poolSize);
}

/**
 * Record a completed worker task
 */
export function recordWorkerTaskCompleted(): void {
  workerTasksCompleted.inc();
}

/**
 * Record a CSV write operation
 *
 * @param success - Whether the write succeeded
 * @param recordCount - Number of records written (if successful)
 */
export function recordCsvWrite(success: boolean, recordCount: number = 0): void {
  csvWritesTotal.labels(success ? 'success' : 'failure').inc();

  if (success && recordCount > 0) {
    csvRecordsWritten.inc(recordCount);
  }
}

/**
 * Get metrics in Prometheus exposition format
 *
 * This is used by the /metrics HTTP endpoint
 *
 * @returns Prometheus metrics string
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get metrics as JSON (for debugging)
 *
 * @returns Metrics in JSON format
 */
export async function getMetricsJSON(): Promise<unknown> {
  return metricsRegistry.getMetricsAsJSON();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}

/**
 * Clear all metrics (removes all registered metrics)
 */
export function clearMetrics(): void {
  metricsRegistry.clear();
}
