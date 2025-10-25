/**
 * Unit tests for Error Classification Utilities
 *
 * Tests error message extraction, classification, and retry logic.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyNetworkError,
  getErrorMessage,
  isRetryableError,
  createStructuredError,
  getExpectedStatusValue,
  ErrorType,
} from '../../../src/utils/error.js';

describe('Error Utilities', () => {
  describe('classifyNetworkError()', () => {
    it('should classify timeout errors', () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      expect(classifyNetworkError(abortError)).toBe(ErrorType.TIMEOUT);

      const etimedoutError = new Error('ETIMEDOUT connection timeout');
      expect(classifyNetworkError(etimedoutError)).toBe(ErrorType.TIMEOUT);
    });

    it('should classify DNS failures', () => {
      const enotfoundError = new Error('getaddrinfo ENOTFOUND example.com');
      expect(classifyNetworkError(enotfoundError)).toBe(ErrorType.DNS_FAILURE);

      const enotfoundLower = new Error('enotfound');
      expect(classifyNetworkError(enotfoundLower)).toBe(ErrorType.DNS_FAILURE);
    });

    it('should classify connection refused errors', () => {
      const econnrefusedError = new Error('ECONNREFUSED');
      expect(classifyNetworkError(econnrefusedError)).toBe(ErrorType.CONNECTION_REFUSED);

      const refusedError = new Error('connection refused');
      expect(classifyNetworkError(refusedError)).toBe(ErrorType.CONNECTION_REFUSED);
    });

    it('should classify SSL/TLS errors', () => {
      const certError = new Error('certificate has expired');
      expect(classifyNetworkError(certError)).toBe(ErrorType.SSL_TLS);

      const sslError = new Error('SSL handshake failed');
      expect(classifyNetworkError(sslError)).toBe(ErrorType.SSL_TLS);

      const tlsError = new Error('TLS connection failed');
      expect(classifyNetworkError(tlsError)).toBe(ErrorType.SSL_TLS);
    });

    it('should classify network errors', () => {
      const unreachableError = new Error('ENETUNREACH');
      expect(classifyNetworkError(unreachableError)).toBe(ErrorType.NETWORK);

      const resetError = new Error('ECONNRESET');
      expect(classifyNetworkError(resetError)).toBe(ErrorType.NETWORK);

      const abortedError = new Error('ECONNABORTED');
      expect(classifyNetworkError(abortedError)).toBe(ErrorType.NETWORK);
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      expect(classifyNetworkError(unknownError)).toBe(ErrorType.UNKNOWN);
    });

    it('should handle non-Error objects', () => {
      expect(classifyNetworkError('string error')).toBe(ErrorType.UNKNOWN);
      expect(classifyNetworkError(null)).toBe(ErrorType.UNKNOWN);
      expect(classifyNetworkError(undefined)).toBe(ErrorType.UNKNOWN);
      expect(classifyNetworkError(123)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('getErrorMessage()', () => {
    it('should extract message from Error objects', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should map AbortError to human-readable message', () => {
      const error = new Error('timeout');
      error.name = 'AbortError';
      expect(getErrorMessage(error)).toBe('Connection timeout');
    });

    it('should map ETIMEDOUT to human-readable message', () => {
      const error = new Error('ETIMEDOUT');
      expect(getErrorMessage(error)).toBe('Connection timeout');
    });

    it('should map ENOTFOUND to DNS failure', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      expect(getErrorMessage(error)).toBe('DNS failure');
    });

    it('should map ECONNREFUSED to connection refused', () => {
      const error = new Error('ECONNREFUSED');
      expect(getErrorMessage(error)).toBe('Connection refused');
    });

    it('should map certificate errors', () => {
      const error = new Error('certificate has expired');
      expect(getErrorMessage(error)).toBe('SSL/TLS certificate error');
    });

    it('should handle fetch failed with cause property', () => {
      interface FetchError extends Error {
        cause?: {
          code?: string;
          message?: string;
        };
      }

      const error: FetchError = new Error('fetch failed');
      error.cause = { code: 'ENOTFOUND' };
      expect(getErrorMessage(error)).toBe('DNS failure');

      const error2: FetchError = new Error('fetch failed');
      error2.cause = { code: 'ECONNREFUSED' };
      expect(getErrorMessage(error2)).toBe('Connection refused');

      const error3: FetchError = new Error('fetch failed');
      error3.cause = { code: 'ETIMEDOUT' };
      expect(getErrorMessage(error3)).toBe('Connection timeout');
    });

    it('should return "Unknown error" for non-Error objects', () => {
      expect(getErrorMessage('string error')).toBe('Unknown error');
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(undefined)).toBe('Unknown error');
      expect(getErrorMessage(123)).toBe('Unknown error');
    });

    it('should preserve original message if no pattern matches', () => {
      const error = new Error('Custom error that does not match any pattern');
      expect(getErrorMessage(error)).toBe('Custom error that does not match any pattern');
    });
  });

  describe('isRetryableError()', () => {
    it('should mark timeout errors as retryable', () => {
      const error = new Error('ETIMEDOUT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should mark DNS failures as retryable', () => {
      const error = new Error('ENOTFOUND');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should mark connection refused as retryable', () => {
      const error = new Error('ECONNREFUSED');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should mark network errors as retryable', () => {
      const error = new Error('ENETUNREACH');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should NOT mark SSL/TLS errors as retryable', () => {
      const error = new Error('certificate has expired');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT mark unknown errors as retryable', () => {
      const error = new Error('Unknown error');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('createStructuredError()', () => {
    it('should create structured error from Error object', () => {
      const error = new Error('ETIMEDOUT');
      const structured = createStructuredError(error);

      expect(structured.type).toBe(ErrorType.TIMEOUT);
      expect(structured.message).toBe('Connection timeout');
      expect(structured.originalError).toBe(error);
    });

    it('should create structured error from non-Error object', () => {
      const structured = createStructuredError('string error');

      expect(structured.type).toBe(ErrorType.UNKNOWN);
      expect(structured.message).toBe('Unknown error');
      expect(structured.originalError).toBeInstanceOf(Error);
      expect(structured.originalError.message).toBe('string error');
    });

    it('should handle null and undefined', () => {
      const structured1 = createStructuredError(null);
      expect(structured1.type).toBe(ErrorType.UNKNOWN);
      expect(structured1.originalError).toBeInstanceOf(Error);

      const structured2 = createStructuredError(undefined);
      expect(structured2.type).toBe(ErrorType.UNKNOWN);
      expect(structured2.originalError).toBeInstanceOf(Error);
    });
  });

  describe('getExpectedStatusValue()', () => {
    it('should return single number as-is', () => {
      expect(getExpectedStatusValue(200)).toBe(200);
      expect(getExpectedStatusValue(404)).toBe(404);
      expect(getExpectedStatusValue(500)).toBe(500);
    });

    it('should return first element of array', () => {
      expect(getExpectedStatusValue([200, 201, 202])).toBe(200);
      expect(getExpectedStatusValue([404])).toBe(404);
    });

    it('should return 200 for empty array', () => {
      expect(getExpectedStatusValue([])).toBe(200);
    });
  });

  describe('ErrorType constants', () => {
    it('should export all error types', () => {
      expect(ErrorType.TIMEOUT).toBe('timeout');
      expect(ErrorType.DNS_FAILURE).toBe('dns_failure');
      expect(ErrorType.CONNECTION_REFUSED).toBe('connection_refused');
      expect(ErrorType.SSL_TLS).toBe('ssl_tls');
      expect(ErrorType.NETWORK).toBe('network');
      expect(ErrorType.UNKNOWN).toBe('unknown');
    });
  });
});
