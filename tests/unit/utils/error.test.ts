/**
 * Unit tests for error classification and message extraction utilities
 * Tests: src/utils/error.ts
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorType,
  classifyNetworkError,
  getErrorMessage,
  isRetryableError,
  createStructuredError,
  getExpectedStatusValue,
} from '@/utils/error.js';

describe('classifyNetworkError', () => {
  describe('Timeout errors', () => {
    it('should classify AbortError as TIMEOUT', () => {
      const error = new Error('Operation aborted');
      error.name = 'AbortError';
      expect(classifyNetworkError(error)).toBe(ErrorType.TIMEOUT);
    });

    it('should classify error with "timeout" message as TIMEOUT', () => {
      const error = new Error('Connection timeout occurred');
      expect(classifyNetworkError(error)).toBe(ErrorType.TIMEOUT);
    });

    it('should classify ETIMEDOUT error as TIMEOUT', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      expect(classifyNetworkError(error)).toBe(ErrorType.TIMEOUT);
    });

    it('should be case-insensitive for timeout detection', () => {
      const error = new Error('Connection TIMEOUT');
      expect(classifyNetworkError(error)).toBe(ErrorType.TIMEOUT);
    });
  });

  describe('DNS errors', () => {
    it('should classify ENOTFOUND error as DNS_FAILURE', () => {
      const error = new Error('ENOTFOUND: DNS lookup failed');
      expect(classifyNetworkError(error)).toBe(ErrorType.DNS_FAILURE);
    });

    it('should classify getaddrinfo error as DNS_FAILURE', () => {
      const error = new Error('getaddrinfo failed for domain');
      expect(classifyNetworkError(error)).toBe(ErrorType.DNS_FAILURE);
    });

    it('should be case-insensitive for DNS detection', () => {
      const error = new Error('GETADDRINFO failed');
      expect(classifyNetworkError(error)).toBe(ErrorType.DNS_FAILURE);
    });

    it('should classify mixed case ENOTFOUND as DNS_FAILURE', () => {
      const error = new Error('EnotFound error occurred');
      expect(classifyNetworkError(error)).toBe(ErrorType.DNS_FAILURE);
    });
  });

  describe('Connection refused errors', () => {
    it('should classify ECONNREFUSED as CONNECTION_REFUSED', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      expect(classifyNetworkError(error)).toBe(ErrorType.CONNECTION_REFUSED);
    });

    it('should classify "connection refused" message as CONNECTION_REFUSED', () => {
      const error = new Error('Connection refused by server');
      expect(classifyNetworkError(error)).toBe(ErrorType.CONNECTION_REFUSED);
    });

    it('should be case-insensitive for connection refused detection', () => {
      const error = new Error('CONNECTION REFUSED');
      expect(classifyNetworkError(error)).toBe(ErrorType.CONNECTION_REFUSED);
    });
  });

  describe('SSL/TLS errors', () => {
    it('should classify certificate error as SSL_TLS', () => {
      const error = new Error('Invalid certificate');
      expect(classifyNetworkError(error)).toBe(ErrorType.SSL_TLS);
    });

    it('should classify SSL error as SSL_TLS', () => {
      const error = new Error('SSL handshake failed');
      expect(classifyNetworkError(error)).toBe(ErrorType.SSL_TLS);
    });

    it('should classify TLS error as SSL_TLS', () => {
      const error = new Error('TLS connection failed');
      expect(classifyNetworkError(error)).toBe(ErrorType.SSL_TLS);
    });

    it('should be case-insensitive for SSL/TLS detection', () => {
      const error = new Error('ssl ERROR occurred');
      expect(classifyNetworkError(error)).toBe(ErrorType.SSL_TLS);
    });
  });

  describe('Network errors', () => {
    it('should classify ENETUNREACH as NETWORK', () => {
      const error = new Error('ENETUNREACH: Network unreachable');
      expect(classifyNetworkError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify ECONNRESET as NETWORK', () => {
      const error = new Error('ECONNRESET: Connection reset');
      expect(classifyNetworkError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify ECONNABORTED as NETWORK', () => {
      const error = new Error('ECONNABORTED: Connection aborted');
      expect(classifyNetworkError(error)).toBe(ErrorType.NETWORK);
    });
  });

  describe('Unknown errors', () => {
    it('should classify non-Error object as UNKNOWN', () => {
      expect(classifyNetworkError('string error')).toBe(ErrorType.UNKNOWN);
    });

    it('should classify null as UNKNOWN', () => {
      expect(classifyNetworkError(null)).toBe(ErrorType.UNKNOWN);
    });

    it('should classify undefined as UNKNOWN', () => {
      expect(classifyNetworkError(undefined)).toBe(ErrorType.UNKNOWN);
    });

    it('should classify unknown error message as UNKNOWN', () => {
      const error = new Error('Some random error');
      expect(classifyNetworkError(error)).toBe(ErrorType.UNKNOWN);
    });

    it('should classify empty error message as UNKNOWN', () => {
      const error = new Error('');
      expect(classifyNetworkError(error)).toBe(ErrorType.UNKNOWN);
    });
  });
});

describe('getErrorMessage', () => {
  describe('Fetch failures with cause', () => {
    it('should extract ENOTFOUND from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ENOTFOUND' };
      expect(getErrorMessage(error)).toBe('DNS failure');
    });

    it('should extract ECONNREFUSED from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ECONNREFUSED' };
      expect(getErrorMessage(error)).toBe('Connection refused');
    });

    it('should extract ETIMEDOUT from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ETIMEDOUT' };
      expect(getErrorMessage(error)).toBe('Connection timeout');
    });

    it('should extract ENETUNREACH from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ENETUNREACH' };
      expect(getErrorMessage(error)).toBe('Network unreachable');
    });

    it('should extract ECONNRESET from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ECONNRESET' };
      expect(getErrorMessage(error)).toBe('Connection reset by peer');
    });

    it('should extract ECONNABORTED from fetch failed cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: { code?: string } };
      error.cause = { code: 'ECONNABORTED' };
      expect(getErrorMessage(error)).toBe('Connection aborted');
    });

    it('should recursively extract message from cause.message when code is present', () => {
      const error = new Error('fetch failed') as Error & {
        cause?: { code?: string; message?: string };
      };
      error.cause = { code: 'UNKNOWN', message: 'ENOTFOUND lookup failed' };
      // The implementation creates a new Error from systemError.message and recursively calls getErrorMessage
      const result = getErrorMessage(error);
      expect(result).toBe('DNS failure');
    });

    it('should handle fetch failed without cause', () => {
      const error = new Error('fetch failed');
      expect(getErrorMessage(error)).toBe('fetch failed');
    });

    it('should handle fetch failed with non-object cause', () => {
      const error = new Error('fetch failed') as Error & { cause?: unknown };
      error.cause = 'string cause';
      expect(getErrorMessage(error)).toBe('fetch failed');
    });
  });

  describe('Pattern matching', () => {
    it('should match AbortError by name', () => {
      const error = new Error('Operation aborted');
      error.name = 'AbortError';
      expect(getErrorMessage(error)).toBe('Connection timeout');
    });

    it('should match ETIMEDOUT in message', () => {
      const error = new Error('ETIMEDOUT occurred');
      expect(getErrorMessage(error)).toBe('Connection timeout');
    });

    it('should match ENOTFOUND in message', () => {
      const error = new Error('ENOTFOUND error');
      expect(getErrorMessage(error)).toBe('DNS failure');
    });

    it('should match getaddrinfo with regex', () => {
      const error = new Error('getaddrinfo failed');
      expect(getErrorMessage(error)).toBe('DNS failure');
    });

    it('should match certificate with regex (case-insensitive)', () => {
      const error = new Error('Invalid CERTIFICATE');
      expect(getErrorMessage(error)).toBe('SSL/TLS certificate error');
    });

    it('should match SSL with regex (case-insensitive)', () => {
      const error = new Error('ssl handshake failed');
      expect(getErrorMessage(error)).toBe('SSL/TLS connection error');
    });

    it('should match TLS with regex (case-insensitive)', () => {
      const error = new Error('TLS error occurred');
      expect(getErrorMessage(error)).toBe('SSL/TLS connection error');
    });
  });

  describe('Non-Error inputs', () => {
    it('should return "Unknown error" for non-Error object', () => {
      expect(getErrorMessage('string error')).toBe('Unknown error');
    });

    it('should return "Unknown error" for null', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
    });

    it('should return "Unknown error" for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('Unknown error');
    });

    it('should return "Unknown error" for number', () => {
      expect(getErrorMessage(123)).toBe('Unknown error');
    });

    it('should return "Unknown error" for object', () => {
      expect(getErrorMessage({})).toBe('Unknown error');
    });
  });

  describe('Original message fallback', () => {
    it('should return original message if no pattern matches', () => {
      const error = new Error('Custom error message');
      expect(getErrorMessage(error)).toBe('Custom error message');
    });

    it('should return empty string if error message is empty', () => {
      const error = new Error('');
      expect(getErrorMessage(error)).toBe('');
    });
  });
});

describe('isRetryableError', () => {
  it('should return true for TIMEOUT errors', () => {
    const error = new Error('timeout');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for DNS_FAILURE errors', () => {
    const error = new Error('ENOTFOUND');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for CONNECTION_REFUSED errors', () => {
    const error = new Error('ECONNREFUSED');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for NETWORK errors', () => {
    const error = new Error('ENETUNREACH');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for SSL_TLS errors', () => {
    const error = new Error('Invalid certificate');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for UNKNOWN errors', () => {
    const error = new Error('Some random error');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for non-Error objects', () => {
    expect(isRetryableError('string error')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isRetryableError(null)).toBe(false);
  });
});

describe('createStructuredError', () => {
  it('should create structured error from Error object', () => {
    const error = new Error('ENOTFOUND lookup failed');
    const result = createStructuredError(error);

    expect(result.type).toBe(ErrorType.DNS_FAILURE);
    expect(result.message).toBe('DNS failure');
    expect(result.originalError).toBeInstanceOf(Error);
    expect(result.originalError.message).toBe('ENOTFOUND lookup failed');
  });

  it('should create structured error with timeout classification', () => {
    const error = new Error('timeout occurred');
    const result = createStructuredError(error);

    expect(result.type).toBe(ErrorType.TIMEOUT);
    // The message is the original error message since no pattern matches
    expect(result.message).toBe('timeout occurred');
  });

  it('should wrap non-Error objects in Error', () => {
    const result = createStructuredError('string error');

    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('Unknown error');
    expect(result.originalError).toBeInstanceOf(Error);
    expect(result.originalError.message).toBe('string error');
  });

  it('should wrap null in Error', () => {
    const result = createStructuredError(null);

    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('Unknown error');
    expect(result.originalError).toBeInstanceOf(Error);
    expect(result.originalError.message).toBe('null');
  });

  it('should wrap undefined in Error', () => {
    const result = createStructuredError(undefined);

    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('Unknown error');
    expect(result.originalError).toBeInstanceOf(Error);
    expect(result.originalError.message).toBe('undefined');
  });

  it('should wrap number in Error', () => {
    const result = createStructuredError(123);

    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('Unknown error');
    expect(result.originalError).toBeInstanceOf(Error);
    expect(result.originalError.message).toBe('123');
  });

  it('should preserve original Error object', () => {
    const originalError = new Error('test error');
    const result = createStructuredError(originalError);

    expect(result.originalError).toBe(originalError);
  });
});

describe('getExpectedStatusValue', () => {
  it('should return single status code unchanged', () => {
    expect(getExpectedStatusValue(200)).toBe(200);
  });

  it('should return 404 unchanged', () => {
    expect(getExpectedStatusValue(404)).toBe(404);
  });

  it('should return 500 unchanged', () => {
    expect(getExpectedStatusValue(500)).toBe(500);
  });

  it('should return first element from array', () => {
    expect(getExpectedStatusValue([200, 201, 204])).toBe(200);
  });

  it('should return first element from two-element array', () => {
    expect(getExpectedStatusValue([301, 302])).toBe(301);
  });

  it('should return 200 default for empty array', () => {
    expect(getExpectedStatusValue([])).toBe(200);
  });

  it('should handle array with single element', () => {
    expect(getExpectedStatusValue([404])).toBe(404);
  });

  it('should handle array with multiple elements', () => {
    expect(getExpectedStatusValue([200, 201, 202, 203])).toBe(200);
  });

  it('should handle 0 status code', () => {
    expect(getExpectedStatusValue(0)).toBe(0);
  });

  it('should handle negative status code', () => {
    expect(getExpectedStatusValue(-1)).toBe(-1);
  });

  it('should handle array starting with 0', () => {
    expect(getExpectedStatusValue([0, 200])).toBe(0);
  });
});
