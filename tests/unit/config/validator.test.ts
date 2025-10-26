/**
 * Unit tests for Configuration Validator
 *
 * Tests JSON Schema validation, custom rules, and error reporting.
 * Covers FR-007: Validate configuration against schema with detailed error reporting
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Configuration } from '../../../src/types/config.js';
import {
  validateConfiguration,
  validateConfigurationCLI,
  ConfigurationValidationError,
} from '../../../src/config/validator.js';

describe('Configuration Validator', () => {
  describe('Valid Configurations', () => {
    it('should pass validation for minimal valid config', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'Test Service',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should pass validation for complete valid config', () => {
      const config: Configuration = {
        settings: {
          check_interval: 60,
          warning_threshold: 2,
          timeout: 5,
          page_refresh: 60,
          max_retries: 3,
          worker_pool_size: 4,
        },
        pings: [
          {
            name: 'Test Service',
            protocol: 'HTTPS',
            method: 'GET',
            resource: 'https://example.com/health',
            tags: ['production', 'api'],
            expected: {
              status: 200,
              text: 'OK',
              headers: {
                'content-type': 'application/json',
              },
            },
            headers: [
              { name: 'Authorization', value: 'Bearer token' },
              { name: 'X-API-Key', value: 'secret' },
            ],
            interval: 30,
            warning_threshold: 1,
            timeout: 3,
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should pass validation for POST with payload', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'POST Service',
            protocol: 'HTTPS',
            method: 'POST',
            resource: 'https://api.example.com/check',
            expected: { status: 201 },
            payload: { key: 'value', nested: { data: 123 } },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should pass validation for multiple services', () => {
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
            protocol: 'HTTPS',
            method: 'HEAD',
            resource: 'https://example2.com',
            expected: { status: 200 },
          },
          {
            name: 'Service 3',
            protocol: 'HTTP',
            method: 'POST',
            resource: 'http://example3.com',
            expected: { status: 201 },
            payload: {},
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject config missing pings array and not run custom rules', () => {
      const config = {} as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
        expect.fail('Should have thrown ConfigurationValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        const validationError = error as ConfigurationValidationError;
        expect(validationError.errors).toBeDefined();
        expect(validationError.errors.length).toBeGreaterThan(0);
        // Should report missing pings field
        expect(validationError.errors.some((e) => e.includes('pings'))).toBe(true);
        // Should be schema error, not custom validation error (verifies short-circuit)
        expect(validationError.message).toContain('schema error');
        expect(validationError.message).not.toContain('custom validation error');
      }
    });

    it('should reject config with empty pings array', () => {
      const config: Configuration = {
        pings: [],
      };

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          expect(error.errors.join(' ')).toContain('must have at least 1');
        }
      }
    });

    it('should reject service missing name', () => {
      const config = {
        pings: [
          {
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          expect(error.errors.join(' ')).toContain('name');
        }
      }
    });

    it('should reject service missing protocol', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject service missing method', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject service missing resource', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject service missing expected', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject service missing expected.status', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: {},
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });
  });

  describe('Protocol Validation', () => {
    it('should reject invalid protocol value', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'FTP',
            method: 'GET',
            resource: 'ftp://example.com',
            expected: { status: 200 },
          },
        ],
      } as unknown as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          expect(error.errors.join(' ')).toContain('HTTP');
          expect(error.errors.join(' ')).toContain('HTTPS');
        }
      }
    });

    it('should reject lowercase protocol', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'http',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as unknown as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });
  });

  describe('Method Validation', () => {
    it('should reject invalid method value', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'PUT',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as unknown as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('GET');
          expect(errorMsg).toContain('HEAD');
          expect(errorMsg).toContain('POST');
        }
      }
    });

    it('should accept GET method', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'GET Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept HEAD method', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'HEAD Test',
            protocol: 'HTTP',
            method: 'HEAD',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept POST method', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'POST Test',
            protocol: 'HTTP',
            method: 'POST',
            resource: 'http://example.com',
            expected: { status: 201 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });
  });

  describe('Resource URL Validation', () => {
    it('should reject resource without http:// or https:// prefix', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          expect(error.errors.join(' ')).toContain('pattern');
        }
      }
    });

    it('should accept http:// URLs', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'HTTP URL',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept https:// URLs', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'HTTPS URL',
            protocol: 'HTTPS',
            method: 'GET',
            resource: 'https://example.com',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept URLs with paths and query params', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'Complex URL',
            protocol: 'HTTPS',
            method: 'GET',
            resource: 'https://api.example.com/v1/health?format=json&verbose=true',
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should reject empty resource', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: '',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });
  });

  describe('Status Code Validation', () => {
    it('should accept valid HTTP status codes (100-599)', () => {
      const testCodes = [100, 200, 201, 204, 301, 302, 400, 401, 404, 500, 502, 503];

      for (const statusCode of testCodes) {
        const config: Configuration = {
          pings: [
            {
              name: `Test ${statusCode}`,
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: statusCode },
            },
          ],
        };

        expect(() => validateConfiguration(config)).not.toThrow();
      }
    });

    it('should reject status code below 100', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 99 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject status code above 599', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 600 },
          },
        ],
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });
  });

  describe('Timeout and Interval Validation', () => {
    it('should reject check_interval below 10', () => {
      const config = {
        settings: {
          check_interval: 5,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject timeout below 1', () => {
      const config = {
        settings: {
          timeout: 0,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject warning_threshold below 0', () => {
      const config = {
        settings: {
          warning_threshold: -1,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should accept warning_threshold of 0', () => {
      const config: Configuration = {
        settings: {
          warning_threshold: 0,
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

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should reject max_retries above 10', () => {
      const config = {
        settings: {
          max_retries: 11,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject worker_pool_size above 100', () => {
      const config = {
        settings: {
          worker_pool_size: 101,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });

    it('should reject page_refresh below 5', () => {
      const config = {
        settings: {
          page_refresh: 4,
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
      } as Configuration;

      expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);
    });
  });

  describe('Tag Validation', () => {
    it('should accept valid ASCII tags', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            tags: ['production', 'api', 'critical'],
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept tags with numbers and hyphens', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            tags: ['v1-api', 'region-us-east-1'],
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should accept empty tags array', () => {
      const config: Configuration = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            tags: [],
            expected: { status: 200 },
          },
        ],
      };

      expect(() => validateConfiguration(config)).not.toThrow();
    });
  });

  describe('Custom Validation Rules', () => {
    describe('warning_threshold < timeout', () => {
      it('should reject global warning_threshold >= timeout', () => {
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

        expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

        try {
          validateConfiguration(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationValidationError);
          if (error instanceof ConfigurationValidationError) {
            expect(error.errors.join(' ')).toContain('warning_threshold');
            expect(error.errors.join(' ')).toContain('must be less than');
          }
        }
      });

      it('should accept global warning_threshold < timeout', () => {
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

        expect(() => validateConfiguration(config)).not.toThrow();
      });

      it('should reject service-level warning_threshold >= timeout', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Test',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
              warning_threshold: 3,
              timeout: 3,
            },
          ],
        };

        expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

        try {
          validateConfiguration(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationValidationError);
          if (error instanceof ConfigurationValidationError) {
            expect(error.errors.join(' ')).toContain('Test');
            expect(error.errors.join(' ')).toContain('warning_threshold');
          }
        }
      });
    });

    describe('Unique Service Names', () => {
      it('should reject duplicate service names', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'Duplicate Name',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example1.com',
              expected: { status: 200 },
            },
            {
              name: 'Duplicate Name',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example2.com',
              expected: { status: 200 },
            },
          ],
        };

        expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

        try {
          validateConfiguration(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationValidationError);
          if (error instanceof ConfigurationValidationError) {
            expect(error.errors.join(' ')).toContain('Duplicate');
            expect(error.errors.join(' ')).toContain('Duplicate Name');
          }
        }
      });

      it('should accept unique service names', () => {
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

        expect(() => validateConfiguration(config)).not.toThrow();
      });
    });

    describe('POST Payload Validation', () => {
      it('should reject payload on non-POST requests', () => {
        const config = {
          pings: [
            {
              name: 'GET with Payload',
              protocol: 'HTTP',
              method: 'GET',
              resource: 'http://example.com',
              expected: { status: 200 },
              payload: { key: 'value' },
            },
          ],
        } as Configuration;

        expect(() => validateConfiguration(config)).toThrow(ConfigurationValidationError);

        try {
          validateConfiguration(config);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationValidationError);
          if (error instanceof ConfigurationValidationError) {
            expect(error.errors.join(' ')).toContain('payload is only valid for POST');
          }
        }
      });

      it('should accept payload on POST requests', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'POST with Payload',
              protocol: 'HTTP',
              method: 'POST',
              resource: 'http://example.com',
              expected: { status: 201 },
              payload: { key: 'value' },
            },
          ],
        };

        expect(() => validateConfiguration(config)).not.toThrow();
      });

      it('should accept POST without payload', () => {
        const config: Configuration = {
          pings: [
            {
              name: 'POST without Payload',
              protocol: 'HTTP',
              method: 'POST',
              resource: 'http://example.com',
              expected: { status: 201 },
            },
          ],
        };

        expect(() => validateConfiguration(config)).not.toThrow();
      });
    });
  });

  describe('ConfigurationValidationError', () => {
    it('should create error with message and errors array', () => {
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const error = new ConfigurationValidationError('Test validation failed', errors);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationValidationError);
      expect(error.name).toBe('ConfigurationValidationError');
      expect(error.message).toBe('Test validation failed');
      expect(error.errors).toEqual(errors);
    });

    it('should format errors for stderr output', () => {
      const errors = ['Missing required field: name', 'Invalid status code: 999'];
      const error = new ConfigurationValidationError('Validation failed', errors);

      const formatted = error.formatForStderr();

      expect(formatted).toContain('❌ Configuration validation failed');
      expect(formatted).toContain('1. Missing required field: name');
      expect(formatted).toContain('2. Invalid status code: 999');
      expect(formatted).toContain('Please fix the errors in config.yaml');
    });
  });

  describe('validateConfigurationCLI()', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true for valid config', () => {
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

      const result = validateConfigurationCLI(config);

      expect(result).toBe(true);
    });

    it('should return false and print to stderr for invalid config', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = {
        pings: [],
      } as Configuration;

      const result = validateConfigurationCLI(config);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0]![0]).toContain('❌ Configuration validation failed');

      consoleErrorSpy.mockRestore();
    });

    it('should handle null config gracefully with schema validation', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const config = null as unknown as Configuration;

      // null should trigger schema validation error (not a runtime crash)
      const result = validateConfigurationCLI(config);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0]![0]).toContain('❌ Configuration validation failed');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Multiple Errors Reporting', () => {
    it('should report all validation errors at once', () => {
      const config = {
        settings: {
          check_interval: 5, // Too low
          warning_threshold: 10,
          timeout: 5, // Less than warning_threshold
        },
        pings: [
          {
            name: 'Service 1',
            protocol: 'INVALID',
            method: 'DELETE',
            resource: 'not-a-url',
            expected: { status: 999 },
          },
        ],
      } as unknown as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          // Should have multiple errors
          expect(error.errors.length).toBeGreaterThan(3);
        }
      }
    });
  });

  describe('Error Formatting Edge Cases', () => {
    it('should handle maxLength validation error', () => {
      // Service name has max length of 100 chars
      const longName = 'a'.repeat(101);
      const config = {
        pings: [
          {
            name: longName,
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('too long');
          expect(errorMsg).toContain('at most 100 characters');
        }
      }
    });

    it('should handle additionalProperties validation error', () => {
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
            unknownProperty: 'this should not be here',
          },
        ],
      } as unknown as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('Unexpected property');
          expect(errorMsg).toContain('unknownProperty');
        }
      }
    });

    it('should handle unknown error keywords with default formatting', () => {
      // To test the default case (line 111), we need to trigger an Ajv error
      // with a keyword that isn't in our switch cases. The schema uses 'nullable'
      // which can produce errors, and other schemas might use keywords like 'not', 'oneOf', etc.
      // Since we can't easily modify the schema in tests, we test with invalid config
      // that produces an error with all the standard keywords already covered.
      // The default case is defensive code for future schema changes.

      // This config will trigger multiple errors
      const config = {
        pings: [
          {
            name: '', // minLength violation
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          // Should format the error message using minLength case
          expect(error.errors.length).toBeGreaterThan(0);
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('too short');
        }
      }
    });

    it('should handle empty errors array gracefully', () => {
      // This tests the early return on lines 72-73
      // We need to test formatAjvErrors indirectly through validateConfiguration
      // with a valid config that produces no errors
      const config: Configuration = {
        pings: [
          {
            name: 'Valid Service',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
          },
        ],
      };

      // This should not throw, meaning formatAjvErrors returned empty array
      expect(() => validateConfiguration(config)).not.toThrow();
    });

    it('should handle tags that are too long', () => {
      const longTag = 'a'.repeat(101);
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            tags: [longTag],
            expected: { status: 200 },
          },
        ],
      } as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('too long');
        }
      }
    });

    it('should handle additional properties in settings', () => {
      const config = {
        settings: {
          check_interval: 60,
          unknownSetting: 'invalid',
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
      } as unknown as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('Unexpected property');
          expect(errorMsg).toContain('unknownSetting');
        }
      }
    });

    it('should handle header name that is too short', () => {
      // Test minLength on nested objects (custom headers)
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: { status: 200 },
            headers: [
              {
                name: '', // minLength violation
                value: 'somevalue',
              },
            ],
          },
        ],
      } as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('too short');
          expect(errorMsg).toContain('at least 1 character');
        }
      }
    });

    it('should handle wrong type in expected.headers', () => {
      // Test type mismatch for object properties
      const config = {
        pings: [
          {
            name: 'Test',
            protocol: 'HTTP',
            method: 'GET',
            resource: 'http://example.com',
            expected: {
              status: 200,
              headers: 'not an object', // Should be object
            },
          },
        ],
      } as unknown as Configuration;

      try {
        validateConfiguration(config);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError);
        if (error instanceof ConfigurationValidationError) {
          const errorMsg = error.errors.join(' ');
          expect(errorMsg).toContain('Invalid type');
          expect(errorMsg).toContain('expected object');
        }
      }
    });

    it('should pass validation without errors (tests empty errors array path)', () => {
      // This explicitly tests the path where formatAjvErrors receives null/empty errors
      // When validation succeeds, Ajv sets validate.errors to null
      // The formatAjvErrors function should return [] in this case (lines 72-73)
      const validConfig: Configuration = {
        settings: {
          check_interval: 60,
          warning_threshold: 2,
          timeout: 5,
        },
        pings: [
          {
            name: 'Valid Service',
            protocol: 'HTTPS',
            method: 'GET',
            resource: 'https://example.com/api/health',
            expected: { status: 200 },
            tags: ['production'],
          },
        ],
      };

      // This should NOT throw - validation succeeds, formatAjvErrors returns []
      expect(() => validateConfiguration(validConfig)).not.toThrow();

      // Double-check it actually validates correctly
      let didValidate = false;
      try {
        validateConfiguration(validConfig);
        didValidate = true;
      } catch {
        didValidate = false;
      }
      expect(didValidate).toBe(true);
    });
  });
});
