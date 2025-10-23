/**
 * Mock HTTP Server for Testing
 * Constitutional Compliance: Principle X - Mock Services for Testing
 *
 * Provides a lightweight HTTP server for testing health checks without external dependencies.
 * Supports:
 * - Success responses (200, 201, 204) with configurable latencies
 * - Error responses (400, 404, 500, 503)
 * - Timeout scenarios (slow responses)
 * - Network failures simulation
 * - Flaky behavior (intermittent failures)
 * - Custom headers and response bodies
 * - Redirect validation
 *
 * Design:
 * - Uses Node.js http.createServer for real HTTP server (works with fetch API)
 * - Random port assignment for parallel test execution
 * - Simple route configuration API
 * - Automatic cleanup with graceful shutdown
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

/**
 * Route configuration for mock endpoints
 */
export interface MockRoute {
  /** HTTP method (GET, HEAD, POST) */
  method: 'GET' | 'HEAD' | 'POST';
  /** URL path (e.g., '/status/200', '/delay/5') */
  path: string;
  /** HTTP status code to return */
  statusCode: number;
  /** Response body (string or object for JSON) */
  body?: string | Record<string, unknown>;
  /** Response headers */
  headers?: Record<string, string>;
  /** Delay in milliseconds before responding */
  delay?: number;
  /** Simulate flaky behavior (probability 0-1 of failure) */
  flaky?: number;
  /** Failure status code when flaky fails */
  flakyStatusCode?: number;
}

/**
 * Server configuration options
 */
export interface MockServerOptions {
  /** Port to bind to (0 = random available port) */
  port?: number;
  /** Hostname to bind to */
  hostname?: string;
  /** Default delay for all responses (ms) */
  defaultDelay?: number;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

/**
 * Mock HTTP server for testing health checks
 *
 * @example
 * ```typescript
 * // Create server with success and error routes
 * const server = new MockHttpServer();
 * await server.start();
 *
 * server.addRoute({
 *   method: 'GET',
 *   path: '/health',
 *   statusCode: 200,
 *   body: { status: 'ok' },
 * });
 *
 * server.addRoute({
 *   method: 'GET',
 *   path: '/slow',
 *   statusCode: 200,
 *   delay: 5000, // 5 second delay for timeout testing
 * });
 *
 * // Use in tests
 * const response = await fetch(`${server.url}/health`);
 *
 * // Cleanup
 * await server.stop();
 * ```
 */
export class MockHttpServer {
  private server: Server | null = null;
  private routes: Map<string, MockRoute> = new Map();
  private options: Required<MockServerOptions>;
  private _port: number = 0;
  private _hostname: string = 'localhost';

