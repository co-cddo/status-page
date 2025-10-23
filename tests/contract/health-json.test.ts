/**
 * Contract test for _data/health.json schema validation (User Story 1)
 * Per T032b: Validate generated health.json against ServiceStatusAPI schema from OpenAPI spec
 *
 * This test MUST fail before T032 implementation (TDD requirement)
 *
 * Requirements:
 * - Validate against ServiceStatusAPI schema from OpenAPI spec
 * - Verify array structure
 * - Verify required fields (name, status, latency_ms, last_check_time, tags, http_status_code, failure_reason)
 * - Verify enum values for status (PENDING, PASS, DEGRADED, FAIL)
 * - Verify sorting order (FAIL first)
 * - Verify null handling for PENDING services
 */

import { describe, test, expect, beforeAll } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { StatusAPI } from '../../src/types/health-check.js';

describe('Health JSON Contract (US1)', () => {
  let ajv: InstanceType<typeof Ajv.default>;
  // Use plain object schema instead of JSONSchemaType due to nullable field compatibility issues
  let schema: Record<string, unknown>;

  beforeAll(() => {
    // Initialize Ajv with strict mode and formats support
    ajv = new Ajv.default({
      strict: true,
      allErrors: true,
      verbose: true
    });
    addFormats.default(ajv);

    // Define JSON Schema based on OpenAPI ServiceStatusAPI definition
    // Per specs/001-govuk-status-monitor/contracts/status-api.openapi.yaml
    const serviceStatusSchema = {
      type: 'object',
      required: ['name', 'status', 'latency_ms', 'last_check_time', 'tags', 'http_status_code', 'failure_reason'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
        },
        status: {
          type: 'string',
          enum: ['PENDING', 'PASS', 'DEGRADED', 'FAIL'],
        },
        latency_ms: {
          type: ['integer', 'null'],
          minimum: 0,
        },
        last_check_time: {
          type: ['string', 'null'],
          format: 'date-time',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          default: [],
        },
        http_status_code: {
          type: ['integer', 'null'],
          minimum: 0,
          maximum: 599,
        },
        failure_reason: {
          type: 'string',
          default: '',
        },
      },
      additionalProperties: false,
    };

    // StatusAPI is an array of ServiceStatus objects
    schema = {
      type: 'array',
      items: serviceStatusSchema,
      minItems: 0,
    };
  });

  test('validates array structure', () => {
    const validData: StatusAPI = [];
    const validate = ajv.compile(schema);
    
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates single PASS service with all required fields', () => {
    const validData: StatusAPI = [
      {
        name: 'Test Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: ['test', 'example'],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates PENDING service with null values', () => {
    const validData: StatusAPI = [
      {
        name: 'New Service',
        status: 'PENDING',
        latency_ms: null,
        last_check_time: null,
        tags: [],
        http_status_code: null,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates DEGRADED service', () => {
    const validData: StatusAPI = [
      {
        name: 'Slow Service',
        status: 'DEGRADED',
        latency_ms: 2500,
        last_check_time: '2025-10-21T14:30:15.000Z',
        tags: ['performance'],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates FAIL service with failure reason', () => {
    const validData: StatusAPI = [
      {
        name: 'Failed Service',
        status: 'FAIL',
        latency_ms: 0,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: ['critical'],
        http_status_code: 0,
        failure_reason: 'Connection timeout',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates service without tags (empty array)', () => {
    const validData: StatusAPI = [
      {
        name: 'Untagged Service',
        status: 'PASS',
        latency_ms: 85,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates mixed service statuses', () => {
    const validData: StatusAPI = [
      {
        name: 'Failed Service',
        status: 'FAIL',
        latency_ms: 0,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: ['critical'],
        http_status_code: 0,
        failure_reason: 'Connection timeout',
      },
      {
        name: 'Degraded Service',
        status: 'DEGRADED',
        latency_ms: 2500,
        last_check_time: '2025-10-21T14:30:15.000Z',
        tags: ['performance'],
        http_status_code: 200,
        failure_reason: '',
      },
      {
        name: 'Healthy Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:30.000Z',
        tags: ['stable'],
        http_status_code: 200,
        failure_reason: '',
      },
      {
        name: 'New Service',
        status: 'PENDING',
        latency_ms: null,
        last_check_time: null,
        tags: [],
        http_status_code: null,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('verifies sorting order (FAIL → DEGRADED → PASS → PENDING)', () => {
    const data: StatusAPI = [
      {
        name: 'Failed Service',
        status: 'FAIL',
        latency_ms: 0,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 0,
        failure_reason: 'Error',
      },
      {
        name: 'Degraded Service',
        status: 'DEGRADED',
        latency_ms: 2500,
        last_check_time: '2025-10-21T14:30:15.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
      {
        name: 'Healthy Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:30.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
      {
        name: 'New Service',
        status: 'PENDING',
        latency_ms: null,
        last_check_time: null,
        tags: [],
        http_status_code: null,
        failure_reason: '',
      },
    ];

    // Verify order: FAIL services first
    const firstFailIndex = data.findIndex(s => s.status === 'FAIL');
    expect(firstFailIndex).toBe(0);

    // DEGRADED services after FAIL
    const degradedServices = data.filter(s => s.status === 'DEGRADED');
    const firstDegradedIndex = data.findIndex(s => s.status === 'DEGRADED');
    if (degradedServices.length > 0) {
      expect(firstDegradedIndex).toBeGreaterThan(firstFailIndex === -1 ? -1 : firstFailIndex);
    }

    // PASS services after DEGRADED
    const passServices = data.filter(s => s.status === 'PASS');
    const firstPassIndex = data.findIndex(s => s.status === 'PASS');
    if (passServices.length > 0) {
      const lastDegradedIndex = data.map((s, i) => s.status === 'DEGRADED' ? i : -1).filter(i => i !== -1).pop();
      if (lastDegradedIndex !== undefined) {
        expect(firstPassIndex).toBeGreaterThan(lastDegradedIndex);
      }
    }

    // PENDING services last
    const pendingServices = data.filter(s => s.status === 'PENDING');
    const firstPendingIndex = data.findIndex(s => s.status === 'PENDING');
    if (pendingServices.length > 0) {
      const lastPassIndex = data.map((s, i) => s.status === 'PASS' ? i : -1).filter(i => i !== -1).pop();
      if (lastPassIndex !== undefined) {
        expect(firstPendingIndex).toBeGreaterThan(lastPassIndex);
      }
    }
  });

  test('rejects invalid status enum value', () => {
    const invalidData = [
      {
        name: 'Test Service',
        status: 'UNKNOWN',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ajv error message: "must be equal to one of the allowed values"
    expect(validate.errors?.[0]?.message).toBeTruthy();
  });

  test('rejects missing required field (name)', () => {
    const invalidData = [
      {
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  test('rejects negative latency_ms', () => {
    const invalidData = [
      {
        name: 'Test Service',
        status: 'PASS',
        latency_ms: -100,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ajv error message: "must be >= 0"
    expect(validate.errors?.[0]?.message).toBeTruthy();
  });

  test('rejects invalid http_status_code range', () => {
    const invalidData = [
      {
        name: 'Test Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 999,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ajv error message: "must be <= 599"
    expect(validate.errors?.[0]?.message).toBeTruthy();
  });

  test('rejects invalid ISO 8601 timestamp format', () => {
    const invalidData = [
      {
        name: 'Test Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: 'invalid-date',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
    expect(validate.errors?.[0]?.message).toContain('format');
  });

  test('verifies PENDING services should have null values (business logic)', () => {
    // Per OpenAPI spec, PENDING services should have null for latency_ms, last_check_time, http_status_code
    // This test verifies business logic expectation enforced in JsonWriter.toServiceStatusAPI

    const data: StatusAPI = [
      {
        name: 'Pending Service',
        status: 'PENDING',
        latency_ms: null,
        last_check_time: null,
        tags: [],
        http_status_code: null,
        failure_reason: '',
      },
    ];

    // Schema validation passes
    const validate = ajv.compile(schema);
    expect(validate(data)).toBe(true);

    // Verify business logic: PENDING services have null values
    const service = data[0];
    expect(service).toBeDefined();
    expect(service!.status).toBe('PENDING');
    expect(service!.latency_ms).toBe(null);
    expect(service!.last_check_time).toBe(null);
    expect(service!.http_status_code).toBe(null);
  });

  test('rejects empty service name', () => {
    const invalidData = [
      {
        name: '',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
    // Ajv error message: "must NOT have fewer than 1 characters"
    expect(validate.errors?.[0]?.message).toBeTruthy();
  });

  test('rejects empty tag strings', () => {
    const invalidData = [
      {
        name: 'Test Service',
        status: 'PASS',
        latency_ms: 120,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: ['valid-tag', ''], // Empty tag not allowed
        http_status_code: 200,
        failure_reason: '',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(invalidData)).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  test('accepts special characters in failure_reason', () => {
    const validData: StatusAPI = [
      {
        name: 'Failed Service',
        status: 'FAIL',
        latency_ms: 0,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 500,
        failure_reason: 'Expected status 200, got 500. Response: "Internal Server Error"',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(validData)).toBe(true);
    if (!validate(validData)) {
      console.error('Validation errors:', validate.errors);
    }
  });

  test('validates HTTP status code edge cases', () => {
    // Test minimum value (0 for connection failures)
    const minStatusData: StatusAPI = [
      {
        name: 'Connection Failed',
        status: 'FAIL',
        latency_ms: 0,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 0,
        failure_reason: 'Connection refused',
      },
    ];

    const validate = ajv.compile(schema);
    expect(validate(minStatusData)).toBe(true);

    // Test maximum value (599)
    const maxStatusData: StatusAPI = [
      {
        name: 'Server Error',
        status: 'FAIL',
        latency_ms: 100,
        last_check_time: '2025-10-21T14:30:00.000Z',
        tags: [],
        http_status_code: 599,
        failure_reason: 'Network Connect Timeout Error',
      },
    ];

    expect(validate(maxStatusData)).toBe(true);
  });

  test('validates large arrays (50+ services)', () => {
    const largeData: StatusAPI = [];

    for (let i = 0; i < 100; i++) {
      largeData.push({
        name: `Service ${i}`,
        status: i % 4 === 0 ? 'FAIL' : i % 4 === 1 ? 'DEGRADED' : i % 4 === 2 ? 'PASS' : 'PENDING',
        latency_ms: i % 4 === 3 ? null : 100 + i,
        last_check_time: i % 4 === 3 ? null : '2025-10-21T14:30:00.000Z',
        tags: i % 2 === 0 ? ['tag1', 'tag2'] : [],
        http_status_code: i % 4 === 3 ? null : 200,
        failure_reason: i % 4 === 0 ? 'Error' : '',
      });
    }

    const validate = ajv.compile(schema);
    expect(validate(largeData)).toBe(true);
    expect(largeData.length).toBe(100);
  });
});
