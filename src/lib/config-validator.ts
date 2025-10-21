/**
 * Configuration validator
 * Based on data-model.md validation rules
 */

import type { Configuration, ServiceDefinition } from '../models/configuration.js';

export interface ValidationError {
  field: string;
  message: string;
}

export class ConfigurationValidationError extends Error {
  errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'ConfigurationValidationError';
    this.errors = errors;
  }
}

/**
 * Validate complete configuration
 * Throws ConfigurationValidationError if validation fails
 */
export function validateConfiguration(config: Configuration): void {
  const errors: ValidationError[] = [];

  // Validate pings array exists and has at least one service
  if (!config.pings || !Array.isArray(config.pings)) {
    errors.push({
      field: 'pings',
      message: 'Configuration must have a "pings" array',
    });
  } else if (config.pings.length === 0) {
    errors.push({
      field: 'pings',
      message: 'Configuration must have at least one service definition',
    });
  }

  // Validate global settings if present
  if (config.settings) {
    errors.push(...validateGlobalSettings(config.settings));
  }

  // Validate each service definition
  if (config.pings && Array.isArray(config.pings)) {
    const serviceNames = new Set<string>();

    config.pings.forEach((service, index) => {
      const serviceErrors = validateServiceDefinition(service, index);
      errors.push(...serviceErrors);

      // Check for duplicate service names (FR-007a)
      if (service.name) {
        if (serviceNames.has(service.name)) {
          errors.push({
            field: `pings[${index}].name`,
            message: `Duplicate service name: "${service.name}"`,
          });
        }
        serviceNames.add(service.name);
      }
    });
  }

  if (errors.length > 0) {
    throw new ConfigurationValidationError('Configuration validation failed', errors);
  }
}

/**
 * Validate global settings
 */
function validateGlobalSettings(settings: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof settings !== 'object' || settings === null) {
    return [{ field: 'settings', message: 'Settings must be an object' }];
  }

  const s = settings as Record<string, unknown>;

  // Validate numeric settings are positive integers
  const numericFields = [
    'check_interval',
    'warning_threshold',
    'timeout',
    'page_refresh',
    'max_retries',
    'worker_pool_size',
  ];

  for (const field of numericFields) {
    if (s[field] !== undefined) {
      if (typeof s[field] !== 'number' || s[field] < 0) {
        errors.push({
          field: `settings.${field}`,
          message: `${field} must be a positive number`,
        });
      }
    }
  }

  // check_interval must be >= 10 seconds
  if (typeof s.check_interval === 'number' && s.check_interval < 10) {
    errors.push({
      field: 'settings.check_interval',
      message: 'check_interval must be at least 10 seconds',
    });
  }

  // warning_threshold must be < timeout
  if (
    typeof s.warning_threshold === 'number' &&
    typeof s.timeout === 'number' &&
    s.warning_threshold >= s.timeout
  ) {
    errors.push({
      field: 'settings.warning_threshold',
      message: 'warning_threshold must be less than timeout',
    });
  }

  return errors;
}

/**
 * Validate service definition
 */
function validateServiceDefinition(service: ServiceDefinition, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `pings[${index}]`;

  // Required fields
  if (!service.name || service.name.trim() === '') {
    errors.push({
      field: `${prefix}.name`,
      message: 'Service name is required and must not be empty',
    });
  }

  if (!service.protocol || !['HTTP', 'HTTPS'].includes(service.protocol)) {
    errors.push({
      field: `${prefix}.protocol`,
      message: 'Protocol must be either "HTTP" or "HTTPS"',
    });
  }

  if (!service.method || !['GET', 'HEAD', 'POST'].includes(service.method)) {
    errors.push({
      field: `${prefix}.method`,
      message: 'Method must be one of: GET, HEAD, POST',
    });
  }

  if (!service.resource || service.resource.trim() === '') {
    errors.push({
      field: `${prefix}.resource`,
      message: 'Resource URL is required and must not be empty',
    });
  } else {
    // Validate URL format
    try {
      new URL(service.resource);
    } catch {
      errors.push({
        field: `${prefix}.resource`,
        message: 'Resource must be a valid HTTP/HTTPS URL',
      });
    }
  }

  // Validate expected validation criteria
  if (!service.expected) {
    errors.push({
      field: `${prefix}.expected`,
      message: 'Expected validation criteria are required',
    });
  } else {
    if (typeof service.expected.status !== 'number') {
      errors.push({
        field: `${prefix}.expected.status`,
        message: 'Expected status code is required and must be a number',
      });
    } else if (service.expected.status < 100 || service.expected.status >= 600) {
      errors.push({
        field: `${prefix}.expected.status`,
        message: 'Expected status code must be between 100-599',
      });
    }
  }

  // Validate payload only for POST requests
  if (service.payload !== undefined) {
    if (service.method !== 'POST') {
      errors.push({
        field: `${prefix}.payload`,
        message: 'Payload is only valid for POST method',
      });
    }
    if (typeof service.payload !== 'object' || service.payload === null) {
      errors.push({
        field: `${prefix}.payload`,
        message: 'Payload must be a valid JSON object',
      });
    }
  }

  // Validate optional numeric overrides
  if (service.interval !== undefined) {
    if (typeof service.interval !== 'number' || service.interval < 10) {
      errors.push({
        field: `${prefix}.interval`,
        message: 'Interval must be a number >= 10 seconds',
      });
    }
  }

  if (service.timeout !== undefined && typeof service.timeout !== 'number') {
    errors.push({
      field: `${prefix}.timeout`,
      message: 'Timeout must be a number',
    });
  }

  if (service.warning_threshold !== undefined && typeof service.warning_threshold !== 'number') {
    errors.push({
      field: `${prefix}.warning_threshold`,
      message: 'Warning threshold must be a number',
    });
  }

  // Per-service warning_threshold must be < per-service timeout
  if (
    typeof service.warning_threshold === 'number' &&
    typeof service.timeout === 'number' &&
    service.warning_threshold >= service.timeout
  ) {
    errors.push({
      field: `${prefix}.warning_threshold`,
      message: 'Warning threshold must be less than timeout',
    });
  }

  // Validate tags array
  if (service.tags !== undefined) {
    if (!Array.isArray(service.tags)) {
      errors.push({
        field: `${prefix}.tags`,
        message: 'Tags must be an array of strings',
      });
    } else {
      service.tags.forEach((tag, tagIndex) => {
        if (typeof tag !== 'string' || tag.trim() === '') {
          errors.push({
            field: `${prefix}.tags[${tagIndex}]`,
            message: 'Tag must be a non-empty string',
          });
        }
      });
    }
  }

  // Validate custom headers
  if (service.headers !== undefined) {
    if (!Array.isArray(service.headers)) {
      errors.push({
        field: `${prefix}.headers`,
        message: 'Headers must be an array',
      });
    } else {
      service.headers.forEach((header, headerIndex) => {
        if (!header.name || typeof header.name !== 'string') {
          errors.push({
            field: `${prefix}.headers[${headerIndex}].name`,
            message: 'Header name is required and must be a string',
          });
        }
        if (header.value === undefined || typeof header.value !== 'string') {
          errors.push({
            field: `${prefix}.headers[${headerIndex}].value`,
            message: 'Header value is required and must be a string',
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map((error) => `  - ${error.field}: ${error.message}`).join('\n');
}
