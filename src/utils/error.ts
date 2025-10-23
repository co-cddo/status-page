/**
 * Error classification and message extraction utilities
 * Centralizes error handling patterns across health check modules
 */

/**
 * Node.js system error with code property
 */
interface NodeSystemError {
  code?: string;
  message?: string;
}

/**
 * Error with cause property (Node.js fetch errors)
 */
interface ErrorWithCause extends Error {
  cause?: NodeSystemError | Error;
}

export enum ErrorType {
  TIMEOUT = 'timeout',
  DNS_FAILURE = 'dns_failure',
  CONNECTION_REFUSED = 'connection_refused',
  SSL_TLS = 'ssl_tls',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

/**
 * Maps error patterns to human-readable messages
 */
const ERROR_MESSAGE_MAP = new Map<string | RegExp, string>([
  ['AbortError', 'Connection timeout'],
  ['ETIMEDOUT', 'Connection timeout'],
  ['ENOTFOUND', 'DNS failure'],
  [/getaddrinfo/i, 'DNS failure'],
  ['ECONNREFUSED', 'Connection refused'],
  ['ENETUNREACH', 'Network unreachable'],
  ['ECONNRESET', 'Connection reset by peer'],
  ['ECONNABORTED', 'Connection aborted'],
  [/certificate/i, 'SSL/TLS certificate error'],
  [/SSL|TLS/i, 'SSL/TLS connection error'],
]);

/**
 * Classifies network error into error type category
 * Used for retry logic and error reporting
 *
 * @param error Error object or unknown type
 * @returns ErrorType classification
 */
export function classifyNetworkError(error: unknown): ErrorType {
  if (!(error instanceof Error)) {
    return ErrorType.UNKNOWN;
  }

  const errorName = error.name;
  const errorMessage = error.message.toLowerCase();

  // Check for timeout errors
  if (errorName === 'AbortError' || errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
    return ErrorType.TIMEOUT;
  }

  // Check for DNS errors
  if (errorMessage.includes('enotfound') || errorMessage.includes('getaddrinfo')) {
    return ErrorType.DNS_FAILURE;
  }

  // Check for connection refused
  if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
    return ErrorType.CONNECTION_REFUSED;
  }

  // Check for SSL/TLS errors
  if (errorMessage.includes('certificate') || errorMessage.includes('ssl') || errorMessage.includes('tls')) {
    return ErrorType.SSL_TLS;
  }

  // Other network errors
  if (errorMessage.includes('enetunreach') || errorMessage.includes('econnreset') || errorMessage.includes('econnaborted')) {
    return ErrorType.NETWORK;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Extracts human-readable error message from various error types
 * Provides consistent error messages across the application
 *
 * @param error Error object or unknown type
 * @returns Human-readable error message
 */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }

  // Special handling for fetch failures - check cause property
  if (error.message === 'fetch failed' && 'cause' in error) {
    const errorWithCause = error as ErrorWithCause;
    const cause = errorWithCause.cause;

    if (cause && typeof cause === 'object' && 'code' in cause) {
      const systemError = cause as NodeSystemError;
      // If cause has a code, use it to determine the specific error
      if (systemError.code === 'ENOTFOUND') {
        return 'DNS failure';
      }
      if (systemError.code === 'ECONNREFUSED') {
        return 'Connection refused';
      }
      if (systemError.code === 'ETIMEDOUT') {
        return 'Connection timeout';
      }
      if (systemError.code === 'ENETUNREACH') {
        return 'Network unreachable';
      }
      if (systemError.code === 'ECONNRESET') {
        return 'Connection reset by peer';
      }
      if (systemError.code === 'ECONNABORTED') {
        return 'Connection aborted';
      }
      // If cause has a message, try to extract from it
      if (systemError.message) {
        const causeError = new Error(systemError.message);
        return getErrorMessage(causeError);
      }
    }
  }

  // Check error name first
  for (const [pattern, message] of ERROR_MESSAGE_MAP) {
    if (typeof pattern === 'string') {
      if (error.name === pattern || error.message.includes(pattern)) {
        return message;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(error.message)) {
        return message;
      }
    }
  }

  // Return original message if no pattern matched
  return error.message;
}

/**
 * Checks if an error is retryable based on error type
 * Network errors and timeouts are retryable, validation errors are not
 *
 * @param error Error object or unknown type
 * @returns true if error is retryable, false otherwise
 */
export function isRetryableError(error: unknown): boolean {
  const errorType = classifyNetworkError(error);

  return (
    errorType === ErrorType.TIMEOUT ||
    errorType === ErrorType.DNS_FAILURE ||
    errorType === ErrorType.CONNECTION_REFUSED ||
    errorType === ErrorType.NETWORK
  );
}

/**
 * Creates a structured error object with classification
 *
 * @param error Error object or unknown type
 * @returns Structured error information
 */
export function createStructuredError(error: unknown) {
  return {
    type: classifyNetworkError(error),
    message: getErrorMessage(error),
    originalError: error instanceof Error ? error : new Error(String(error)),
  };
}
