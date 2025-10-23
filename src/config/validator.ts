/**
 * Configuration validator using Ajv JSON Schema
 * Per FR-007: Validate configuration against schema with detailed error reporting
 */

import Ajv2020Import from 'ajv';
import type { ErrorObject } from 'ajv';
import type { Configuration } from '../types/config.ts';
import { configurationSchema, customValidationRules } from './schema.ts';

// Workaround for Ajv v8 ESM + TypeScript constructor issue
// See: https://github.com/ajv-validator/ajv/issues/2132
// The import works at runtime but TypeScript doesn't recognize it as constructable
interface ValidateFunction<T = unknown> {
  (data: unknown): data is T;
  errors?: ErrorObject[] | null;
}
interface AjvInstance {
  compile<T = unknown>(schema: object): ValidateFunction<T>;
  validate<T = unknown>(schema: object, data: unknown): data is T;
  errors: ErrorObject[] | null | undefined;
}
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = Ajv2020Import as unknown as AjvConstructor;

/**
 * Error thrown when configuration validation fails
 */
export class ConfigurationValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message);
    this.name = 'ConfigurationValidationError';
  }

  /**
   * Format errors for stderr output
   * Per FR-007: Detailed error reporting to stderr
   */
  public formatForStderr(): string {
    const lines = [
      '❌ Configuration validation failed:',
      '',
      ...this.errors.map((err, index) => `  ${index + 1}. ${err}`),
      '',
      'Please fix the errors in config.yaml and try again.',
    ];

    return lines.join('\n');
  }
}

/**
 * Create Ajv validator instance with strict options
 */
function createValidator() {
  return new Ajv2020({
    allErrors: true, // Report all errors, not just the first
    verbose: true, // Include validated data in errors
    strict: true, // Strict mode for schema validation
    allowUnionTypes: true, // Allow union types in schema
  });
}

/**
 * Format Ajv validation errors into human-readable messages
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || 'root';
    const message = error.message || 'Unknown error';

    switch (error.keyword) {
      case 'required':
        return `Missing required field: ${path}/${error.params.missingProperty}`;

      case 'type':
        return `Invalid type at ${path}: expected ${error.params.type}, got ${typeof error.data}`;

      case 'enum':
        return `Invalid value at ${path}: must be one of [${error.params.allowedValues.join(', ')}]`;

      case 'minimum':
        return `Value at ${path} is too small: must be >= ${error.params.limit}`;

      case 'maximum':
        return `Value at ${path} is too large: must be <= ${error.params.limit}`;

      case 'minLength':
        return `Value at ${path} is too short: must have at least ${error.params.limit} characters`;

      case 'maxLength':
        return `Value at ${path} is too long: must have at most ${error.params.limit} characters`;

      case 'pattern':
        return `Value at ${path} does not match required pattern: ${error.params.pattern}`;

      case 'additionalProperties':
        return `Unexpected property at ${path}: ${error.params.additionalProperty}`;

      case 'minItems':
        return `Array at ${path} is too short: must have at least ${error.params.limit} items`;

      default:
        return `${path}: ${message}`;
    }
  });
}

/**
 * Validate configuration against JSON Schema and custom rules
 *
 * @param config - Configuration object to validate
 * @throws {ConfigurationValidationError} If validation fails
 *
 * @example
 * ```typescript
 * const config = loadConfiguration('./config.yaml');
 * validateConfiguration(config); // Throws if invalid
 * ```
 */
export function validateConfiguration(config: Configuration): void {
  const errors: string[] = [];

  // 1. JSON Schema validation
  const ajv = createValidator();
  const validate = ajv.compile(configurationSchema);
  const valid = validate(config);

  if (!valid) {
    const schemaErrors = formatAjvErrors(validate.errors);
    errors.push(...schemaErrors);
  }

  // 2. Custom validation rules
  for (const rule of customValidationRules) {
    const error = rule.validate(config);
    if (error) {
      errors.push(`${rule.name}: ${error}`);
    }
  }

  // 3. Check for removed services (FR-007b)
  // This is handled at runtime by comparing current config with previous state
  // No validation needed here

  // Throw if any errors found
  if (errors.length > 0) {
    throw new ConfigurationValidationError(
      `Configuration validation failed with ${errors.length} error(s)`,
      errors
    );
  }
}

/**
 * Validate configuration and print errors to stderr
 *
 * This is a convenience function for CLI usage
 *
 * @param config - Configuration object to validate
 * @returns True if valid, false if invalid
 *
 * @example
 * ```typescript
 * const config = loadConfiguration('./config.yaml');
 * if (!validateConfigurationCLI(config)) {
 *   process.exit(1);
 * }
 * ```
 */
export function validateConfigurationCLI(config: Configuration): boolean {
  try {
    validateConfiguration(config);
    return true;
  } catch (error) {
    if (error instanceof ConfigurationValidationError) {
      console.error(error.formatForStderr());
      return false;
    }
    throw error;
  }
}