  constructor(options: MockServerOptions = {}) {
    this.options = {
      port: options.port ?? 0,
      hostname: options.hostname ?? '127.0.0.1', // Use IPv4 explicitly to avoid IPv6 issues with fetch
      defaultDelay: options.defaultDelay ?? 0,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Start the mock HTTP server
   * @returns Promise that resolves when server is listening
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (error) => {
        if (this.options.verbose) {
          console.error('[MockHttpServer] Server error:', error);
        }
        reject(error);
      });

      this.server.listen(this.options.port, this.options.hostname, () => {
        const address = this.server!.address();
        if (address && typeof address === 'object') {
          this._port = address.port;
          this._hostname = address.address;
        }

        if (this.options.verbose) {
          console.log(`[MockHttpServer] Started on ${this.url}`);
        }
        resolve();
      });
    });
  }

  /**
   * Stop the mock HTTP server
   * @returns Promise that resolves when server is closed
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          if (this.options.verbose) {
            console.error('[MockHttpServer] Error closing server:', error);
          }
          reject(error);
        } else {
          if (this.options.verbose) {
            console.log('[MockHttpServer] Stopped');
          }
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Add a route to the mock server
   * @param route Route configuration
   */
  addRoute(route: MockRoute): void {
    const key = this.routeKey(route.method, route.path);
    this.routes.set(key, route);

    if (this.options.verbose) {
      console.log(`[MockHttpServer] Added route: ${route.method} ${route.path} → ${route.statusCode}`);
    }
  }

  /**
   * Remove a route from the mock server
   * @param method HTTP method
   * @param path URL path
   */
  removeRoute(method: 'GET' | 'HEAD' | 'POST', path: string): void {
    const key = this.routeKey(method, path);
    this.routes.delete(key);

    if (this.options.verbose) {
      console.log(`[MockHttpServer] Removed route: ${method} ${path}`);
    }
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes.clear();

    if (this.options.verbose) {
      console.log('[MockHttpServer] Cleared all routes');
    }
  }

  /**
   * Get the base URL of the mock server
   */
  get url(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    return `http://${this._hostname}:${this._port}`;
  }

  /**
   * Get the port the server is listening on
   */
  get port(): number {
    return this._port;
  }

  /**
   * Generate route key for storage
   */
  private routeKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = (req.method || 'GET').toUpperCase() as 'GET' | 'HEAD' | 'POST';
    const path = req.url || '/';

    if (this.options.verbose) {
      console.log(`[MockHttpServer] ${method} ${path}`);
    }

    // Find matching route
    const key = this.routeKey(method, path);
    const route = this.routes.get(key);

    if (!route) {
      if (this.options.verbose) {
        console.log(`[MockHttpServer] No route found for ${method} ${path}`);
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', message: `No route configured for ${method} ${path}` }));
      return;
    }

    // Apply delay (route-specific or default)
    const delay = route.delay ?? this.options.defaultDelay;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Handle flaky behavior
    if (route.flaky !== undefined && Math.random() < route.flaky) {
      const flakyStatusCode = route.flakyStatusCode ?? 500;
      if (this.options.verbose) {
        console.log(`[MockHttpServer] Flaky behavior triggered: ${flakyStatusCode}`);
      }
      res.writeHead(flakyStatusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Flaky Failure', message: 'Simulated intermittent failure' }));
      return;
    }

    // Build response headers
    const headers: Record<string, string> = route.headers ? { ...route.headers } : {};

    // Set Content-Type if not explicitly set
    if (!headers['Content-Type'] && !headers['content-type']) {
      if (typeof route.body === 'object') {
        headers['Content-Type'] = 'application/json';
      } else {
        headers['Content-Type'] = 'text/plain';
      }
    }

    // Write response
    res.writeHead(route.statusCode, headers);

    // Handle HEAD requests (no body)
    if (method === 'HEAD') {
      res.end();
      return;
    }

    // Write body
    if (route.body !== undefined) {
      const body = typeof route.body === 'object'
        ? JSON.stringify(route.body)
        : route.body;
      res.end(body);
    } else {
      res.end();
    }

    if (this.options.verbose) {
      console.log(`[MockHttpServer] Responded with ${route.statusCode}`);
    }
  }
}

/**
 * Helper function to create a server with common routes for testing
 *
 * @example
 * ```typescript
 * const server = await createMockServerWithRoutes({
 *   successRoutes: ['/health', '/api/status'],
 *   errorRoutes: { '/error': 500, '/notfound': 404 },
 *   slowRoutes: { '/slow': 5000 },
 * });
 *
 * // Use in tests
 * await fetch(`${server.url}/health`);
 *
 * // Cleanup
 * await server.stop();
 * ```
 */
