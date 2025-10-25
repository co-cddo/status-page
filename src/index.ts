/**
 * Main orchestrator entry point for GOV.UK status monitoring application
 * T040: Create main orchestrator entry point
 *
 * Responsibilities:
 * - Load and validate config.yaml (exit if invalid)
 * - Initialize structured logging with correlation ID
 * - Start Prometheus metrics server on port 9090
 * - Initialize worker pool for concurrent health checks
 * - Start scheduler for health check cycles
 * - Handle graceful shutdown (SIGTERM/SIGINT)
 * - Run via tsx with Node.js 22+ native TypeScript support
 */

import { loadConfiguration, ConfigurationLoadError } from './config/loader.ts';
import { validateConfiguration, ConfigurationValidationError } from './config/validator.ts';
import { logger, createChildLogger, flushLogs } from './logging/logger.ts';
import { generateCorrelationId } from './logging/correlation.ts';
import { startMetricsServer, stopMetricsServer } from './metrics/server.ts';
import { WorkerPoolManager } from './orchestrator/pool-manager.ts';
import { Scheduler } from './orchestrator/scheduler.ts';
import { storageFactory } from './storage/index.ts';
import type { ICsvWriter, IJsonWriter } from './storage/index.ts';
import type { Configuration } from './types/config.ts';
import type { HealthCheckConfig } from './types/health-check.ts';
import { TIMEOUTS } from './constants/timeouts.ts';
import { getErrorMessage } from './utils/error.ts';

/**
 * Application state
 */
interface AppState {
  poolManager: WorkerPoolManager | null;
  scheduler: Scheduler | null;
  jsonWriter: IJsonWriter | null;
  csvWriter: ICsvWriter | null;
  dataWriterTimer: NodeJS.Timeout | null;
  shutdownInProgress: boolean;
  shutdownStartTime: number | null;
  serviceTags: Map<string, string[]>;
}

const state: AppState = {
  poolManager: null,
  scheduler: null,
  jsonWriter: null,
  csvWriter: null,
  dataWriterTimer: null,
  shutdownInProgress: false,
  shutdownStartTime: null,
  serviceTags: new Map(),
};

/**
 * Load and validate configuration
 * Exits with code 1 on failure
 */
function loadAndValidateConfig(): Configuration {
  const correlationId = generateCorrelationId();
  const configLogger = createChildLogger({ correlationId, phase: 'config-load' });

  try {
    configLogger.info('Loading configuration from config.yaml');
    const config = loadConfiguration('config.yaml');

    configLogger.info({ serviceCount: config.pings.length }, 'Configuration loaded successfully');

    configLogger.info('Validating configuration');
    validateConfiguration(config);

    configLogger.info('Configuration validated successfully');

    return config;
  } catch (error) {
    if (error instanceof ConfigurationLoadError) {
      configLogger.error({ err: error, filePath: error.filePath }, 'Failed to load configuration');
      console.error(`\n❌ Configuration load error: ${error.message}\n`);
      process.exit(1);
    }

    if (error instanceof ConfigurationValidationError) {
      configLogger.error(
        { err: error, errorCount: error.errors.length },
        'Configuration validation failed'
      );
      console.error(error.formatForStderr());
      process.exit(1);
    }

    // Unexpected error
    configLogger.fatal({ err: error }, 'Unexpected error loading configuration');
    console.error(`\n❌ Unexpected error: ${getErrorMessage(error)}\n`);
    process.exit(1);
  }
}

/**
 * Initialize worker pool
 */
async function initializeWorkerPool(config: Configuration): Promise<WorkerPoolManager> {
  const correlationId = generateCorrelationId();
  const poolLogger = createChildLogger({ correlationId, phase: 'pool-init' });

  try {
    const poolSize = config.settings?.worker_pool_size ?? 0;
    poolLogger.info({ configuredPoolSize: poolSize }, 'Initializing worker pool');

    const poolManager = new WorkerPoolManager(poolSize === 0 ? undefined : { poolSize });

    await poolManager.initialize();

    const metrics = poolManager.getMetrics();
    poolLogger.info(
      { totalWorkers: metrics.totalWorkers, poolSize: metrics.totalWorkers },
      'Worker pool initialized'
    );

    return poolManager;
  } catch (error) {
    poolLogger.fatal({ err: error }, 'Failed to initialize worker pool');
    throw error;
  }
}

