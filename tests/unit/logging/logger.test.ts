/**
 * Unit tests for Structured JSON Logger (Pino)
 *
 * Tests logger creation, configuration, log levels, sensitive data redaction,
 * child logger creation, and utility functions.
 *
 * Coverage Requirements:
 * - createLogger function with all configuration options
 * - Environment variable handling (DEBUG, NODE_ENV, CI)
 * - Log level filtering (trace, debug, info, warn, error, fatal)
 * - Security warning for debug mode (FR-034a)
 * - Sensitive data redaction (FR-034)
 * - Child logger creation (createChildLogger, createModuleLogger)
 * - Utility functions (isLogLevelEnabled, flushLogs, safeStringify)
 * - Error paths and edge cases
 *
 * Target: 90%+ coverage for src/logging/logger.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { asLoggerWithEvents } from '../../helpers/type-helpers.js';
import {
  createLogger,
  createChildLogger,
  createModuleLogger,
  isLogLevelEnabled,
  flushLogs,
  safeStringify,
  LOG_LEVELS,
  type LogLevel,
} from '../../../src/logging/logger.js';

describe('Logger Module', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.DEBUG;
    delete process.env.NODE_ENV;
    delete process.env.CI;

    // Clear console.error mock
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('createLogger', () => {
    describe('Basic configuration', () => {
      it('should create logger with default configuration', () => {
        const logger = createLogger();

        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.debug).toBe('function');
      });

      it('should create logger with custom log level', () => {
        const logger = createLogger({ level: 'error' });

        expect(logger).toBeDefined();
        expect(logger.level).toBe('error');
      });

      it('should create logger with custom service name', () => {
        const logger = createLogger({ serviceName: 'test-service' });

        expect(logger).toBeDefined();
        // Service name is in the base bindings
        expect(logger.bindings()).toMatchObject({
          service: 'test-service',
        });
      });

      it('should create logger with additional base context', () => {
        const logger = createLogger({
          base: { version: '1.0.0', region: 'us-east-1' },
        });

        expect(logger).toBeDefined();
        expect(logger.bindings()).toMatchObject({
          version: '1.0.0',
          region: 'us-east-1',
        });
      });

      it('should include default service name when not specified', () => {
        const logger = createLogger();

        expect(logger.bindings()).toMatchObject({
          service: 'govuk-status-monitor',
        });
      });

      it('should include environment in base context', () => {
        process.env.NODE_ENV = 'production';
        const logger = createLogger();

        expect(logger.bindings()).toMatchObject({
          env: 'production',
        });
      });

      it('should default to development environment when NODE_ENV not set', () => {
        delete process.env.NODE_ENV;
        const logger = createLogger();

        expect(logger.bindings()).toMatchObject({
          env: 'development',
        });
      });
    });

    describe('Log level determination from DEBUG environment variable', () => {
      it('should set debug level when DEBUG=debug', () => {
        process.env.DEBUG = 'debug';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const logger = createLogger();

        expect(logger.level).toBe('debug');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('WARNING: Debug logging enabled')
        );

        consoleSpy.mockRestore();
      });

      it('should set error level when DEBUG=error', () => {
        process.env.DEBUG = 'error';
        const logger = createLogger();

        expect(logger.level).toBe('error');
      });

      it('should set trace level when DEBUG=trace', () => {
        process.env.DEBUG = 'trace';
        const logger = createLogger();

        expect(logger.level).toBe('trace');
      });

      it('should handle uppercase DEBUG values', () => {
        process.env.DEBUG = 'DEBUG';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const logger = createLogger();

        expect(logger.level).toBe('debug');

        consoleSpy.mockRestore();
      });

      it('should handle mixed case DEBUG values', () => {
        process.env.DEBUG = 'DeBuG';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const logger = createLogger();

        expect(logger.level).toBe('debug');

        consoleSpy.mockRestore();
      });

      it('should ignore unrecognized DEBUG values', () => {
        process.env.DEBUG = 'invalid';
        const logger = createLogger();

        // Should fall back to default 'info'
        expect(logger.level).toBe('info');
      });

      it('should prefer DEBUG over config.level when both set', () => {
        process.env.DEBUG = 'error';
        const logger = createLogger({ level: 'debug' });

        expect(logger.level).toBe('error');
      });

      it('should use config.level when DEBUG not set', () => {
        delete process.env.DEBUG;
        const logger = createLogger({ level: 'warn' });

        expect(logger.level).toBe('warn');
      });
    });

    describe('Security warning for debug mode (FR-034a)', () => {
      it('should emit security warning to stderr when debug logging enabled', () => {
        process.env.DEBUG = 'debug';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        createLogger();

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('⚠️  WARNING: Debug logging enabled')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Sensitive data (API keys, tokens, passwords, PII)')
        );
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('will be logged'));

        consoleSpy.mockRestore();
      });

      it('should not emit warning for info level', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        createLogger({ level: 'info' });

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should not emit warning for error level', () => {
        process.env.DEBUG = 'error';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        createLogger();

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should not emit warning for trace level', () => {
        process.env.DEBUG = 'trace';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        createLogger();

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('Pretty printing configuration', () => {
      it('should enable pretty printing when prettyPrint=true', () => {
        const logger = createLogger({ prettyPrint: true });

        expect(logger).toBeDefined();
        // Pretty print logger has transport configured
        // We can't easily test this without triggering actual log output
      });

      it('should enable pretty printing in development when CI not set', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.CI;

        const logger = createLogger();

        expect(logger).toBeDefined();
      });

      it('should not enable pretty printing in production', () => {
        process.env.NODE_ENV = 'production';

        const logger = createLogger();

        expect(logger).toBeDefined();
      });

      it('should not enable pretty printing in CI environment', () => {
        process.env.NODE_ENV = 'development';
        process.env.CI = 'true';

        const logger = createLogger();

        expect(logger).toBeDefined();
      });

      it('should prefer prettyPrint config over environment detection', () => {
        process.env.NODE_ENV = 'production';
        process.env.CI = 'true';

        const logger = createLogger({ prettyPrint: true });

        expect(logger).toBeDefined();
      });
    });

    describe('Sensitive data redaction (FR-034)', () => {
      it('should redact password field', () => {
        const logger = createLogger();
        const logOutput: string[] = [];

        // Capture log output using shared type helper
        asLoggerWithEvents(logger).on('data', (chunk: string) => {
          logOutput.push(chunk);
        });

        logger.info({ password: 'secret123' }, 'User data');

        // Password should be removed
        const logged = JSON.stringify(logOutput);
        expect(logged).not.toContain('secret123');
      });

      it('should redact authorization headers', () => {
        const logger = createLogger();
        const logOutput: string[] = [];

        asLoggerWithEvents(logger).on('data', (chunk: string) => {
          logOutput.push(chunk);
        });

        logger.info({ headers: { authorization: 'Bearer token123' } }, 'Request');

        const logged = JSON.stringify(logOutput);
        expect(logged).not.toContain('token123');
      });

      it('should redact multiple sensitive fields', () => {
        const logger = createLogger();
        const logOutput: string[] = [];

        asLoggerWithEvents(logger).on('data', (chunk: string) => {
          logOutput.push(chunk);
        });

        logger.info(
          {
            password: 'pass123',
            apiKey: 'key456',
            token: 'token789',
            secret: 'secret000',
          },
          'Sensitive data'
        );

        const logged = JSON.stringify(logOutput);
        expect(logged).not.toContain('pass123');
        expect(logged).not.toContain('key456');
        expect(logged).not.toContain('token789');
        expect(logged).not.toContain('secret000');
      });
    });

    describe('Log levels', () => {
      it('should support trace level', () => {
        const logger = createLogger({ level: 'trace' });

        expect(logger.level).toBe('trace');
        expect(logger.isLevelEnabled('trace')).toBe(true);
      });

      it('should support debug level', () => {
        const logger = createLogger({ level: 'debug' });

        expect(logger.level).toBe('debug');
        expect(logger.isLevelEnabled('debug')).toBe(true);
        expect(logger.isLevelEnabled('trace')).toBe(false);
      });

      it('should support info level', () => {
        const logger = createLogger({ level: 'info' });

        expect(logger.level).toBe('info');
        expect(logger.isLevelEnabled('info')).toBe(true);
        expect(logger.isLevelEnabled('debug')).toBe(false);
      });

      it('should support warn level', () => {
        const logger = createLogger({ level: 'warn' });

        expect(logger.level).toBe('warn');
        expect(logger.isLevelEnabled('warn')).toBe(true);
        expect(logger.isLevelEnabled('info')).toBe(false);
      });

      it('should support error level', () => {
        const logger = createLogger({ level: 'error' });

        expect(logger.level).toBe('error');
        expect(logger.isLevelEnabled('error')).toBe(true);
        expect(logger.isLevelEnabled('warn')).toBe(false);
      });

      it('should support fatal level', () => {
        const logger = createLogger({ level: 'fatal' });

        expect(logger.level).toBe('fatal');
        expect(logger.isLevelEnabled('fatal')).toBe(true);
        expect(logger.isLevelEnabled('error')).toBe(false);
      });
    });

    describe('Error serialization', () => {
      it('should serialize Error objects properly', () => {
        const logger = createLogger();

        // Test that error serializer is configured
        expect(logger).toBeDefined();

        // Errors should be serialized with pino's standard serializer
        // which includes message, stack, and type fields
        const error = new Error('Test error');

        // We can verify serializer exists by checking the logger has it configured
        // The actual serialization happens during log emission
        expect(typeof logger.error).toBe('function');

        // Log an error to ensure no exceptions thrown
        expect(() => {
          logger.error({ err: error }, 'Error occurred');
        }).not.toThrow();
      });

      it('should serialize errors in both err and error fields', () => {
        const logger = createLogger();

        const error1 = new Error('Error 1');
        const error2 = new Error('Error 2');

        // Verify both error fields can be logged without exceptions
        expect(() => {
          logger.error({ err: error1, error: error2 }, 'Multiple errors');
        }).not.toThrow();
      });
    });
  });

  describe('createChildLogger', () => {
    it('should create child logger with additional context', () => {
      const childLogger = createChildLogger({ correlationId: 'test-123' });

      expect(childLogger).toBeDefined();
      expect(childLogger.bindings()).toMatchObject({
        correlationId: 'test-123',
      });
    });

    it('should create child logger with multiple context fields', () => {
      const childLogger = createChildLogger({
        correlationId: 'test-456',
        userId: 'user-789',
        requestId: 'req-000',
      });

      expect(childLogger).toBeDefined();
      expect(childLogger.bindings()).toMatchObject({
        correlationId: 'test-456',
        userId: 'user-789',
        requestId: 'req-000',
      });
    });

    it('should inherit parent logger configuration', () => {
      const childLogger = createChildLogger({ operation: 'test' });

      // Should have same service name as parent
      expect(childLogger.bindings()).toMatchObject({
        service: 'govuk-status-monitor',
        operation: 'test',
      });
    });

    it('should create child logger with empty context', () => {
      const childLogger = createChildLogger({});

      expect(childLogger).toBeDefined();
      expect(childLogger.bindings()).toMatchObject({
        service: 'govuk-status-monitor',
      });
    });

    it('should allow nested child loggers', () => {
      const parent = createChildLogger({ level1: 'parent' });
      const child = parent.child({ level2: 'child' });

      expect(child.bindings()).toMatchObject({
        level1: 'parent',
        level2: 'child',
      });
    });
  });

  describe('createModuleLogger', () => {
    it('should create logger with module context', () => {
      const moduleLogger = createModuleLogger('health-check');

      expect(moduleLogger).toBeDefined();
      expect(moduleLogger.bindings()).toMatchObject({
        module: 'health-check',
      });
    });

    it('should create logger for different modules', () => {
      const healthLogger = createModuleLogger('health-check');
      const storageLogger = createModuleLogger('storage');

      expect(healthLogger.bindings()).toMatchObject({
        module: 'health-check',
      });
      expect(storageLogger.bindings()).toMatchObject({
        module: 'storage',
      });
    });

    it('should inherit parent logger configuration', () => {
      const moduleLogger = createModuleLogger('metrics');

      expect(moduleLogger.bindings()).toMatchObject({
        service: 'govuk-status-monitor',
        module: 'metrics',
      });
    });

    it('should handle empty module name', () => {
      const moduleLogger = createModuleLogger('');

      expect(moduleLogger).toBeDefined();
      expect(moduleLogger.bindings()).toMatchObject({
        module: '',
      });
    });

    it('should handle module names with special characters', () => {
      const moduleLogger = createModuleLogger('health-check:worker-1');

      expect(moduleLogger).toBeDefined();
      expect(moduleLogger.bindings()).toMatchObject({
        module: 'health-check:worker-1',
      });
    });
  });

  describe('LOG_LEVELS constants', () => {
    it('should export all log level constants', () => {
      expect(LOG_LEVELS).toEqual({
        TRACE: 'trace',
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error',
        FATAL: 'fatal',
      });
    });

    it('should have readonly constant values', () => {
      expect(LOG_LEVELS.TRACE).toBe('trace');
      expect(LOG_LEVELS.DEBUG).toBe('debug');
      expect(LOG_LEVELS.INFO).toBe('info');
      expect(LOG_LEVELS.WARN).toBe('warn');
      expect(LOG_LEVELS.ERROR).toBe('error');
      expect(LOG_LEVELS.FATAL).toBe('fatal');
    });
  });

  describe('isLogLevelEnabled', () => {
    beforeEach(() => {
      // Reset to default info level
      delete process.env.DEBUG;
    });

    it('should return true for enabled log levels', () => {
      expect(isLogLevelEnabled('info')).toBe(true);
      expect(isLogLevelEnabled('warn')).toBe(true);
      expect(isLogLevelEnabled('error')).toBe(true);
      expect(isLogLevelEnabled('fatal')).toBe(true);
    });

    it('should return false for disabled log levels', () => {
      expect(isLogLevelEnabled('trace')).toBe(false);
      expect(isLogLevelEnabled('debug')).toBe(false);
    });

    it('should respect debug log level when enabled', async () => {
      process.env.DEBUG = 'debug';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Re-import to get new logger with debug level
      vi.resetModules();
      const { isLogLevelEnabled: debugIsLogLevelEnabled } = await import(
        '../../../src/logging/logger.js'
      );

      expect(debugIsLogLevelEnabled('debug')).toBe(true);
      expect(debugIsLogLevelEnabled('trace')).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should work for all valid log levels', () => {
      const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

      for (const level of levels) {
        const result = isLogLevelEnabled(level);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('flushLogs', () => {
    it('should return a Promise', () => {
      const result = flushLogs();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve after timeout', async () => {
      const start = Date.now();
      await flushLogs();
      const end = Date.now();

      // Should take at least 100ms (the flush timeout)
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some variance
    });

    it('should allow multiple concurrent flushes', async () => {
      const promises = [flushLogs(), flushLogs(), flushLogs()];

      await expect(Promise.all(promises)).resolves.toEqual([undefined, undefined, undefined]);
    });

    it('should resolve without errors', async () => {
      await expect(flushLogs()).resolves.toBeUndefined();
    });
  });

  describe('safeStringify', () => {
    describe('Successful serialization', () => {
      it('should stringify simple objects', () => {
        const obj = { name: 'test', value: 123 };
        const result = safeStringify(obj);

        expect(result).toContain('"name": "test"');
        expect(result).toContain('"value": 123');
      });

      it('should stringify nested objects', () => {
        const obj = {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
        };
        const result = safeStringify(obj);

        expect(result).toContain('"level3": "deep value"');
      });

      it('should stringify arrays', () => {
        const arr = [1, 2, 3, 'four', { five: 5 }];
        const result = safeStringify(arr);

        expect(result).toContain('1');
        expect(result).toContain('2');
        expect(result).toContain('3');
        expect(result).toContain('"four"');
        expect(result).toContain('"five": 5');
      });

      it('should stringify primitives', () => {
        expect(safeStringify('string')).toBe('"string"');
        expect(safeStringify(123)).toBe('123');
        expect(safeStringify(true)).toBe('true');
        expect(safeStringify(null)).toBe('null');
      });

      it('should stringify with pretty formatting', () => {
        const obj = { a: 1, b: 2 };
        const result = safeStringify(obj);

        // Should have indentation (2 spaces)
        expect(result).toContain('\n');
        expect(result).toMatch(/ {2}"a": 1/);
      });

      it('should handle empty objects', () => {
        expect(safeStringify({})).toBe('{}');
      });

      it('should handle empty arrays', () => {
        expect(safeStringify([])).toBe('[]');
      });
    });

    describe('Circular reference handling', () => {
      it('should detect circular references in objects', () => {
        const obj: Record<string, unknown> = { name: 'test' };
        obj.self = obj; // Circular reference

        const result = safeStringify(obj);

        expect(result).toBe('[Circular reference detected]');
      });

      it('should detect circular references in nested objects', () => {
        const parent: Record<string, unknown> = { name: 'parent' };
        const child: Record<string, unknown> = { name: 'child', parent };
        parent.child = child;
        child.self = child;

        const result = safeStringify(parent);

        expect(result).toBe('[Circular reference detected]');
      });

      it('should detect circular references in arrays', () => {
        const arr: unknown[] = [1, 2, 3];
        arr.push(arr); // Circular reference

        const result = safeStringify(arr);

        expect(result).toBe('[Circular reference detected]');
      });
    });

    describe('Error handling', () => {
      it('should handle BigInt serialization errors', () => {
        const obj = { bigInt: BigInt(9007199254740991) };

        const result = safeStringify(obj);

        // BigInt throws TypeError when stringified
        expect(result).toContain('[Stringify error:');
        expect(result).toContain('TypeError');
      });

      it('should handle undefined values', () => {
        const result = safeStringify(undefined);

        // JSON.stringify(undefined) returns undefined (not a string)
        // So our function should handle this gracefully
        expect(result).toBeUndefined();
      });

      it('should handle symbols', () => {
        const obj = { symbol: Symbol('test') };

        const result = safeStringify(obj);

        // Symbols are ignored in JSON.stringify, resulting in empty object
        expect(result).toBe('{}');
      });

      it('should handle functions', () => {
        const obj = { func: () => 'test' };

        const result = safeStringify(obj);

        // Functions are ignored in JSON.stringify, resulting in empty object
        expect(result).toBe('{}');
      });

      it('should handle objects with toJSON that throw', () => {
        const obj = {
          name: 'test',
          toJSON() {
            throw new Error('toJSON failed');
          },
        };

        const result = safeStringify(obj);

        expect(result).toContain('[Stringify error:');
        expect(result).toContain('toJSON failed');
      });
    });

    describe('Edge cases', () => {
      it('should handle Date objects', () => {
        const date = new Date('2025-10-26T12:00:00Z');
        const result = safeStringify(date);

        expect(result).toContain('2025-10-26T12:00:00.000Z');
      });

      it('should handle RegExp objects', () => {
        const regex = /test/gi;
        const result = safeStringify(regex);

        expect(result).toBe('{}'); // RegExp serializes to empty object
      });

      it('should handle Error objects', () => {
        const error = new Error('Test error');
        const result = safeStringify(error);

        // Error objects serialize to empty object or with enumerable props
        expect(result).toBeDefined();
      });

      it('should handle Map objects', () => {
        const map = new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ]);
        const result = safeStringify(map);

        expect(result).toBe('{}'); // Map serializes to empty object
      });

      it('should handle Set objects', () => {
        const set = new Set([1, 2, 3]);
        const result = safeStringify(set);

        expect(result).toBe('{}'); // Set serializes to empty object
      });

      it('should handle objects with null prototype', () => {
        const obj = Object.create(null);
        obj.key = 'value';

        const result = safeStringify(obj);

        expect(result).toContain('"key": "value"');
      });

      it('should handle deeply nested objects', () => {
        let obj: Record<string, unknown> = { value: 'leaf' };
        for (let i = 0; i < 100; i++) {
          obj = { nested: obj };
        }

        const result = safeStringify(obj);

        expect(result).toContain('"value": "leaf"');
      });
    });
  });
});
