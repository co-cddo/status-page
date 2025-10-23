# Mock HTTP Server for Testing

**Constitutional Compliance**: Principle X - Mock Services for Testing (NON-NEGOTIABLE)

This directory contains mock service infrastructure to ensure all tests run without external dependencies. The mock HTTP server simulates real HTTP services without requiring internet connectivity.

## Why Mock Services?

Per Constitution Principle X, tests MUST NOT call external services because:

1. **Reliability**: External services can be down, slow, or rate-limited
2. **Determinism**: External services return unpredictable results
3. **Speed**: Network calls add significant latency to test execution
4. **Isolation**: Tests should not depend on external infrastructure
5. **Security**: No API keys or credentials in test code

## Quick Start

### Basic Usage

```typescript
import { MockHttpServer } from './mocks/mock-http-server.js';

describe('Health Check Tests', () => {
  let server: MockHttpServer;

  beforeEach(async () => {
    server = new MockHttpServer();
    await server.start();

    server.addRoute({
      method: 'GET',
      path: '/health',
      statusCode: 200,
      body: { status: 'ok' },
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should check health successfully', async () => {
    const response = await fetch(`${server.url}/health`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
```

### Using Pre-configured Scenarios

```typescript
import { MockScenarios } from './mocks/mock-http-server.js';

describe('Service Monitoring', () => {
  it('should detect healthy service', async () => {
    const server = await MockScenarios.healthyService();

    const config: HealthCheckConfig = {
      url: `${server.url}/health`,
      method: 'GET',
      timeout: 5000,
      expectedStatus: 200,
    };

    const result = await performHealthCheck(config);
    expect(result.status).toBe('PASS');

    await server.stop();
  });

  it('should detect failing service', async () => {
    const server = await MockScenarios.failingService();

    const config: HealthCheckConfig = {
      url: `${server.url}/health`,
      method: 'GET',
      timeout: 5000,
      expectedStatus: 200,
    };

    const result = await performHealthCheck(config);
    expect(result.status).toBe('FAIL');

    await server.stop();
  });
});
```

## Common Scenarios

### Success Responses

```typescript
const server = new MockHttpServer();
await server.start();

// 200 OK
server.addRoute({
  method: 'GET',
  path: '/status/200',
  statusCode: 200,
  body: 'OK',
});

// 201 Created
server.addRoute({
  method: 'POST',
  path: '/api/create',
  statusCode: 201,
  body: { created: true, id: '12345' },
});

// 204 No Content
server.addRoute({
  method: 'DELETE',
  path: '/api/delete',
  statusCode: 204,
});
```

### Error Responses

```typescript
const server = new MockHttpServer();
await server.start();

// 400 Bad Request
server.addRoute({
  method: 'POST',
  path: '/api/bad-request',
  statusCode: 400,
  body: { error: 'Invalid input' },
});

// 404 Not Found
server.addRoute({
  method: 'GET',
  path: '/status/404',
  statusCode: 404,
  body: 'Not Found',
});

// 500 Internal Server Error
server.addRoute({
  method: 'GET',
  path: '/status/500',
  statusCode: 500,
  body: 'Internal Server Error',
});

// 503 Service Unavailable
server.addRoute({
  method: 'GET',
  path: '/status/503',
  statusCode: 503,
  body: 'Service Unavailable',
});
```

### Timeout Testing

```typescript
// Simulate a slow service that will trigger timeout
const server = new MockHttpServer();
await server.start();

server.addRoute({
  method: 'GET',
  path: '/slow',
  statusCode: 200,
  body: 'Slow response',
  delay: 10000, // 10 second delay
});

const config: HealthCheckConfig = {
  url: `${server.url}/slow`,
  method: 'GET',
  timeout: 1000, // 1 second timeout
  expectedStatus: 200,
};

const result = await performHealthCheck(config);
expect(result.status).toBe('FAIL');
expect(result.failure_reason).toContain('timeout');

await server.stop();
```

### Flaky Service Testing

```typescript
// Simulate intermittent failures
const server = new MockHttpServer();
await server.start();

server.addRoute({
  method: 'GET',
  path: '/flaky',
  statusCode: 200,
  body: 'OK when working',
  flaky: 0.5, // 50% failure rate
  flakyStatusCode: 503,
});

// Test retry logic
const results = [];
for (let i = 0; i < 10; i++) {
  const config: HealthCheckConfig = {
    url: `${server.url}/flaky`,
    method: 'GET',
    timeout: 5000,
    expectedStatus: 200,
    maxRetries: 3,
  };

  const result = await performHealthCheck(config);
  results.push(result.status);
}

// Should have a mix of PASS and FAIL
expect(results.some(s => s === 'PASS')).toBe(true);
expect(results.some(s => s === 'FAIL')).toBe(true);

await server.stop();
```

