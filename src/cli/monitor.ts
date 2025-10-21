#!/usr/bin/env node
/**
 * CLI Entry Point - GOV.UK Status Monitor
 * Per FR-032: Graceful shutdown handling
 */

import { parseYamlConfig } from '../lib/yaml-parser.js';
import { validateConfiguration } from '../lib/config-validator.js';
import { getEffectiveSettings } from '../models/configuration.js';
import { createService } from '../models/service.js';
import { runHealthChecks, updateServiceStates } from '../services/health-check-runner.js';
import { writeServicesData } from '../services/file-writer.js';
import { createHistoricalCsvWriter } from '../lib/csv-writer.js';
import { toHistoricalRecord } from '../models/historical-record.js';
import { logger } from '../lib/logger.js';
import type { Service } from '../models/service.js';

// Configuration
const CONFIG_FILE = process.env.CONFIG_FILE || 'config.yaml';
const DATA_FILE = process.env.DATA_FILE || '_data/services.json';
const API_FILE = process.env.API_FILE || '_site/api/status.json';

// State
let services: Service[] = [];
let isShuttingDown = false;
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Main entry point
 */
async function main() {
  logger.info(
    {
      configFile: CONFIG_FILE,
      dataFile: DATA_FILE,
      apiFile: API_FILE,
    },
    'Starting GOV.UK Status Monitor'
  );

  try {
    // Load and validate configuration
    const config = await parseYamlConfig(CONFIG_FILE);
    validateConfiguration(config);

    const settings = getEffectiveSettings(config.settings);

    logger.info(
      {
        serviceCount: config.pings.length,
        checkInterval: settings.check_interval,
        workerPoolSize: settings.worker_pool_size,
      },
      'Configuration loaded successfully'
    );

    // Initialize services
    services = config.pings.map(createService);

    // Initialize CSV writer
    const csvWriter = createHistoricalCsvWriter(settings.history_file);
    await csvWriter.initialize();

    logger.info(
      {
        historyFile: settings.history_file,
      },
      'CSV history file initialized'
    );

    // Setup graceful shutdown handlers (FR-032)
    setupShutdownHandlers();

    // Run initial health check
    await runHealthCheckCycle(settings, csvWriter);

    // Setup recurring health checks
    healthCheckInterval = setInterval(
      () => {
        if (!isShuttingDown) {
          runHealthCheckCycle(settings, csvWriter).catch((error) => {
            logger.error(
              {
                err: error,
              },
              'Health check cycle failed'
            );
          });
        }
      },
      settings.check_interval * 1000
    );

    logger.info(
      {
        intervalSeconds: settings.check_interval,
      },
      'Health check cycle started'
    );
  } catch (error) {
    logger.fatal(
      {
        err: error,
      },
      'Failed to start monitor'
    );
    process.exit(1);
  }
}

/**
 * Run a single health check cycle
 */
async function runHealthCheckCycle(
  settings: ReturnType<typeof getEffectiveSettings>,
  csvWriter: ReturnType<typeof createHistoricalCsvWriter>
): Promise<void> {
  try {
    // Run health checks
    const summary = await runHealthChecks(services, settings);

    // Update service states
    updateServiceStates(services, summary.results);

    // Write historical data to CSV (FR-018, FR-020)
    const historicalRecords = summary.results.map(toHistoricalRecord);
    await csvWriter.appendRecords(historicalRecords);

    logger.info(
      {
        recordCount: historicalRecords.length,
      },
      'Wrote health check results to CSV'
    );

    // Write current status to JSON files (FR-028)
    await writeServicesData(services, DATA_FILE, API_FILE);

    logger.info(
      {
        passCount: summary.passCount,
        degradedCount: summary.degradedCount,
        failCount: summary.failCount,
        duration: summary.totalDuration,
      },
      'Health check cycle completed successfully'
    );
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      'Error during health check cycle'
    );
    throw error;
  }
}

/**
 * Setup graceful shutdown handlers
 * Per FR-032: Complete in-flight health checks before exit
 */
function setupShutdownHandlers() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    logger.info(
      {
        signal,
      },
      'Received shutdown signal, gracefully shutting down'
    );

    // Stop accepting new health check cycles
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // Wait a bit for in-flight checks to complete
    // (health checks have their own timeout, so this is a safety net)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info('Shutdown complete');
    process.exit(0);
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal(
      {
        err: error,
      },
      'Uncaught exception'
    );
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal(
      {
        reason,
      },
      'Unhandled promise rejection'
    );
    process.exit(1);
  });
}

// Start the monitor
main().catch((error) => {
  logger.fatal(
    {
      err: error,
    },
    'Fatal error in main'
  );
  process.exit(1);
});
