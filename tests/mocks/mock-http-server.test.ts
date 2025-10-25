/**
 * Unit tests for MockHttpServer
 * Validates mock server functionality for Constitutional Compliance (Principle X)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockHttpServer, MockScenarios, createMockServerWithRoutes } from './mock-http-server.ts';

describe('MockHttpServer', () => {
  let server: MockHttpServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      server = new MockHttpServer();
      await server.start();

      expect(server.port).toBeGreaterThan(0);
      expect(server.url).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);

      await server.stop();
    });

    it('should throw error if starting already running server', async () => {
      server = new MockHttpServer();
      await server.start();

      await expect(server.start()).rejects.toThrow('Server is already running');
    });

    it('should throw error if accessing URL before server starts', () => {
      server = new MockHttpServer();

      expect(() => server.url).toThrow('Server is not running');
    });

    it('should use random port when port is 0', async () => {
      server = new MockHttpServer({ port: 0 });
      await server.start();

      expect(server.port).toBeGreaterThan(0);
      expect(server.port).toBeLessThan(65536);
    });
  });

  describe('Route Management', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should add and retrieve route successfully', async () => {
      server.addRoute({
        method: 'GET',
        path: '/test',
        statusCode: 200,
        body: 'Test response',
      });

      const response = await fetch(`${server.url}/test`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Test response');
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await fetch(`${server.url}/nonexistent`);
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('Not Found');
    });

    it('should remove route successfully', async () => {
      server.addRoute({
        method: 'GET',
        path: '/temp',
        statusCode: 200,
        body: 'Temporary',
      });

      let response = await fetch(`${server.url}/temp`);
      expect(response.status).toBe(200);

      server.removeRoute('GET', '/temp');

      response = await fetch(`${server.url}/temp`);
      expect(response.status).toBe(404);
    });

    it('should clear all routes successfully', async () => {
      server.addRoute({
        method: 'GET',
        path: '/route1',
        statusCode: 200,
        body: 'Route 1',
      });
      server.addRoute({
        method: 'GET',
        path: '/route2',
        statusCode: 200,
        body: 'Route 2',
      });

      let response1 = await fetch(`${server.url}/route1`);
      let response2 = await fetch(`${server.url}/route2`);
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      server.clearRoutes();

      response1 = await fetch(`${server.url}/route1`);
      response2 = await fetch(`${server.url}/route2`);
      expect(response1.status).toBe(404);
      expect(response2.status).toBe(404);
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should handle GET requests', async () => {
      server.addRoute({
        method: 'GET',
        path: '/get',
        statusCode: 200,
        body: { method: 'GET' },
      });

      const response = await fetch(`${server.url}/get`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.method).toBe('GET');
    });

    it('should handle HEAD requests', async () => {
      server.addRoute({
        method: 'HEAD',
        path: '/head',
        statusCode: 200,
      });

      const response = await fetch(`${server.url}/head`, { method: 'HEAD' });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(''); // HEAD should have no body
    });

    it('should handle POST requests', async () => {
      server.addRoute({
        method: 'POST',
        path: '/post',
        statusCode: 201,
        body: { created: true },
      });

      const response = await fetch(`${server.url}/post`, {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.created).toBe(true);
    });
  });

  describe('Status Codes', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should return 200 OK', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/200',
        statusCode: 200,
        body: 'OK',
      });

      const response = await fetch(`${server.url}/status/200`);
      expect(response.status).toBe(200);
    });

    it('should return 201 Created', async () => {
      server.addRoute({
        method: 'POST',
        path: '/status/201',
        statusCode: 201,
        body: 'Created',
      });

      const response = await fetch(`${server.url}/status/201`, { method: 'POST' });
      expect(response.status).toBe(201);
    });

    it('should return 204 No Content', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/204',
        statusCode: 204,
      });

      const response = await fetch(`${server.url}/status/204`);
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    });

    it('should return 400 Bad Request', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/400',
        statusCode: 400,
        body: 'Bad Request',
      });

      const response = await fetch(`${server.url}/status/400`);
      expect(response.status).toBe(400);
    });

    it('should return 404 Not Found', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/404',
        statusCode: 404,
        body: 'Not Found',
      });

      const response = await fetch(`${server.url}/status/404`);
      expect(response.status).toBe(404);
    });

    it('should return 500 Internal Server Error', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/500',
        statusCode: 500,
        body: 'Internal Server Error',
      });

      const response = await fetch(`${server.url}/status/500`);
      expect(response.status).toBe(500);
    });

    it('should return 503 Service Unavailable', async () => {
      server.addRoute({
        method: 'GET',
        path: '/status/503',
        statusCode: 503,
        body: 'Service Unavailable',
      });

      const response = await fetch(`${server.url}/status/503`);
      expect(response.status).toBe(503);
    });
  });

  describe('Response Bodies', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should return string body', async () => {
      server.addRoute({
        method: 'GET',
        path: '/string',
        statusCode: 200,
        body: 'Plain text response',
      });

      const response = await fetch(`${server.url}/string`);
      expect(await response.text()).toBe('Plain text response');
    });

    it('should return JSON body', async () => {
      server.addRoute({
        method: 'GET',
        path: '/json',
        statusCode: 200,
        body: { key: 'value', nested: { foo: 'bar' } },
      });

      const response = await fetch(`${server.url}/json`);
      expect(response.headers.get('content-type')).toBe('application/json');

      const body = await response.json();
      expect(body.key).toBe('value');
      expect(body.nested.foo).toBe('bar');
    });

    it('should return empty body when not specified', async () => {
      server.addRoute({
        method: 'GET',
        path: '/empty',
        statusCode: 204,
      });

      const response = await fetch(`${server.url}/empty`);
      expect(await response.text()).toBe('');
    });
  });

  describe('Custom Headers', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should return custom headers', async () => {
      server.addRoute({
        method: 'GET',
        path: '/headers',
        statusCode: 200,
        body: 'OK',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Request-Id': '12345',
        },
      });

      const response = await fetch(`${server.url}/headers`);
      expect(response.headers.get('x-custom-header')).toBe('custom-value');
      expect(response.headers.get('x-request-id')).toBe('12345');
    });

    it('should support Location header for redirects', async () => {
      server.addRoute({
        method: 'GET',
        path: '/redirect',
        statusCode: 302,
        headers: {
          location: 'https://example.com/redirected',
        },
        body: 'Found',
      });

      const response = await fetch(`${server.url}/redirect`, { redirect: 'manual' });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('https://example.com/redirected');
    });

    it('should auto-set Content-Type for JSON bodies', async () => {
      server.addRoute({
        method: 'GET',
        path: '/auto-json',
        statusCode: 200,
        body: { auto: 'json' },
      });

      const response = await fetch(`${server.url}/auto-json`);
      expect(response.headers.get('content-type')).toBe('application/json');
    });

    it('should allow custom Content-Type override', async () => {
      server.addRoute({
        method: 'GET',
        path: '/custom-type',
        statusCode: 200,
        body: '<html>HTML</html>',
        headers: {
          'Content-Type': 'text/html',
        },
      });

      const response = await fetch(`${server.url}/custom-type`);
      expect(response.headers.get('content-type')).toBe('text/html');
    });
  });

  describe('Delay Simulation', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should delay response by specified duration', async () => {
      server.addRoute({
        method: 'GET',
        path: '/delay',
        statusCode: 200,
        body: 'Delayed',
        delay: 500, // 500ms delay
      });

      const startTime = Date.now();
      const response = await fetch(`${server.url}/delay`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(1000); // Should not take too long
    }, 10000);

    it('should apply default delay from server options', async () => {
      await server.stop();
      server = new MockHttpServer({ defaultDelay: 300 });
      await server.start();

      server.addRoute({
        method: 'GET',
        path: '/default-delay',
        statusCode: 200,
        body: 'OK',
      });

      const startTime = Date.now();
      await fetch(`${server.url}/default-delay`);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(300);
    }, 10000);

    it('should use route-specific delay over default delay', async () => {
      await server.stop();
      server = new MockHttpServer({ defaultDelay: 1000 });
      await server.start();

      server.addRoute({
        method: 'GET',
        path: '/override-delay',
        statusCode: 200,
        body: 'OK',
        delay: 200, // Override default
      });

      const startTime = Date.now();
      await fetch(`${server.url}/override-delay`);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(800); // Should use 200ms, not 1000ms
    }, 10000);
  });

  describe('Flaky Behavior', () => {
    beforeEach(async () => {
      server = new MockHttpServer();
      await server.start();
    });

    it('should simulate flaky behavior with 100% failure rate', async () => {
      server.addRoute({
        method: 'GET',
        path: '/always-fail',
        statusCode: 200,
        body: 'OK',
        flaky: 1.0, // 100% failure rate
        flakyStatusCode: 503,
      });

      const response = await fetch(`${server.url}/always-fail`);
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.error).toBe('Flaky Failure');
    });

    it('should simulate flaky behavior with 0% failure rate', async () => {
      server.addRoute({
        method: 'GET',
        path: '/never-fail',
        statusCode: 200,
        body: 'OK',
        flaky: 0.0, // 0% failure rate
        flakyStatusCode: 503,
      });

      const response = await fetch(`${server.url}/never-fail`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('OK');
    });

    it('should simulate flaky behavior with 50% failure rate', async () => {
      server.addRoute({
        method: 'GET',
        path: '/sometimes-fail',
        statusCode: 200,
        body: 'OK',
        flaky: 0.5, // 50% failure rate
        flakyStatusCode: 503,
      });

      // Make multiple requests to verify probabilistic behavior
      // Use 100 samples for better statistical stability
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        const response = await fetch(`${server.url}/sometimes-fail`);
        results.push(response.status);
      }

      const successes = results.filter((status) => status === 200).length;
      const failures = results.filter((status) => status === 503).length;

      // With 50% probability and 100 requests, expect roughly 50/50 split
      // Allow for statistical variance (30-70% range)
      // With 100 samples, probability of being outside this range is < 0.1%
      expect(successes).toBeGreaterThan(30); // At least 30%
      expect(successes).toBeLessThan(70); // At most 70%
      expect(failures).toBeGreaterThan(30); // At least 30%
      expect(failures).toBeLessThan(70); // At most 70%
    }, 10000);
  });

  describe('Helper Functions', () => {
    it('should create server with success routes', async () => {
      server = await createMockServerWithRoutes({
        successRoutes: ['/health', '/status', '/api/health'],
      });

      const response1 = await fetch(`${server.url}/health`);
      const response2 = await fetch(`${server.url}/status`);
      const response3 = await fetch(`${server.url}/api/health`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });

    it('should create server with error routes', async () => {
      server = await createMockServerWithRoutes({
        errorRoutes: {
          '/error': 500,
          '/notfound': 404,
          '/badrequest': 400,
        },
      });

      const response1 = await fetch(`${server.url}/error`);
      const response2 = await fetch(`${server.url}/notfound`);
      const response3 = await fetch(`${server.url}/badrequest`);

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(404);
      expect(response3.status).toBe(400);
    });

    it('should create server with slow routes', async () => {
      server = await createMockServerWithRoutes({
        slowRoutes: {
          '/slow': 500,
        },
      });

      const startTime = Date.now();
      const response = await fetch(`${server.url}/slow`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(500);
    }, 10000);

    it('should create server with flaky routes', async () => {
      server = await createMockServerWithRoutes({
        flakyRoutes: {
          '/flaky': 1.0, // 100% failure for deterministic test
        },
      });

      const response = await fetch(`${server.url}/flaky`);
      expect(response.status).toBe(503);
    });
  });

  describe('MockScenarios', () => {
    it('should create healthy service scenario', async () => {
      server = await MockScenarios.healthyService();

      const response1 = await fetch(`${server.url}/health`);
      const response2 = await fetch(`${server.url}/status`);
      const response3 = await fetch(`${server.url}/api/health`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });

    it('should create failing service scenario', async () => {
      server = await MockScenarios.failingService();

      const response1 = await fetch(`${server.url}/health`);
      const response2 = await fetch(`${server.url}/status`);
      const response3 = await fetch(`${server.url}/api/health`);

      expect(response1.status).toBe(500);
      expect(response2.status).toBe(503);
      expect(response3.status).toBe(500);
    });

    it('should create slow service scenario', async () => {
      server = await MockScenarios.slowService(500);

      const startTime = Date.now();
      const response = await fetch(`${server.url}/health`);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(500);
    }, 10000);

    it('should create flaky service scenario', async () => {
      server = await MockScenarios.flakyService(1.0); // 100% failure for deterministic test

      const response = await fetch(`${server.url}/health`);
      expect(response.status).toBe(503);
    });

    it('should create comprehensive server with all routes', async () => {
      server = await MockScenarios.comprehensiveServer();

      // Test a variety of routes
      const tests = [
        { path: '/status/200', expectedStatus: 200 },
        { path: '/status/201', expectedStatus: 201 },
        { path: '/status/204', expectedStatus: 204 },
        { path: '/status/400', expectedStatus: 400 },
        { path: '/status/404', expectedStatus: 404 },
        { path: '/status/500', expectedStatus: 500 },
        { path: '/redirect', expectedStatus: 302 },
      ];

      for (const test of tests) {
        const response = await fetch(`${server.url}${test.path}`, { redirect: 'manual' });
        expect(response.status).toBe(test.expectedStatus);
      }
    });
  });

  describe('Parallel Test Execution', () => {
    it('should support multiple servers running simultaneously', async () => {
      const server1 = new MockHttpServer();
      const server2 = new MockHttpServer();
      const server3 = new MockHttpServer();

      await server1.start();
      await server2.start();
      await server3.start();

      // All servers should have different ports
      expect(server1.port).not.toBe(server2.port);
      expect(server1.port).not.toBe(server3.port);
      expect(server2.port).not.toBe(server3.port);

      // Add routes to each server
      server1.addRoute({ method: 'GET', path: '/test', statusCode: 200, body: 'Server 1' });
      server2.addRoute({ method: 'GET', path: '/test', statusCode: 200, body: 'Server 2' });
      server3.addRoute({ method: 'GET', path: '/test', statusCode: 200, body: 'Server 3' });

      // Each server responds independently
      const response1 = await fetch(`${server1.url}/test`);
      const response2 = await fetch(`${server2.url}/test`);
      const response3 = await fetch(`${server3.url}/test`);

      expect(await response1.text()).toBe('Server 1');
      expect(await response2.text()).toBe('Server 2');
      expect(await response3.text()).toBe('Server 3');

      await server1.stop();
      await server2.stop();
      await server3.stop();
    });
  });
});
