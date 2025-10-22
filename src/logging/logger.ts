/**
 * Structured JSON logger using Pino
 * Per FR-033, FR-034, FR-034a: Correlation ID support, log levels, sensitive data redaction
 */

import pino, { type Logger as PinoLogger } from 'pino';

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Log level (default: info) */
  level?: LogLevel;

  /** Enable pretty printing for development (default: false) */
  prettyPrint?: boolean;

  /** Service name to include in logs */
  serviceName?: string;

  /** Additional base context */
  base?: Record<string, unknown>;
}

/**
 * Create a Pino logger instance
 *
 * Per FR-033: JSON format with correlation ID support
 * Per FR-034: Log levels controlled by DEBUG env var
 * Per FR-034a: Security warning when DEBUG=debug
 *
 * @param config - Logger configuration
 * @returns Pino logger instance
 */
export function createLogger(config: LoggerConfig = {}): PinoLogger {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const debugLevel = process.env.DEBUG?.toLowerCase();

  // Determine log level from environment
  let level: LogLevel = config.level ?? 'info';

  if (debugLevel === 'debug') {
    level = 'debug';
  } else if (debugLevel === 'error') {
    level = 'error';
  } else if (debugLevel === 'trace') {
    level = 'trace';
  }

  // Emit security warning when debug logging is enabled
  // Per FR-034a: "When DEBUG=debug, emit startup warning to stderr and logs"
  if (level === 'debug') {
    console.error(
      '\n⚠️  WARNING: Debug logging enabled. Sensitive data (API keys, tokens, passwords, PII) ' +
        'will be logged. Use only in secure environments with appropriate log access controls.\n'
    );
  }

  const loggerOptions: pino.LoggerOptions = {
    level,

    // Base context included in all logs
    base: {
      service: config.serviceName ?? 'govuk-status-monitor',
      env: process.env.NODE_ENV ?? 'development',
      ...config.base,
    },

    // Timestamp in ISO 8601 format
    timestamp: pino.stdTimeFunctions.isoTime,

    // Serialize errors properly
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },

    // Redact sensitive fields per FR-034
    redact: {
      paths: [
        'password',
        'token',
        'apiKey',
        'api_key',
        'authorization',
        'cookie',
        'headers.authorization',
        'headers.cookie',
        'headers["x-api-key"]',
        'secret',
        'accessToken',
        'access_token',
        'refreshToken',
        'refresh_token',
        'privateKey',
        'private_key',
      ],
      remove: true, // Remove sensitive fields entirely
    },

    // Format level as string
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  };

  // Pretty printing for development
  if (config.prettyPrint || (isDevelopment && !process.env.CI)) {
    return pino({
      ...loggerOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    });
  }

  return pino(loggerOptions);
}

/**
 * Global logger instance
 * Created with default configuration
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 *
 * Child loggers inherit parent configuration and add specific context
 * Useful for adding correlation IDs, service names, or operation context
 *
 * @param context - Additional context to include in logs
 * @returns Child logger instance
 *
 * @example
 * ```typescript
 * const requestLogger = createChildLogger({ correlationId: '123', userId: 'user-456' });
 * requestLogger.info('Processing request');
 * // Output: {"level":"info","correlationId":"123","userId":"user-456","msg":"Processing request"}
 * ```
 */
export function createChildLogger(context: Record<string, unknown>): PinoLogger {
  return logger.child(context);
}

/**
 * Create a logger for a specific service or module
 *
 * @param serviceName - Name of the service/module
 * @returns Logger instance with service context
 *
 * @example
 * ```typescript
 * const healthCheckLogger = createModuleLogger('health-check');
 * healthCheckLogger.info('Executing health check');
 * // Output: {"level":"info","module":"health-check","msg":"Executing health check"}
 * ```
 */
export function createModuleLogger(serviceName: string): PinoLogger {
  return logger.child({ module: serviceName });
}

/**
 * Log levels for programmatic access
 */
export const LOG_LEVELS = {
  TRACE: 'trace' as const,
  DEBUG: 'debug' as const,
  INFO: 'info' as const,
  WARN: 'warn' as const,
  ERROR: 'error' as const,
  FATAL: 'fatal' as const,
};

/**
 * Check if a log level is enabled
 *
 * @param level - Log level to check
 * @returns True if level is enabled
 *
 * @example
 * ```typescript
 * if (isLogLevelEnabled('debug')) {
 *   // Perform expensive debug logging
 *   logger.debug({ data: expensiveOperation() }, 'Debug data');
 * }
 * ```
 */
export function isLogLevelEnabled(level: LogLevel): boolean {
  return logger.isLevelEnabled(level);
}

/**
 * Flush pending logs
 * Useful before process exit
 *
 * @returns Promise that resolves when logs are flushed
 */
export async function flushLogs(): Promise<void> {
  return new Promise((resolve) => {
    // Pino uses asynchronous I/O, give it time to flush
    setTimeout(resolve, 100);
  });
}

/**
 * Safely stringify an object for logging
 * Handles circular references and errors
 *
 * @param obj - Object to stringify
 * @returns JSON string or error message
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    if (error instanceof Error && error.message.includes('circular')) {
      return '[Circular reference detected]';
    }
    return `[Stringify error: ${String(error)}]`;
  }
}