### Custom Headers

```typescript
const server = new MockHttpServer();
await server.start();

// Response with custom headers
server.addRoute({
  method: 'GET',
  path: '/headers',
  statusCode: 200,
  body: 'OK',
  headers: {
    'X-Custom-Header': 'custom-value',
    'X-Request-Id': '12345',
    'Cache-Control': 'no-cache',
  },
});

const response = await fetch(`${server.url}/headers`);
expect(response.headers.get('x-custom-header')).toBe('custom-value');
expect(response.headers.get('x-request-id')).toBe('12345');

await server.stop();
```

### Redirect Testing

```typescript
const server = new MockHttpServer();
await server.start();

server.addRoute({
  method: 'GET',
  path: '/redirect',
  statusCode: 302,
  headers: {
    location: 'https://example.com/redirected',
  },
  body: 'Found',
});

const config: HealthCheckConfig = {
  url: `${server.url}/redirect`,
  method: 'GET',
  timeout: 5000,
  expectedStatus: 302,
  expectedHeaders: {
    location: 'https://example.com/redirected',
  },
};

const result = await performHealthCheck(config);
expect(result.status).toBe('PASS');
expect(result.http_status_code).toBe(302);

await server.stop();
```

## Migration Guide

### Before (Using httpbin.org)

```typescript
// ❌ VIOLATES CONSTITUTION PRINCIPLE X
it('should execute health checks using real worker threads with actual HTTP requests', async () => {
  const config: HealthCheckConfig = {
    serviceName: 'httpbin-status-200',
    method: 'GET',
    url: 'https://httpbin.org/status/200', // External service
    timeout: 10000,
    warningThreshold: 5000,
    maxRetries: 3,
    expectedStatus: 200,
    correlationId: 'test-integration-001',
  };

  const result: HealthCheckResult = await poolManager.executeHealthCheck(config);

  expect(result).toBeDefined();
  expect(result.serviceName).toBe('httpbin-status-200');
  expect(result.status).toBe('PASS');
  expect(result.http_status_code).toBe(200);
}, 30000); // Long timeout needed for network
```

### After (Using MockHttpServer)

```typescript
// ✅ COMPLIES WITH CONSTITUTION PRINCIPLE X
describe('Worker Pool Integration', () => {
  let server: MockHttpServer;

  beforeEach(async () => {
    server = await MockScenarios.comprehensiveServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should execute health checks using real worker threads with mock HTTP server', async () => {
    const config: HealthCheckConfig = {
      serviceName: 'mock-status-200',
      method: 'GET',
      url: `${server.url}/status/200`, // Local mock server
      timeout: 10000,
      warningThreshold: 5000,
      maxRetries: 3,
      expectedStatus: 200,
      correlationId: 'test-integration-001',
    };

    const result: HealthCheckResult = await poolManager.executeHealthCheck(config);

    expect(result).toBeDefined();
    expect(result.serviceName).toBe('mock-status-200');
    expect(result.status).toBe('PASS');
    expect(result.http_status_code).toBe(200);
  }, 5000); // Faster timeout (no network latency)
});
```

## Benefits

1. **Fast**: No network latency, tests run in milliseconds instead of seconds
2. **Reliable**: No network failures, service downtime, or rate limiting
3. **Deterministic**: Same input always produces same output
4. **Comprehensive**: Test all edge cases including timeout, flaky behavior, error responses
5. **Isolated**: Tests run in CI/CD without internet access
6. **Secure**: No API keys or credentials needed

## Advanced Usage

### Multiple Services in One Test

```typescript
const healthyService = await MockScenarios.healthyService();
const failingService = await MockScenarios.failingService();
const slowService = await MockScenarios.slowService(5000);

// Test multiple services simultaneously
const configs: HealthCheckConfig[] = [
  { url: `${healthyService.url}/health`, method: 'GET', timeout: 5000, expectedStatus: 200 },
  { url: `${failingService.url}/health`, method: 'GET', timeout: 5000, expectedStatus: 200 },
  { url: `${slowService.url}/health`, method: 'GET', timeout: 5000, expectedStatus: 200 },
];

const results = await Promise.all(configs.map(c => performHealthCheck(c)));

expect(results[0].status).toBe('PASS');
expect(results[1].status).toBe('FAIL');
expect(results[2].status).toBe('DEGRADED'); // Slow response

await healthyService.stop();
await failingService.stop();
await slowService.stop();
```

### Dynamic Route Configuration