/**
 * Initialize scheduler and schedule services
 */
function initializeScheduler(poolManager: WorkerPoolManager, config: Configuration): Scheduler {
  const correlationId = generateCorrelationId();
  const schedulerLogger = createChildLogger({ correlationId, phase: 'scheduler-init' });

  try {
    const defaultInterval = (config.settings?.check_interval ?? 60) * 1000; // Convert to ms
    const gracefulShutdownTimeout = TIMEOUTS.GRACEFUL_SHUTDOWN;

    schedulerLogger.info(
      { defaultIntervalMs: defaultInterval, gracefulShutdownTimeoutMs: gracefulShutdownTimeout },
      'Initializing scheduler'
    );

    const scheduler = new Scheduler(poolManager, {
      defaultInterval,
      gracefulShutdownTimeout,
    });

    // Schedule all services from config
    for (const ping of config.pings) {
      const intervalMs = ping.interval ? ping.interval * 1000 : defaultInterval;
      const warningThreshold =
        (ping.warning_threshold ?? config.settings?.warning_threshold ?? 2) * 1000;
      const timeout = (ping.timeout ?? config.settings?.timeout ?? 5) * 1000;

      // Build config with only defined optional properties
      const healthCheckConfig: HealthCheckConfig = {
        serviceName: ping.name,
        method: ping.method,
        url: ping.resource,
        timeout,
        warningThreshold,
        maxRetries: config.settings?.max_retries ?? 3,
        expectedStatus: ping.expected.status,
        correlationId: generateCorrelationId(),
        ...(ping.expected.text !== undefined && { expectedText: ping.expected.text }),
        ...(ping.expected.headers !== undefined && { expectedHeaders: ping.expected.headers }),
        ...(ping.headers !== undefined && { headers: ping.headers }),
        ...(ping.payload !== undefined && { payload: ping.payload }),
      };

      scheduler.scheduleService(healthCheckConfig, intervalMs);

      schedulerLogger.debug(
        {
          serviceName: ping.name,
          intervalMs,
          warningThresholdMs: warningThreshold,
          timeoutMs: timeout,
        },
        'Service scheduled'
      );
    }

    schedulerLogger.info(
      { serviceCount: config.pings.length, queueSize: scheduler.getQueueSize() },
      'Scheduler initialized with all services'
    );

    return scheduler;
  } catch (error) {
    schedulerLogger.fatal({ err: error }, 'Failed to initialize scheduler');
    throw error;
  }
}

/**
 * Write health check results to _data/health.json and history.csv
 */
