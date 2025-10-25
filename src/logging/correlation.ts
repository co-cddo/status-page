/**
 * Correlation ID generator for distributed tracing
 * Per FR-036: UUID v4 for traceability across services
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new correlation ID (UUID v4)
 *
 * Correlation IDs are used to trace requests across:
 * - Health check execution
 * - CSV writes
 * - Structured logs
 * - Prometheus metrics
 *
 * @returns UUID v4 string
 *
 * @example
 * ```typescript
 * const correlationId = generateCorrelationId();
 * logger.info({ correlationId }, 'Starting health check');
 * ```
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Validate that a string is a valid UUID v4
 *
 * @param id - String to validate
 * @returns True if valid UUID v4, false otherwise
 *
 * @example
 * ```typescript
 * isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidCorrelationId('not-a-uuid'); // false
 * ```
 */
export function isValidCorrelationId(id: string): boolean {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(id);
}

/**
 * Extract correlation ID from various sources
 *
 * This is useful for extracting correlation IDs from:
 * - HTTP headers (X-Correlation-ID, X-Request-ID)
 * - Log entries
 * - Error objects
 *
 * @param source - Object that might contain a correlation ID
 * @returns Correlation ID if found, otherwise generates a new one
 *
 * @example
 * ```typescript
 * const headers = { 'x-correlation-id': '550e8400-...' };
 * const id = extractOrGenerateCorrelationId(headers); // Returns existing ID
 *
 * const emptyHeaders = {};
 * const newId = extractOrGenerateCorrelationId(emptyHeaders); // Generates new ID
 * ```
 */
export function extractOrGenerateCorrelationId(
  source: Record<string, unknown> | undefined
): string {
  if (!source) {
    return generateCorrelationId();
  }

  // Common header names for correlation IDs
  const headerNames = [
    'correlationId',
    'correlation_id',
    'x-correlation-id',
    'x-request-id',
    'requestId',
    'request_id',
  ];

  for (const name of headerNames) {
    const value = source[name];
    if (typeof value === 'string' && isValidCorrelationId(value)) {
      return value;
    }
  }

  // No valid correlation ID found, generate new one
  return generateCorrelationId();
}

/**
 * Correlation ID context for async operations
 *
 * This allows maintaining correlation IDs across async boundaries
 * without explicit passing
 */
export class CorrelationContext {
  private static readonly contexts = new Map<symbol, string>();

  /**
   * Create a new correlation context
   *
   * @param correlationId - Optional correlation ID (generates if not provided)
   * @returns Symbol representing this context
   */
  static create(correlationId?: string): symbol {
    const id = correlationId ?? generateCorrelationId();
    const symbol = Symbol('correlationContext');
    this.contexts.set(symbol, id);
    return symbol;
  }

  /**
   * Get correlation ID from context
   *
   * @param context - Context symbol
   * @returns Correlation ID or undefined if context not found
   */
  static get(context: symbol): string | undefined {
    return this.contexts.get(context);
  }

  /**
   * Delete correlation context
   *
   * @param context - Context symbol
   */
  static delete(context: symbol): void {
    this.contexts.delete(context);
  }

  /**
   * Clear all correlation contexts
   * Useful for testing
   */
  static clear(): void {
    this.contexts.clear();
  }
}