```typescript
const server = new MockHttpServer();
await server.start();

// Add initial route
server.addRoute({
  method: 'GET',
  path: '/dynamic',
  statusCode: 200,
  body: 'Initial state',
});

// Test initial state
let response = await fetch(`${server.url}/dynamic`);
expect(await response.text()).toBe('Initial state');

// Change route behavior mid-test
server.removeRoute('GET', '/dynamic');
server.addRoute({
  method: 'GET',
  path: '/dynamic',
  statusCode: 500,
  body: 'Failed state',
});

// Test changed state
response = await fetch(`${server.url}/dynamic`);
expect(response.status).toBe(500);
expect(await response.text()).toBe('Failed state');

await server.stop();
```

### Custom Scenario Builder

```typescript
async function createCustomScenario(options: {
  healthyCount: number;
  failingCount: number;
  slowCount: number;
}): Promise<MockHttpServer> {
  const server = new MockHttpServer();
  await server.start();

  // Add healthy endpoints
  for (let i = 0; i < options.healthyCount; i++) {
    server.addRoute({
      method: 'GET',
      path: `/service/healthy-${i}`,
      statusCode: 200,
      body: { status: 'healthy', id: i },
    });
  }

  // Add failing endpoints
  for (let i = 0; i < options.failingCount; i++) {
    server.addRoute({
      method: 'GET',
      path: `/service/failing-${i}`,
      statusCode: 500,
      body: { status: 'error', id: i },
    });
  }

  // Add slow endpoints
  for (let i = 0; i < options.slowCount; i++) {
    server.addRoute({
      method: 'GET',
      path: `/service/slow-${i}`,
      statusCode: 200,
      body: { status: 'slow', id: i },
      delay: 3000,
    });
  }

  return server;
}

// Use in tests
const server = await createCustomScenario({
  healthyCount: 10,
  failingCount: 3,
  slowCount: 2,
});
```

## Worker Thread Compatibility

The mock server works seamlessly with worker threads because it's a real HTTP server listening on localhost:

```typescript
// Main thread: Start mock server
const server = new MockHttpServer();
await server.start();

server.addRoute({
  method: 'GET',
  path: '/health',
  statusCode: 200,
  body: 'OK',
});

// Worker thread: Make real HTTP call to mock server
const config: HealthCheckConfig = {
  url: `${server.url}/health`, // Real HTTP URL
  method: 'GET',
  timeout: 5000,
  expectedStatus: 200,
};

// Worker executes fetch() against local mock server
const result = await poolManager.executeHealthCheck(config);
expect(result.status).toBe('PASS');

// Main thread: Cleanup
await server.stop();
```

## Performance Considerations

1. **Port Assignment**: Uses random ports (port 0) to support parallel test execution
2. **Memory**: Each server instance is lightweight (~1KB overhead)
3. **Cleanup**: Always call `server.stop()` in `afterEach` to prevent port exhaustion
4. **Concurrency**: Multiple servers can run simultaneously without conflicts

## Troubleshooting

### Server Not Responding

```typescript
// Ensure server is started before use
const server = new MockHttpServer();
await server.start(); // ✅ Must await this

// Now server is ready
const response = await fetch(`${server.url}/test`);
```

### Port Already in Use

```typescript
// Don't specify a fixed port, use random port
const server = new MockHttpServer({ port: 0 }); // ✅ Random port
await server.start();

// NOT: new MockHttpServer({ port: 8080 }) // ❌ Can conflict
```

### Routes Not Found

```typescript
// Ensure route is added before making request
server.addRoute({
  method: 'GET',
  path: '/test',
  statusCode: 200,
  body: 'OK',
});

// Exact path matching required
await fetch(`${server.url}/test`); // ✅ Matches
await fetch(`${server.url}/Test`); // ❌ Case-sensitive
await fetch(`${server.url}/test/`); // ❌ Trailing slash
```

### Server Not Stopping

```typescript
// Always stop server in afterEach
afterEach(async () => {
  if (server) {
    await server.stop(); // ✅ Cleanup
  }
});
```

## Testing Checklist

When writing integration tests, ensure:

- [ ] Use `MockHttpServer` instead of external services
- [ ] Start server in `beforeEach` or at test start
- [ ] Stop server in `afterEach` to prevent resource leaks
- [ ] Use random ports (port 0) for parallel execution
- [ ] Test success cases (200, 201, 204)
- [ ] Test error cases (400, 404, 500, 503)
- [ ] Test timeout scenarios with delays
- [ ] Test flaky behavior if testing retry logic
- [ ] Verify custom headers if using `expectedHeaders`
- [ ] Test all HTTP methods (GET, HEAD, POST) as needed

## See Also

- [Constitution Principle X](../../.specify/memory/constitution.md#x-mock-services-for-testing-non-negotiable)
- [Integration Tests](../integration/)
- [Unit Tests](../unit/)