async function writeHealthData(): Promise<void> {
  if (!state.scheduler || !state.jsonWriter || !state.csvWriter) {
    return;
  }

  try {
    const results = state.scheduler.getLatestResults();
    if (results.length > 0) {
      // Write to JSON (overwrites with latest status)
      await state.jsonWriter.write(results, state.serviceTags);

      // Append to CSV (historical record)
      await state.csvWriter.appendBatch(results);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to write health data');
  }
}

/**
 * Start periodic health data writer
 * Writes _data/health.json every 10 seconds
 */
function startDataWriter(): void {
  // Write immediately on start
  writeHealthData().catch((error) => {
    logger.error({ err: error }, 'Initial health data write failed');
  });

  // Then write every 10 seconds
  state.dataWriterTimer = setInterval(() => {
    writeHealthData().catch((error) => {
      logger.error({ err: error }, 'Periodic health data write failed');
    });
  }, TIMEOUTS.DATA_WRITE_INTERVAL);
}

/**
 * Stop periodic health data writer
 */
function stopDataWriter(): void {
  if (state.dataWriterTimer) {
    clearInterval(state.dataWriterTimer);
    state.dataWriterTimer = null;
  }
}

/**
 * Graceful shutdown handler
 * Ensures clean shutdown within 30 seconds
 */
async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown attempts
  if (state.shutdownInProgress) {
    logger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
    return;
  }

  state.shutdownInProgress = true;
  state.shutdownStartTime = Date.now();

  const correlationId = generateCorrelationId();
  const shutdownLogger = createChildLogger({ correlationId, phase: 'shutdown', signal });

  shutdownLogger.info('Starting graceful shutdown');

  try {
    // 1. Stop data writer and write final health data
    shutdownLogger.info('Stopping data writer');
    stopDataWriter();
    await writeHealthData();
    shutdownLogger.info('Final health data written');

    // 2. Stop scheduler from triggering new health check cycles
    if (state.scheduler) {
      shutdownLogger.info('Stopping scheduler');
      await state.scheduler.stop();
      shutdownLogger.info('Scheduler stopped');
    }

    // 3. Shutdown worker pool (waits for in-flight checks up to 30s)
    if (state.poolManager) {
      shutdownLogger.info('Shutting down worker pool');
      await state.poolManager.shutdown({ gracefulTimeout: TIMEOUTS.GRACEFUL_SHUTDOWN });
      const metrics = state.poolManager.getMetrics();
      shutdownLogger.info(
        {
          completedTasks: metrics.completedTasks,
          failedTasks: metrics.failedTasks,
          workerCrashes: metrics.workerCrashes,
        },
        'Worker pool shut down'
      );
    }

    // 4. Stop Prometheus metrics server
    shutdownLogger.info('Stopping metrics server');
    await stopMetricsServer(TIMEOUTS.METRICS_SHUTDOWN);
    shutdownLogger.info('Metrics server stopped');

    // 4. Flush logs
    await flushLogs();

    const shutdownDuration = Date.now() - state.shutdownStartTime;
    shutdownLogger.info({ shutdownDurationMs: shutdownDuration }, 'Graceful shutdown complete');

    // Exit cleanly
    process.exit(0);
  } catch (error) {
    shutdownLogger.error({ err: error }, 'Error during graceful shutdown');

    // Force exit after logging error
    await flushLogs();
    process.exit(1);
  }
}

/**
 * Unhandled rejection handler
 * Logs rejections but continues operation (don't crash)
 */
function handleUnhandledRejection(reason: unknown): void {
  const correlationId = generateCorrelationId();
  const errorLogger = createChildLogger({ correlationId, phase: 'unhandled-rejection' });

  errorLogger.error(
    {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    },
    'Unhandled promise rejection detected'
  );

  // Per requirements: Log and continue, don't crash
}

/**
 * Uncaught exception handler
 * Logs exception and exits with code 1
 */
function handleUncaughtException(error: Error, origin: string): void {
  const correlationId = generateCorrelationId();
  const errorLogger = createChildLogger({ correlationId, phase: 'uncaught-exception' });

  errorLogger.fatal(
    {
      err: error,
      origin,
    },
    'Uncaught exception detected'
  );

  console.error('\n❌ Uncaught exception:', error.message);
  console.error(error.stack);

  // Flush logs and exit
  flushLogs().then(() => {
    process.exit(1);
  });
}

/**
 * Run all health checks once and exit (CI mode)
 */