export async function createMockServerWithRoutes(config: {
  /** Paths that return 200 OK */
  successRoutes?: string[];
  /** Map of path → status code for error responses */
  errorRoutes?: Record<string, number>;
  /** Map of path → delay (ms) for slow responses */
  slowRoutes?: Record<string, number>;
  /** Map of path → probability (0-1) for flaky responses */
  flakyRoutes?: Record<string, number>;
  /** Server options */
  options?: MockServerOptions;
}): Promise<MockHttpServer> {
  const server = new MockHttpServer(config.options);
  await server.start();

  // Add success routes (200 OK)
  if (config.successRoutes) {
    for (const path of config.successRoutes) {
      server.addRoute({
        method: 'GET',
        path,
        statusCode: 200,
        body: { status: 'ok', path },
      });
    }
  }

  // Add error routes
  if (config.errorRoutes) {
    for (const [path, statusCode] of Object.entries(config.errorRoutes)) {
      server.addRoute({
        method: 'GET',
        path,
        statusCode,
        body: { status: 'error', code: statusCode },
      });
    }
  }

  // Add slow routes
  if (config.slowRoutes) {
    for (const [path, delay] of Object.entries(config.slowRoutes)) {
      server.addRoute({
        method: 'GET',
        path,
        statusCode: 200,
        body: { status: 'ok', delayed: true },
        delay,
      });
    }
  }

  // Add flaky routes
  if (config.flakyRoutes) {
    for (const [path, probability] of Object.entries(config.flakyRoutes)) {
      server.addRoute({
        method: 'GET',
        path,
        statusCode: 200,
        body: { status: 'ok', flaky: true },
        flaky: probability,
        flakyStatusCode: 503,
      });
    }
  }

  return server;
}

/**
 * Helper to create common test scenarios
 */
