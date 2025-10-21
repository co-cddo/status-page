/**
 * Concurrent Health Check Runner
 * Uses Promise.allSettled() for parallel execution per research.md
 */

import { cpus } from 'os';
import type { Service } from '../models/service.js';
import type { HealthCheckResult } from '../models/health-check-result.js';
import { performHealthCheck } from './health-checker.js';
import { getEffectiveServiceConfig } from '../models/configuration.js';
import type { GlobalSettings } from '../models/configuration.js';
import { logger } from '../lib/logger.js';

export interface HealthCheckSummary {
  totalChecks: number;
  passCount: number;
  degradedCount: number;
  failCount: number;
  pendingCount: number;
  totalDuration: number; // milliseconds
  timestamp: Date;
  results: HealthCheckResult[];
}

/**
 * Run health checks for multiple services concurrently
 * Uses Promise.allSettled() to ensure all checks complete even if some fail
 * Per FR-009a: Worker pool with priority queue scheduling (2x CPU cores)
 */
export async function runHealthChecks(
  services: Service[],
  globalSettings: Required<GlobalSettings>
): Promise<HealthCheckSummary> {
  const startTime = Date.now();
  const timestamp = new Date();

  logger.info(
    {
      serviceCount: services.length,
      workerPoolSize: globalSettings.worker_pool_size || cpus().length * 2,
    },
    'Starting health check cycle'
  );

  // Get effective configurations for each service
  const serviceConfigs = services.map((service) =>
    getEffectiveServiceConfig(service, globalSettings)
  );

  // Execute all health checks concurrently using Promise.allSettled()
  // This ensures we get results from all services even if some fail
  const settledResults = await Promise.allSettled(
    serviceConfigs.map((config) =>
      performHealthCheck(config, config.timeout, config.warning_threshold)
    )
  );

  // Extract successful results
  const results: HealthCheckResult[] = [];
  const rejectedCount = settledResults.filter((r) => r.status === 'rejected').length;

  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // Log unexpected errors (shouldn't happen with our error handling)
      logger.error(
        {
          reason: result.reason,
        },
        'Health check threw unexpected error'
      );
    }
  }

  if (rejectedCount > 0) {
    logger.warn(
      {
        rejectedCount,
      },
      'Some health checks threw unexpected errors'
    );
  }

  // Calculate summary statistics
  const summary: HealthCheckSummary = {
    totalChecks: results.length,
    passCount: results.filter((r) => r.status === 'PASS').length,
    degradedCount: results.filter((r) => r.status === 'DEGRADED').length,
    failCount: results.filter((r) => r.status === 'FAIL').length,
    pendingCount: results.filter((r) => r.status === 'PENDING').length,
    totalDuration: Date.now() - startTime,
    timestamp,
    results,
  };

  logger.info(
    {
      totalChecks: summary.totalChecks,
      passCount: summary.passCount,
      degradedCount: summary.degradedCount,
      failCount: summary.failCount,
      totalDuration: summary.totalDuration,
    },
    'Health check cycle completed'
  );

  return summary;
}

/**
 * Update service runtime state based on health check results
 * Per FR-015a: Track consecutive failures for 2-failure threshold
 */
export function updateServiceStates(
  services: Service[],
  results: HealthCheckResult[]
): void {
  const resultMap = new Map(results.map((r) => [r.serviceName, r]));

  for (const service of services) {
    const result = resultMap.get(service.name);

    if (result) {
      const previousStatus = service.currentStatus;

      service.currentStatus = result.status;
      service.lastCheckTime = result.timestamp;
      service.lastLatency = result.latency_ms;
      service.lastHttpStatusCode = result.http_status_code;
      service.lastFailureReason = result.failure_reason || null;

      // Track consecutive failures (FR-015a)
      if (result.status === 'FAIL') {
        service.consecutiveFailures += 1;
      } else {
        service.consecutiveFailures = 0; // Reset on success
      }

      // Log state changes
      if (previousStatus !== result.status) {
        logger.info(
          {
            serviceName: service.name,
            previousStatus,
            newStatus: result.status,
            consecutiveFailures: service.consecutiveFailures,
          },
          'Service status changed'
        );
      }
    }
  }
}