async function runOnce(config: Configuration): Promise<void> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const onceLogger = createChildLogger({ correlationId, phase: 'once-mode' });

  onceLogger.info({ serviceCount: config.pings.length }, 'Running health checks once (CI mode)');

  try {
    // Extract service tags for JSON writer
    for (const ping of config.pings) {
      if (ping.tags && ping.tags.length > 0) {
        state.serviceTags.set(ping.name, ping.tags);
      }
    }

    // Initialize worker pool
    state.poolManager = await initializeWorkerPool(config);

    // Initialize scheduler (but don't start it)
    state.scheduler = initializeScheduler(state.poolManager, config);

    // Initialize JSON and CSV writers using factory pattern
    state.jsonWriter = storageFactory.createWriter('json', { filePath: '_data/health.json' });
    state.csvWriter = storageFactory.createWriter('csv', { filePath: 'history.csv' });

    // Run all health checks once
    // Note: runOnce() uses Promise.all() internally, so all results are
    // guaranteed to be in latestResults map when this returns
    onceLogger.info('Executing all health checks');
    await state.scheduler.runOnce();

    // Write final health data
    onceLogger.info('Writing health data');
    await writeHealthData();

    const duration = Date.now() - startTime;
    const results = state.scheduler.getLatestResults();
    onceLogger.info(
      {
        durationMs: duration,
        checksCompleted: results.length,
        passCount: results.filter((r) => r.status === 'PASS').length,
        degradedCount: results.filter((r) => r.status === 'DEGRADED').length,
        failCount: results.filter((r) => r.status === 'FAIL').length,
      },
      'Health checks completed successfully'
    );

    await flushLogs();
    process.exit(0);
  } catch (error) {
    onceLogger.fatal({ err: error }, 'Fatal error during once-mode execution');
    console.error('\n❌ Fatal error:', getErrorMessage(error));

    await flushLogs();
    process.exit(1);
  } finally {
    // Ensure worker pool cleanup always happens
    if (state.poolManager) {
      try {
        onceLogger.info('Shutting down worker pool');
        await state.poolManager.shutdown({ gracefulTimeout: TIMEOUTS.WORKER_SHUTDOWN });
      } catch (cleanupError) {
        onceLogger.error({ err: cleanupError }, 'Error during pool shutdown');
      }
    }
  }
}

/**
 * Main orchestrator function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();
  const mainLogger = createChildLogger({ correlationId, phase: 'startup' });

  // Check for --once flag
  const onceMode = process.argv.includes('--once');

  mainLogger.info(
    {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      mode: onceMode ? 'once' : 'daemon',
    },
    'GOV.UK Status Monitor starting'
  );

  try {
    // 1. Load and validate configuration
    const config = loadAndValidateConfig();

    // If in once mode, run checks and exit
    if (onceMode) {
      await runOnce(config);
      return; // Exit handled in runOnce
    }

    // Continue with normal daemon mode
    // Extract service tags for JSON writer
    for (const ping of config.pings) {
      if (ping.tags && ping.tags.length > 0) {
        state.serviceTags.set(ping.name, ping.tags);
      }
    }

    // 2. Start Prometheus metrics server
    const metricsPort = parseInt(process.env.PROMETHEUS_PORT ?? '9090', 10);
    mainLogger.info({ port: metricsPort }, 'Starting Prometheus metrics server');
    await startMetricsServer({ port: metricsPort });

    // 3. Initialize worker pool
    state.poolManager = await initializeWorkerPool(config);

    // 4. Initialize and start scheduler
    state.scheduler = initializeScheduler(state.poolManager, config);
    state.scheduler.start();
    mainLogger.info('Scheduler started');

    // 5. Initialize JSON and CSV writers using factory pattern, start periodic data writer
    state.jsonWriter = storageFactory.createWriter('json', { filePath: '_data/health.json' });
    state.csvWriter = storageFactory.createWriter('csv', { filePath: 'history.csv' });
    startDataWriter();
    mainLogger.info('Health data writer started (JSON + CSV)');

    // 5. Setup signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 6. Setup error handlers
    process.on('unhandledRejection', handleUnhandledRejection);
    process.on('uncaughtException', handleUncaughtException);

    const startupDuration = Date.now() - startTime;
    mainLogger.info(
      {
        startupDurationMs: startupDuration,
        serviceCount: config.pings.length,
        workerCount: state.poolManager.getMetrics().totalWorkers,
        metricsPort,
      },
      'GOV.UK Status Monitor started successfully'
    );

    // Application is now running and will continue until signal received
  } catch (error) {
    mainLogger.fatal({ err: error }, 'Fatal error during startup');
    console.error('\n❌ Fatal error:', getErrorMessage(error));

    // Attempt cleanup
    if (state.poolManager) {
      await state.poolManager.shutdown({ gracefulTimeout: TIMEOUTS.WORKER_SHUTDOWN });
    }
    await stopMetricsServer(TIMEOUTS.METRICS_SHUTDOWN);
    await flushLogs();

    process.exit(1);
  }
}

// Run the orchestrator
main().catch((error) => {
  console.error('\n❌ Unhandled error in main:', error);
  process.exit(1);
});
