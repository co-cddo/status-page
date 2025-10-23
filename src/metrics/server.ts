/**
 * Prometheus HTTP server for /metrics endpoint
 * Per FR-035: Expose /metrics endpoint on port 9090 (PROMETHEUS_PORT env var)
 */

import { createServer, type Server } from 'node:http';
import { getMetrics } from './prometheus.ts';
import { logger } from '../logging/logger.ts';

/**
 * Prometheus metrics server configuration
 */
export interface MetricsServerConfig {
  /** Port to listen on (default: 9090, or PROMETHEUS_PORT env var) */
  port?: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /** Path for metrics endpoint (default: '/metrics') */
  path?: string;
}

/**
 * Metrics server state
 */
interface MetricsServerState {
  server: Server | null;
  config: Required<MetricsServerConfig>;
  isRunning: boolean;
}

/**
 * Global metrics server state
 */
const state: MetricsServerState = {
  server: null,
  config: {
    port: parseInt(process.env.PROMETHEUS_PORT ?? '9090', 10),
    host: '0.0.0.0',
    path: '/metrics',
  },
  isRunning: false,
};

/**
 * Start the Prometheus metrics HTTP server
 *
 * Per FR-035: "Expose /metrics endpoint for Prometheus scraping"
 *
 * @param config - Server configuration
 * @returns Promise that resolves when server is listening
 *
 * @example
 * ```typescript
 * await startMetricsServer({ port: 9090 });
 * console.log('Metrics available at http://localhost:9090/metrics');
 * ```
 */
export async function startMetricsServer(
  config: MetricsServerConfig = {}
): Promise<void> {
  // Merge with defaults
  state.config = {
    ...state.config,
    ...config,
  };

  // Check if already running
  if (state.isRunning) {
    logger.warn({ port: state.config.port }, 'Metrics server already running');
    return;
  }

  // Create HTTP server
  state.server = createServer(async (req, res) => {
    // Only handle GET requests to the metrics path
    if (req.method === 'GET' && req.url === state.config.path) {
      try {
        const metrics = await getMetrics();

        res.writeHead(200, {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Content-Length': Buffer.byteLength(metrics),
        });
        res.end(metrics);

        logger.debug({ path: req.url }, 'Metrics scraped');
      } catch (error) {
        logger.error({ err: error }, 'Failed to generate metrics');

        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    } else {
      // Return 404 for other paths
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n\nAvailable endpoints:\n- GET /metrics');
    }
  });

  // Start listening
  return new Promise((resolve, reject) => {
    if (!state.server) {
      reject(new Error('Server not initialized'));
      return;
    }

    state.server.on('error', (error) => {
      logger.error({ err: error, port: state.config.port }, 'Metrics server error');
      reject(error);
    });

    state.server.listen(state.config.port, state.config.host, () => {
      state.isRunning = true;
      logger.info(
        {
          port: state.config.port,
          host: state.config.host,
          path: state.config.path,
        },
        'Prometheus metrics server started'
      );
      resolve();
    });
  });
}

/**
 * Stop the Prometheus metrics HTTP server
 *
 * Gracefully shuts down the server and waits for pending requests to complete
 *
 * @param timeout - Maximum time to wait for graceful shutdown in milliseconds (default: 5000)
 * @returns Promise that resolves when server is stopped
 */
export async function stopMetricsServer(timeout: number = 5000): Promise<void> {
  if (!state.isRunning || !state.server) {
    logger.debug('Metrics server not running');
    return;
  }

  logger.info('Stopping Prometheus metrics server');

  return new Promise((resolve, reject) => {
    if (!state.server) {
      resolve();
      return;
    }

    // Set timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      logger.warn({ timeout }, 'Forcing metrics server shutdown after timeout');
      state.server?.closeAllConnections?.(); // Node.js 18.2+
      resolve();
    }, timeout);

    // Graceful shutdown
    state.server.close((error) => {
      clearTimeout(forceShutdownTimer);
      state.isRunning = false;
      state.server = null;

      if (error) {
        logger.error({ err: error }, 'Error stopping metrics server');
        reject(error);
      } else {
        logger.info('Prometheus metrics server stopped');
        resolve();
      }
    });
  });
}

/**
 * Check if metrics server is running
 *
 * @returns True if server is running
 */
export function isMetricsServerRunning(): boolean {
  return state.isRunning;
}

/**
 * Get metrics server configuration
 *
 * @returns Current server configuration
 */
export function getMetricsServerConfig(): Required<MetricsServerConfig> {
  return { ...state.config };
}

/**
 * Get metrics server URL
 *
 * @returns Full URL to metrics endpoint (e.g., "http://localhost:9090/metrics")
 */
export function getMetricsServerUrl(): string {
  const host = state.config.host === '0.0.0.0' ? 'localhost' : state.config.host;
  return `http://${host}:${state.config.port}${state.config.path}`;
}
