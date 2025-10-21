/**
 * Pino logger with structured JSON logging and correlation ID support
 * Based on research.md specifications
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isDebug = process.env.DEBUG === 'debug';

const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Production: JSON output
  // Development: Pretty-printed with colors
  ...(!isDevelopment
    ? {
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
      }
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }),

  // Base context included in all logs
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'govuk-status-monitor',
  },

  // Timestamp in ISO 8601 format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  // Redact sensitive fields (FR-034a: Security warnings for debug mode)
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
      'secret',
    ],
    remove: true,
  },
};

export const logger = pino(loggerOptions);

/**
 * Create a child logger with correlation ID
 * Per FR-036: All health checks should have correlation ID for traceability
 */
export function createChildLogger(correlationId: string, context?: Record<string, unknown>) {
  return logger.child({
    correlationId,
    ...context,
  });
}

/**
 * Log security warning when debug mode is enabled
 * Per FR-034a: Warn about sensitive data logging in debug mode
 */
if (isDebug) {
  logger.warn(
    {
      security: true,
      debugMode: true,
    },
    'DEBUG mode enabled: Full HTTP request/response bodies will be logged. Use only in secure troubleshooting environments.'
  );
}

/**
 * Export logger instance
 */
export type { Logger } from 'pino';
