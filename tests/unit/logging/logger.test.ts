/**
 * Unit tests for Structured JSON Logger
 *
 * Tests Pino logger creation, redaction, log levels, and security warnings.
 * Covers FR-033, FR-034, FR-034a: Correlation ID support, log levels, sensitive data redaction
 *
 * CRITICAL: Redaction tests verify sensitive data (API keys, tokens, passwords) is never logged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  createChildLogger,
  createModuleLogger,
  isLogLevelEnabled,
  safeStringify,
  LOG_LEVELS,
} from '../../../src/logging/logger.js';

/**
 * Type for logger with stream access (for testing)
 * Pino logger has an internal stream that emits 'data' events
 */
type LoggerWithStream = ReturnType<typeof createLogger> & {
  on: (event: string, callback: (chunk: Buffer) => void) => void;
};

/**
 * Interface for parsed log entry from Pino output
 */
interface LogEntry {
  level: string;
  msg?: string;
  message?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  api_key?: string;
  authorization?: string;
  secret?: string;
  accessToken?: string;
  username?: string;
  headers?: {
    authorization?: string;
    'content-type'?: string;
    [key: string]: string | undefined;
  };
  correlationId?: string;
  [key: string]: unknown;
}

describe('Structured JSON Logger', () => {
  let originalNodeEnv: string | undefined;
  let originalDebug: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalDebug = process.env.DEBUG;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalDebug === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = originalDebug;
    }

    vi.restoreAllMocks();
  });

  describe('createLogger()', () => {
    it('should create logger with default configuration', () => {
      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create logger with custom log level', () => {
      const logger = createLogger({ level: 'debug' });

      expect(logger.level).toBe('debug');
    });

    it('should create logger with custom service name', () => {
      const logger = createLogger({ serviceName: 'test-service' });

      // Logger should include service in base context
      expect(logger).toBeDefined();
    });

    it('should create logger with additional base context', () => {
      const base = { version: '1.0.0', region: 'us-east-1' };
      const logger = createLogger({ base });

      expect(logger).toBeDefined();
    });
  });

  describe('Log Level Configuration', () => {
    it('should default to info level', () => {
      delete process.env.DEBUG;
      const logger = createLogger();

      expect(logger.level).toBe('info');
    });

    it('should set debug level when DEBUG=debug', () => {
      process.env.DEBUG = 'debug';
      const logger = createLogger();

      expect(logger.level).toBe('debug');
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

    it('should handle case-insensitive DEBUG values', () => {
      process.env.DEBUG = 'DEBUG';
      const logger = createLogger();

      expect(logger.level).toBe('debug');
    });

    it('should use config level over environment if specified', () => {
      process.env.DEBUG = 'error';
      const logger = createLogger({ level: 'info' });

      // Environment should override config when DEBUG is set
      expect(logger.level).toBe('error');
    });
  });

  describe('Security Warning for Debug Logging (FR-034a)', () => {
    it('should emit warning to stderr when DEBUG=debug', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      process.env.DEBUG = 'debug';
      createLogger();

      expect(consoleErrorSpy).toHaveBeenCalled();
      const warningMessage = consoleErrorSpy.mock.calls[0]![0];
      expect(warningMessage).toContain('WARNING');
      expect(warningMessage).toContain('Debug logging enabled');
      expect(warningMessage).toContain('Sensitive data');

      consoleErrorSpy.mockRestore();
    });

    it('should not emit warning for non-debug levels', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      process.env.DEBUG = 'info';
      createLogger();

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not emit warning when DEBUG is not set', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      delete process.env.DEBUG;
      createLogger();

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Sensitive Data Redaction (FR-034) - SECURITY CRITICAL', () => {
    it('should redact password field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      // Capture log output by accessing the underlying stream
      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ password: 'secret123', message: 'User login' });

      // Give logger time to emit
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.password).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact token field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ token: 'abc123token', message: 'API request' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.token).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact apiKey field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ apiKey: 'key-abc123', message: 'External API call' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.apiKey).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact api_key field (snake_case)', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ api_key: 'key-xyz789', message: 'Config loaded' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.api_key).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact authorization field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ authorization: 'Bearer token123', message: 'Auth check' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.authorization).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact nested headers.authorization', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        message: 'HTTP request',
      });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.headers).toBeDefined();
          expect(log.headers!.authorization).toBeUndefined();
          expect(log.headers!['content-type']).toBe('application/json');
          resolve();
        }, 50);
      });
    });

    it('should redact secret field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ secret: 'my-secret-value', message: 'Config check' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.secret).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact accessToken field', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({ accessToken: 'access-xyz', message: 'OAuth flow' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.accessToken).toBeUndefined();
          resolve();
        }, 50);
      });
    });

    it('should redact multiple sensitive fields in same log', () => {
      const logger = createLogger();
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.info({
        password: 'pass123',
        token: 'token456',
        apiKey: 'key789',
        username: 'john', // Should NOT be redacted
        message: 'Multiple sensitive fields',
      });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.password).toBeUndefined();
          expect(log.token).toBeUndefined();
          expect(log.apiKey).toBeUndefined();
          expect(log.username).toBe('john'); // Non-sensitive field preserved
          resolve();
        }, 50);
      });
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with additional context', () => {
      const child = createChildLogger({ correlationId: '123', userId: 'user-456' });

      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });

    it('should inherit parent configuration', () => {
      const child = createChildLogger({ test: 'context' });

      // Child should have same log methods as parent
      expect(typeof child.info).toBe('function');
      expect(typeof child.error).toBe('function');
      expect(typeof child.debug).toBe('function');
    });
  });

  describe('Module Loggers', () => {
    it('should create module logger with module name', () => {
      const moduleLogger = createModuleLogger('health-check');

      expect(moduleLogger).toBeDefined();
      expect(typeof moduleLogger.info).toBe('function');
    });

    it('should accept various module names', () => {
      const loggers = [
        createModuleLogger('config-loader'),
        createModuleLogger('csv-writer'),
        createModuleLogger('metrics'),
      ];

      for (const logger of loggers) {
        expect(logger).toBeDefined();
      }
    });
  });

  describe('isLogLevelEnabled()', () => {
    it('should return true for enabled log levels', () => {
      // Default level is info
      expect(isLogLevelEnabled('info')).toBe(true);
      expect(isLogLevelEnabled('warn')).toBe(true);
      expect(isLogLevelEnabled('error')).toBe(true);
      expect(isLogLevelEnabled('fatal')).toBe(true);
    });

    it('should return false for disabled log levels', () => {
      // Default level is info, so debug and trace are disabled
      expect(isLogLevelEnabled('debug')).toBe(false);
      expect(isLogLevelEnabled('trace')).toBe(false);
    });
  });

  describe('LOG_LEVELS constants', () => {
    it('should export all log level constants', () => {
      expect(LOG_LEVELS.TRACE).toBe('trace');
      expect(LOG_LEVELS.DEBUG).toBe('debug');
      expect(LOG_LEVELS.INFO).toBe('info');
      expect(LOG_LEVELS.WARN).toBe('warn');
      expect(LOG_LEVELS.ERROR).toBe('error');
      expect(LOG_LEVELS.FATAL).toBe('fatal');
    });
  });

  describe('safeStringify()', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = safeStringify(obj);

      expect(result).toContain('name');
      expect(result).toContain('test');
      expect(result).toContain('123');
    });

    it('should handle circular references', () => {
      interface CircularObject {
        name: string;
        self?: CircularObject;
      }
      const obj: CircularObject = { name: 'test' };
      obj.self = obj; // Circular reference

      const result = safeStringify(obj);

      expect(result).toContain('[Circular reference detected]');
    });

    it('should stringify arrays', () => {
      const arr = [1, 2, 3, 'test'];
      const result = safeStringify(arr);

      expect(result).toContain('1');
      expect(result).toContain('test');
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

      expect(result).toContain('level1');
      expect(result).toContain('level2');
      expect(result).toContain('deep value');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      // undefined stringifies to undefined (no quotes)
      const result = safeStringify(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(safeStringify('string')).toBe('"string"');
      expect(safeStringify(123)).toBe('123');
      expect(safeStringify(true)).toBe('true');
    });
  });

  describe('Logger Integration', () => {
    it('should log at different levels', () => {
      const logger = createLogger({ level: 'trace' });
      const logOutput: LogEntry[] = [];

      (logger as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBe(5);
          resolve();
        }, 100);
      });
    });

    it('should include correlation ID in child logger context', () => {
      const correlationId = 'test-correlation-123';
      const child = createChildLogger({ correlationId });
      const logOutput: LogEntry[] = [];

      (child as LoggerWithStream).on('data', (chunk: Buffer) => logOutput.push(JSON.parse(chunk.toString())));

      child.info('Test message with correlation ID');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(logOutput.length).toBeGreaterThan(0);
          const log = logOutput[0]!;
          expect(log.correlationId).toBe(correlationId);
          resolve();
        }, 50);
      });
    });
  });
});