export const MockScenarios = {
  /**
   * Create a healthy service scenario
   */
  async healthyService(options?: MockServerOptions): Promise<MockHttpServer> {
    return createMockServerWithRoutes({
      successRoutes: ['/health', '/status', '/api/health'],
      ...(options ? { options } : {}),
    });
  },

  /**
   * Create a failing service scenario
   */
  async failingService(options?: MockServerOptions): Promise<MockHttpServer> {
    return createMockServerWithRoutes({
      errorRoutes: {
        '/health': 500,
        '/status': 503,
        '/api/health': 500,
      },
      ...(options ? { options } : {}),
    });
  },

  /**
   * Create a slow service scenario (for timeout testing)
   */
  async slowService(delayMs: number, options?: MockServerOptions): Promise<MockHttpServer> {
    return createMockServerWithRoutes({
      slowRoutes: {
        '/health': delayMs,
        '/slow': delayMs,
      },
      ...(options ? { options } : {}),
    });
  },

  /**
   * Create a flaky service scenario (intermittent failures)
   */
  async flakyService(failureRate: number = 0.5, options?: MockServerOptions): Promise<MockHttpServer> {
    return createMockServerWithRoutes({
      flakyRoutes: {
        '/health': failureRate,
        '/flaky': failureRate,
      },
      ...(options ? { options } : {}),
    });
  },

  /**
   * Create a comprehensive test server with all scenario types
   */
  async comprehensiveServer(options?: MockServerOptions): Promise<MockHttpServer> {
    const server = new MockHttpServer(options);
    await server.start();

    // Success routes
    server.addRoute({ method: 'GET', path: '/status/200', statusCode: 200, body: 'OK' });
    server.addRoute({ method: 'GET', path: '/status/201', statusCode: 201, body: 'Created' });
    server.addRoute({ method: 'GET', path: '/status/204', statusCode: 204 });

    // HEAD method support
    server.addRoute({ method: 'HEAD', path: '/health', statusCode: 200 });

    // POST method support
    server.addRoute({
      method: 'POST',
      path: '/api/data',
      statusCode: 200,
      body: { received: true },
    });

    // Error routes
    server.addRoute({ method: 'GET', path: '/status/400', statusCode: 400, body: 'Bad Request' });
    server.addRoute({ method: 'GET', path: '/status/404', statusCode: 404, body: 'Not Found' });
    server.addRoute({ method: 'GET', path: '/status/500', statusCode: 500, body: 'Internal Server Error' });
    server.addRoute({ method: 'GET', path: '/status/503', statusCode: 503, body: 'Service Unavailable' });

    // Redirect routes
    server.addRoute({
      method: 'GET',
      path: '/redirect',
      statusCode: 302,
      headers: { location: 'https://example.com' },
      body: 'Found',
    });

    // Delay routes
    server.addRoute({
      method: 'GET',
      path: '/delay/1',
      statusCode: 200,
      body: 'Delayed 1s',
      delay: 1000,
    });
    server.addRoute({
      method: 'GET',
      path: '/delay/5',
      statusCode: 200,
      body: 'Delayed 5s',
      delay: 5000,
    });
    server.addRoute({
      method: 'GET',
      path: '/delay/10',
      statusCode: 200,
      body: 'Delayed 10s',
      delay: 10000,
    });

    // Large response (for 100KB limit testing)
    const largeBody = randomBytes(150000).toString('base64'); // 150KB base64 encoded
    server.addRoute({
      method: 'GET',
      path: '/bytes/150000',
      statusCode: 200,
      body: largeBody,
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    // Text search routes
    server.addRoute({
      method: 'GET',
      path: '/html',
      statusCode: 200,
      body: '<html><body>Test page</body></html>',
      headers: { 'Content-Type': 'text/html' },
    });

    // Custom header routes
    server.addRoute({
      method: 'GET',
      path: '/response-headers',
      statusCode: 200,
      body: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'custom-header': 'CustomValue',
        'x-custom-header': 'custom-value',
      },
    });

    // Flaky route (50% failure rate)
    server.addRoute({
      method: 'GET',
      path: '/flaky',
      statusCode: 200,
      body: 'OK when working',
      flaky: 0.5,
      flakyStatusCode: 503,
    });

    return server;
  },
};

/**
 * Example usage in tests
 */
export const examples = {
  basicUsage: `
    import { MockHttpServer } from './mocks/mock-http-server.ts';

    const server = new MockHttpServer();
    await server.start();

    server.addRoute({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      body: { status: 'ok' },
    });

    const response = await fetch(\`\${server.url}/health\`);
    // response.status === 200

    await server.stop();
  `,

  testScenario: `
    import { MockScenarios } from './mocks/mock-http-server.ts';

    describe('Health Check Tests', () => {
      let server: MockHttpServer;

      beforeEach(async () => {
        server = await MockScenarios.healthyService();
      });

      afterEach(async () => {
        await server.stop();
      });

      it('should pass health check for healthy service', async () => {
        const config: HealthCheckConfig = {
          url: \`\${server.url}/health\`,
          method: 'GET',
          timeout: 5000,
          expectedStatus: 200,
        };

        const result = await performHealthCheck(config);
        expect(result.status).toBe('PASS');
      });
    });
  `,

  workerThreads: `
    // Works with worker threads because it's a real HTTP server
    // Worker threads can make fetch() calls to the mock server URL
    const server = new MockHttpServer();
    await server.start();

    server.addRoute({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      body: 'OK',
    });

    // Pass server.url to worker thread
    const config: HealthCheckConfig = {
      url: \`\${server.url}/health\`,
      method: 'GET',
      timeout: 5000,
      expectedStatus: 200,
    };

    // Worker thread will make real HTTP call to local mock server
    const result = await poolManager.executeHealthCheck(config);
  `,

  timeoutTesting: `
    import { MockScenarios } from './mocks/mock-http-server.ts';

    it('should timeout after 1 second', async () => {
      const server = await MockScenarios.slowService(10000); // 10s delay

      const config: HealthCheckConfig = {
        url: \`\${server.url}/slow\`,
        method: 'GET',
        timeout: 1000, // 1s timeout
        expectedStatus: 200,
      };

      const result = await performHealthCheck(config);
      expect(result.status).toBe('FAIL');
      expect(result.failure_reason).toContain('timeout');

      await server.stop();
    });
  `,

  flakyBehavior: `
    import { MockScenarios } from './mocks/mock-http-server.ts';

    it('should handle flaky services', async () => {
      const server = await MockScenarios.flakyService(0.8); // 80% failure rate

      const results = [];
      for (let i = 0; i < 10; i++) {
        const config: HealthCheckConfig = {
          url: \`\${server.url}/flaky\`,
          method: 'GET',
          timeout: 5000,
          expectedStatus: 200,
        };

        const result = await performHealthCheck(config);
        results.push(result.status);
      }

      // Should have mix of PASS and FAIL
      const failures = results.filter(s => s === 'FAIL').length;
      expect(failures).toBeGreaterThan(0);

      await server.stop();
    });
  `,
};
