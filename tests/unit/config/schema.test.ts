/**
 * Unit tests for Configuration Schema
 *
 * Tests JSON Schema structure and custom validation rules.
 * Covers FR-007: JSON Schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  configurationSchema,
  customValidationRules,
  warningThresholdRule,
  uniqueServiceNamesRule,
  postPayloadRule,
} from '../../../src/config/schema.js';
import type { Configuration } from '../../../src/types/config.js';

describe('Configuration Schema', () => {
  describe('Schema Structure', () => {
    it('should have correct root schema structure', () => {
      expect(configurationSchema).toBeDefined();
      expect(configurationSchema.type).toBe('object');
      expect(configurationSchema.properties).toBeDefined();
      expect(configurationSchema.required).toEqual(['pings']);
      expect(configurationSchema.additionalProperties).toBe(false);
    });

    it('should have pings array definition', () => {
      const pingsSchema = configurationSchema.properties.pings;

      expect(pingsSchema).toBeDefined();
      expect(pingsSchema.type).toBe('array');
      expect(pingsSchema.minItems).toBe(1);
      expect(pingsSchema.items).toBeDefined();
    });

    it('should have settings object definition', () => {
      const settingsSchema = configurationSchema.properties.settings;

      expect(settingsSchema).toBeDefined();
      expect(settingsSchema.type).toBe('object');
      expect(settingsSchema.nullable).toBe(true);
    });
  });

  describe('Service Definition Schema', () => {
    it('should require name, protocol, method, resource, expected', () => {
      const serviceSchema = configurationSchema.properties.pings.items;

      expect(serviceSchema.required).toEqual([
        'name',
        'protocol',
        'method',
        'resource',
        'expected',
      ]);
    });

    it('should define protocol enum as HTTP and HTTPS', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const protocolSchema = serviceSchema.properties.protocol;

      expect(protocolSchema.enum).toEqual(['HTTP', 'HTTPS']);
    });

    it('should define method enum as GET, HEAD, POST', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const methodSchema = serviceSchema.properties.method;

      expect(methodSchema.enum).toEqual(['GET', 'HEAD', 'POST']);
    });

    it('should enforce ASCII-only pattern for name', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const nameSchema = serviceSchema.properties.name;

      expect(nameSchema.pattern).toBe('^[\\x00-\\x7F]+$');
      expect(nameSchema.minLength).toBe(1);
      expect(nameSchema.maxLength).toBe(100);
    });

    it('should enforce http:// or https:// pattern for resource', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const resourceSchema = serviceSchema.properties.resource;

      expect(resourceSchema.pattern).toBe('^https?://');
      expect(resourceSchema.minLength).toBe(1);
    });

    it('should define expected.status as required integer 100-599', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const expectedSchema = serviceSchema.properties.expected;

      expect(expectedSchema.required).toEqual(['status']);
      expect(expectedSchema.properties.status.type).toBe('integer');
      expect(expectedSchema.properties.status.minimum).toBe(100);
      expect(expectedSchema.properties.status.maximum).toBe(599);
    });

    it('should allow nullable tags array', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const tagsSchema = serviceSchema.properties.tags;

      expect(tagsSchema.type).toBe('array');
      expect(tagsSchema.nullable).toBe(true);
    });

    it('should allow nullable headers array', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const headersSchema = serviceSchema.properties.headers;

      expect(headersSchema.type).toBe('array');
      expect(headersSchema.nullable).toBe(true);
    });

    it('should allow nullable payload object', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const payloadSchema = serviceSchema.properties.payload;

      expect(payloadSchema.type).toBe('object');
      expect(payloadSchema.nullable).toBe(true);
    });

    it('should not allow additional properties', () => {
      const serviceSchema = configurationSchema.properties.pings.items;

      expect(serviceSchema.additionalProperties).toBe(false);
    });
  });

  describe('Settings Schema', () => {
    it('should define check_interval minimum of 10', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const checkIntervalSchema = settingsSchema.properties.check_interval;

      expect(checkIntervalSchema.type).toBe('integer');
      expect(checkIntervalSchema.minimum).toBe(10);
      expect(checkIntervalSchema.nullable).toBe(true);
    });

    it('should define warning_threshold minimum of 0', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const warningThresholdSchema = settingsSchema.properties.warning_threshold;

      expect(warningThresholdSchema.type).toBe('number');
      expect(warningThresholdSchema.minimum).toBe(0);
      expect(warningThresholdSchema.nullable).toBe(true);
    });

    it('should define timeout minimum of 1', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const timeoutSchema = settingsSchema.properties.timeout;

      expect(timeoutSchema.type).toBe('number');
      expect(timeoutSchema.minimum).toBe(1);
      expect(timeoutSchema.nullable).toBe(true);
    });

    it('should define page_refresh minimum of 5', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const pageRefreshSchema = settingsSchema.properties.page_refresh;

      expect(pageRefreshSchema.type).toBe('integer');
      expect(pageRefreshSchema.minimum).toBe(5);
      expect(pageRefreshSchema.nullable).toBe(true);
    });

    it('should define max_retries range 0-10', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const maxRetriesSchema = settingsSchema.properties.max_retries;

      expect(maxRetriesSchema.type).toBe('integer');
      expect(maxRetriesSchema.minimum).toBe(0);
      expect(maxRetriesSchema.maximum).toBe(10);
      expect(maxRetriesSchema.nullable).toBe(true);
    });

    it('should define worker_pool_size range 0-100', () => {
      const settingsSchema = configurationSchema.properties.settings;
      const workerPoolSizeSchema = settingsSchema.properties.worker_pool_size;

      expect(workerPoolSizeSchema.type).toBe('integer');
      expect(workerPoolSizeSchema.minimum).toBe(0);
      expect(workerPoolSizeSchema.maximum).toBe(100);
      expect(workerPoolSizeSchema.nullable).toBe(true);
    });
  });

  describe('Custom Validation Rules', () => {
    it('should export all custom validation rules', () => {
      expect(customValidationRules).toBeDefined();
      expect(customValidationRules).toBeInstanceOf(Array);
      expect(customValidationRules.length).toBeGreaterThan(0);
    });

    it('should include warningThresholdRule', () => {
      expect(customValidationRules).toContain(warningThresholdRule);
    });

    it('should include uniqueServiceNamesRule', () => {
      expect(customValidationRules).toContain(uniqueServiceNamesRule);
    });

    it('should include postPayloadRule', () => {
      expect(customValidationRules).toContain(postPayloadRule);
    });

    describe('warningThresholdRule', () => {
      it('should have name and validate function', () => {
        expect(warningThresholdRule.name).toBe('warning_threshold < timeout');
        expect(typeof warningThresholdRule.validate).toBe('function');
      });

      it('should return null for valid global settings', () => {
        const config: Configuration = {
          settings: {
            warning_threshold: 2,
            timeout: 5,
          },
          pings: [
            {
              name: 'Test',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = warningThresholdRule.validate(config);
        expect(result).toBeNull();
      });

      it('should return error for invalid global settings', () => {
        const config: Configuration = {
          settings: {
            warning_threshold: 5,
            timeout: 5,
          },
          pings: [
            {
              name: 'Test',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = warningThresholdRule.validate(config);
        expect(result).not.toBeNull();
        expect(result).toContain('warning_threshold');
        expect(result).toContain('must be less than');
      });

      it('should return error for invalid service-level settings', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Test Service',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
              warning_threshold: 3,
              timeout: 3,
            },
          ],
        };

        const result = warningThresholdRule.validate(config);
        expect(result).not.toBeNull();
        expect(result).toContain('Test Service');
      });

      it('should return null when settings are undefined', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Test',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = warningThresholdRule.validate(config);
        expect(result).toBeNull();
      });
    });

    describe('uniqueServiceNamesRule', () => {
      it('should have name and validate function', () => {
        expect(uniqueServiceNamesRule.name).toBe('unique service names');
        expect(typeof uniqueServiceNamesRule.validate).toBe('function');
      });

      it('should return null for unique service names', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Service 1',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example1.com',
              expected: { status: 200 },
            },
            {
              name: 'Service 2',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example2.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = uniqueServiceNamesRule.validate(config);
        expect(result).toBeNull();
      });

      it('should return error for duplicate service names', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Duplicate',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example1.com',
              expected: { status: 200 },
            },
            {
              name: 'Duplicate',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example2.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = uniqueServiceNamesRule.validate(config);
        expect(result).not.toBeNull();
        expect(result).toContain('Duplicate');
      });

      it('should return null for single service', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Only Service',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = uniqueServiceNamesRule.validate(config);
        expect(result).toBeNull();
      });
    });

    describe('postPayloadRule', () => {
      it('should have name and validate function', () => {
        expect(postPayloadRule.name).toBe('POST method payload validation');
        expect(typeof postPayloadRule.validate).toBe('function');
      });

      it('should return null for POST with payload', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'POST Service',
              protocol: 'HTTP',
              method: 'POST',
              resource: 'http://example.com',
              expected: { status: 201 },
              payload: { key: 'value' },
            },
          ],
        };

        const result = postPayloadRule.validate(config);
        expect(result).toBeNull();
      });

      it('should return null for POST without payload', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'POST Service',
              protocol: 'HTTP',
              method: 'POST',
              resource: 'http://example.com',
              expected: { status: 201 },
            },
          ],
        };

        const result = postPayloadRule.validate(config);
        expect(result).toBeNull();
      });

      it('should return error for GET with payload', () => {
        const config = {
          pings: [
            {
              name: 'GET Service',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
              payload: { key: 'value' },
            },
          ],
        } as Configuration;

        const result = postPayloadRule.validate(config);
        expect(result).not.toBeNull();
        expect(result).toContain('GET Service');
        expect(result).toContain('payload is only valid for POST');
      });

      it('should return error for HEAD with payload', () => {
        const config = {
          pings: [
            {
              name: 'HEAD Service',
              protocol: 'HTTP',
              method: 'HEAD',
              resource: 'http://example.com',
              expected: { status: 200 },
              payload: { key: 'value' },
            },
          ],
        } as Configuration;

        const result = postPayloadRule.validate(config);
        expect(result).not.toBeNull();
        expect(result).toContain('HEAD Service');
      });

      it('should return null for GET without payload', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'GET Service',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
            },
          ],
        };

        const result = postPayloadRule.validate(config);
        expect(result).toBeNull();
      });
    });
  });

  describe('Expected Validation Schema', () => {
    it('should require status field', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const expectedSchema = serviceSchema.properties.expected;

      expect(expectedSchema.required).toContain('status');
    });

    it('should allow optional text field', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const expectedSchema = serviceSchema.properties.expected;

      expect(expectedSchema.properties.text).toBeDefined();
      expect(expectedSchema.properties.text.type).toBe('string');
      expect(expectedSchema.properties.text.nullable).toBe(true);
    });

    it('should allow optional headers object', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const expectedSchema = serviceSchema.properties.expected;

      expect(expectedSchema.properties.headers).toBeDefined();
      expect(expectedSchema.properties.headers.type).toBe('object');
      expect(expectedSchema.properties.headers.nullable).toBe(true);
    });

    it('should not allow additional properties in expected', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const expectedSchema = serviceSchema.properties.expected;

      expect(expectedSchema.additionalProperties).toBe(false);
    });
  });

  describe('Custom Header Schema', () => {
    it('should require name and value fields', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const headersSchema = serviceSchema.properties.headers;
      const headerItemSchema = headersSchema.items;

      expect(headerItemSchema.required).toEqual(['name', 'value']);
    });

    it('should define name as non-empty string', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const headersSchema = serviceSchema.properties.headers;
      const headerItemSchema = headersSchema.items;

      expect(headerItemSchema.properties.name.type).toBe('string');
      expect(headerItemSchema.properties.name.minLength).toBe(1);
    });

    it('should define value as string', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const headersSchema = serviceSchema.properties.headers;
      const headerItemSchema = headersSchema.items;

      expect(headerItemSchema.properties.value.type).toBe('string');
    });

    it('should not allow additional properties in header', () => {
      const serviceSchema = configurationSchema.properties.pings.items;
      const headersSchema = serviceSchema.properties.headers;
      const headerItemSchema = headersSchema.items;

      expect(headerItemSchema.additionalProperties).toBe(false);
    });
  });
});
