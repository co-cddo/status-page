/**
 * JSON Schema definition for config.yaml validation
 * Per FR-001, FR-002, FR-002a, FR-003, FR-007
 * Validated using Ajv JSON Schema validator
 */

import type { JSONSchemaType } from 'ajv';
import type { Configuration, GlobalSettings, ServiceDefinition } from '../types/config.js';

/**
 * JSON Schema for GlobalSettings
 */
const globalSettingsSchema: JSONSchemaType<GlobalSettings> = {
  type: 'object',
  properties: {
    check_interval: { type: 'integer', minimum: 10, nullable: true },
    warning_threshold: { type: 'number', minimum: 0, nullable: true },
    timeout: { type: 'number', minimum: 1, nullable: true },
    page_refresh: { type: 'integer', minimum: 5, nullable: true },
    max_retries: { type: 'integer', minimum: 0, maximum: 10, nullable: true },
    worker_pool_size: { type: 'integer', minimum: 0, maximum: 100, nullable: true },
    history_file: { type: 'string', minLength: 1, nullable: true },
    output_dir: { type: 'string', minLength: 1, nullable: true },
  },
  additionalProperties: false,
};

/**
 * JSON Schema for ExpectedValidation
 */
const expectedValidationSchema = {
  type: 'object',
  properties: {
    status: { type: 'integer', minimum: 100, maximum: 599 },
    text: { type: 'string', nullable: true },
    headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      required: [],
      nullable: true,
    },
  },
  required: ['status'],
  additionalProperties: false,
} as const;

/**
 * JSON Schema for CustomHeader
 */
const customHeaderSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    value: { type: 'string' },
  },
  required: ['name', 'value'],
  additionalProperties: false,
} as const;

/**
 * JSON Schema for ServiceDefinition
 */
const serviceDefinitionSchema: JSONSchemaType<ServiceDefinition> = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[\\x00-\\x7F]+$', // ASCII only
    },
    protocol: {
      type: 'string',
      enum: ['HTTP', 'HTTPS'],
    },
    method: {
      type: 'string',
      enum: ['GET', 'HEAD', 'POST'],
    },
    resource: {
      type: 'string',
      minLength: 1,
      pattern: '^https?://', // Must be full URL
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[\\x00-\\x7F]+$', // ASCII only
      },
      nullable: true,
    },
    expected: expectedValidationSchema,
    headers: {
      type: 'array',
      items: customHeaderSchema,
      nullable: true,
    },
    payload: {
      type: 'object',
      nullable: true,
    },
    interval: {
      type: 'integer',
      minimum: 10,
      nullable: true,
    },
    warning_threshold: {
      type: 'number',
      minimum: 0,
      nullable: true,
    },
    timeout: {
      type: 'number',
      minimum: 1,
      nullable: true,
    },
  },
  required: ['name', 'protocol', 'method', 'resource', 'expected'],
  additionalProperties: false,
};

/**
 * JSON Schema for complete Configuration
 * This is the root schema for config.yaml
 */
export const configurationSchema: JSONSchemaType<Configuration> = {
  type: 'object',
  properties: {
    settings: {
      ...globalSettingsSchema,
      nullable: true,
    },
    pings: {
      type: 'array',
      items: serviceDefinitionSchema,
      minItems: 1, // At least one service required
    },
  },
  required: ['pings'],
  additionalProperties: false,
};

/**
 * Custom validation rules beyond JSON Schema
 * These are checked after schema validation
 */
export interface ValidationRule {
  name: string;
  validate: (config: Configuration) => string | null;
}

/**
 * Validate that warning_threshold < timeout
 * Applies to both global settings and per-service overrides
 */
export const warningThresholdRule: ValidationRule = {
  name: 'warning_threshold < timeout',
  validate: (config: Configuration): string | null => {
    const globalWarning = config.settings?.warning_threshold;
    const globalTimeout = config.settings?.timeout;

    // Check global settings
    if (
      globalWarning !== undefined &&
      globalTimeout !== undefined &&
      globalWarning >= globalTimeout
    ) {
      return `Global warning_threshold (${globalWarning}) must be less than timeout (${globalTimeout})`;
    }

    // Check per-service overrides
    for (const service of config.pings) {
      const serviceWarning = service.warning_threshold ?? globalWarning;
      const serviceTimeout = service.timeout ?? globalTimeout;

      if (
        serviceWarning !== undefined &&
        serviceTimeout !== undefined &&
        serviceWarning >= serviceTimeout
      ) {
        return `Service "${service.name}": warning_threshold (${serviceWarning}) must be less than timeout (${serviceTimeout})`;
      }
    }

    return null;
  },
};

/**
 * Validate that all service names are unique
 * Per FR-007a
 */
export const uniqueServiceNamesRule: ValidationRule = {
  name: 'unique service names',
  validate: (config: Configuration): string | null => {
    const names = config.pings.map((p) => p.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

    if (duplicates.length > 0) {
      return `Duplicate service names found: ${[...new Set(duplicates)].join(', ')}`;
    }

    return null;
  },
};

/**
 * Validate that POST requests have either payload or it's omitted
 * (payload is optional even for POST, but if provided must be valid JSON)
 */
export const postPayloadRule: ValidationRule = {
  name: 'POST method payload validation',
  validate: (config: Configuration): string | null => {
    for (const service of config.pings) {
      if (service.method !== 'POST' && service.payload !== undefined) {
        return `Service "${service.name}": payload is only valid for POST requests`;
      }
    }

    return null;
  },
};

/**
 * All custom validation rules
 * Applied in order after JSON Schema validation
 */
export const customValidationRules: ValidationRule[] = [
  warningThresholdRule,
  uniqueServiceNamesRule,
  postPayloadRule,
];
