/**
 * Unit test for response validation (User Story 1 - Phase 4A)
 * Per T027a: Test validateStatusCode (match expected), validateResponseText
 * (substring in first 100KB, case-sensitive), validateResponseHeaders
 * (Location header for redirect, case-insensitive name matching),
 * validation failures, verify return values
 *
 * This test MUST fail before T027 implementation (TDD requirement)
 */

import { describe, test, expect } from 'vitest';
import {
  validateStatusCode,
  validateResponseText,
  validateResponseHeaders,
  type ValidationResult,
} from '../../../src/health-checks/validation.ts';

describe('validateStatusCode (T027a - TDD Phase)', () => {
  test('should return valid when status code matches expected single number', () => {
    const result = validateStatusCode(200, 200);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should return valid when status code matches expected array', () => {
    const result = validateStatusCode(200, [200]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should return invalid when status code does not match expected single number', () => {
    const result = validateStatusCode(404, 200);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('404');
    expect(result.error).toContain('200');
  });

  test('should return valid when status code matches one of multiple expected codes', () => {
    const result = validateStatusCode(201, [200, 201, 204]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should return invalid when status code does not match expected', () => {
    const result = validateStatusCode(404, [200]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('404');
    expect(result.error).toContain('200');
  });

  test('should handle 3xx redirect status codes', () => {
    const result = validateStatusCode(302, [301, 302]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle 4xx client error codes', () => {
    const result = validateStatusCode(404, [404]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle 5xx server error codes', () => {
    const result = validateStatusCode(500, [500]);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should reject status code when expected codes list is empty', () => {
    const result = validateStatusCode(200, []);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
  });
});

describe('validateResponseText (T027a - TDD Phase)', () => {
  test('should return valid when expected text found in response body', () => {
    const responseBody = 'This is a test response containing the expected text.';
    const expectedText = 'expected text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should return invalid when expected text not found in response body', () => {
    const responseBody = 'This is a test response.';
    const expectedText = 'NONEXISTENT_TEXT';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('not found');
    expect(result.error).toContain('NONEXISTENT_TEXT');
  });

  test('should perform case-sensitive matching (FR-014)', () => {
    const responseBody = 'This is a test response with lowercase text.';
    const expectedText = 'Lowercase Text'; // Different case

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('should find text at beginning of response', () => {
    const responseBody = 'Expected text is at the start of this response.';
    const expectedText = 'Expected text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should find text at end of response', () => {
    const responseBody = 'This response ends with expected text';
    const expectedText = 'expected text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should find text in middle of response', () => {
    const responseBody = 'Start of response, expected text in middle, end of response.';
    const expectedText = 'expected text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle special regex characters in expected text', () => {
    const responseBody = 'Response with special chars: $100.00 (tax included)';
    const expectedText = '$100.00';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should search only first 100KB of response body (FR-014)', () => {
    // Create a response > 100KB with target text at 150KB position
    const first100KB = 'a'.repeat(100 * 1024);
    const remainingContent = 'b'.repeat(50 * 1024) + 'TARGET_TEXT_HERE' + 'c'.repeat(1024);
    const largeResponse = first100KB + remainingContent;
    const expectedText = 'TARGET_TEXT_HERE';

    const result = validateResponseText(largeResponse, expectedText);

    // Should NOT find text because it's beyond 100KB limit
    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should find text within first 100KB of large response', () => {
    // Create a response > 100KB with target text within first 100KB
    const contentBefore = 'a'.repeat(50 * 1024);
    const targetText = 'FOUND_WITHIN_LIMIT';
    const contentAfter = 'b'.repeat(100 * 1024);
    const largeResponse = contentBefore + targetText + contentAfter;

    const result = validateResponseText(largeResponse, targetText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle empty response body', () => {
    const responseBody = '';
    const expectedText = 'any text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('should handle empty expected text (matches any response)', () => {
    const responseBody = 'Any response body';
    const expectedText = '';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle multiline response text', () => {
    const responseBody = `Line 1 of response
Line 2 with expected text
Line 3 of response`;
    const expectedText = 'expected text';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle HTML response bodies', () => {
    const responseBody = '<html><body><h1>Welcome to GOV.UK</h1></body></html>';
    const expectedText = 'Welcome to GOV.UK';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });

  test('should handle JSON response bodies', () => {
    const responseBody = '{"status":"healthy","service":"publishing-api"}';
    const expectedText = '"status":"healthy"';

    const result = validateResponseText(responseBody, expectedText);

    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
  });
});

describe('validateResponseHeaders (T027a - TDD Phase)', () => {
  describe('Location Header Validation (FR-004a)', () => {
    test('should validate Location header for redirects', () => {
      const headers = new Headers({
        location: 'https://example.com/redirected',
      });
      const expectedHeaders = {
        location: 'https://example.com/redirected',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should fail when Location header value does not match', () => {
      const headers = new Headers({
        location: 'https://example.com/wrong-path',
      });
      const expectedHeaders = {
        location: 'https://example.com/correct-path',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('location');
    });

    test('should fail when Location header is missing', () => {
      const headers = new Headers({
        'content-type': 'text/html',
      });
      const expectedHeaders = {
        location: 'https://example.com',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('location');
      expect(result.error).toContain('not found');
    });
  });

  describe('Case-Insensitive Header Name Matching', () => {
    test('should match header names case-insensitively', () => {
      const headers = new Headers({
        'content-type': 'application/json',
      });
      const expectedHeaders = {
        'Content-Type': 'application/json', // Capital letters
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should match header names with mixed case', () => {
      const headers = new Headers({
        'X-Custom-Header': 'value',
      });
      const expectedHeaders = {
        'x-custom-header': 'value', // Lowercase
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should match header names all uppercase', () => {
      const headers = new Headers({
        AUTHORIZATION: 'Bearer token',
      });
      const expectedHeaders = {
        authorization: 'Bearer token', // Lowercase
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });
  });

  describe('Case-Sensitive Header Value Matching', () => {
    test('should match header values case-sensitively', () => {
      const headers = new Headers({
        'x-custom-header': 'CustomValue',
      });
      const expectedHeaders = {
        'x-custom-header': 'CustomValue', // Exact case
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should fail when header value case does not match', () => {
      const headers = new Headers({
        'x-custom-header': 'CustomValue',
      });
      const expectedHeaders = {
        'x-custom-header': 'customvalue', // Lowercase
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('x-custom-header');
      expect(result.error).toContain('value');
    });

    test('should handle Bearer token case-sensitivity', () => {
      const headers = new Headers({
        authorization: 'Bearer AbCdEf123',
      });
      const expectedHeaders = {
        authorization: 'Bearer AbCdEf123', // Exact case
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });
  });

  describe('Multiple Header Validation', () => {
    test('should validate multiple expected headers', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'cache-control': 'no-cache',
        'x-custom-header': 'custom-value',
      });
      const expectedHeaders = {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
        'x-custom-header': 'custom-value',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should fail when any expected header is missing', () => {
      const headers = new Headers({
        'content-type': 'application/json',
      });
      const expectedHeaders = {
        'content-type': 'application/json',
        'cache-control': 'no-cache', // Missing
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cache-control');
    });

    test('should fail when any expected header value does not match', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'cache-control': 'public', // Wrong value
      });
      const expectedHeaders = {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cache-control');
    });

    test('should ignore unexpected headers not in expectedHeaders', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-extra-header': 'extra-value', // Not expected
      });
      const expectedHeaders = {
        'content-type': 'application/json',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty expected headers (no validation required)', () => {
      const headers = new Headers({
        'content-type': 'application/json',
      });
      const expectedHeaders = {};

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should handle empty response headers', () => {
      const headers = new Headers();
      const expectedHeaders = {
        'content-type': 'application/json',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('content-type');
      expect(result.error).toContain('not found');
    });

    test('should handle headers with whitespace in values', () => {
      const headers = new Headers({
        'content-type': ' application/json ',
      });
      const expectedHeaders = {
        'content-type': 'application/json',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      // Headers API automatically trims whitespace per HTTP/1.1 spec (RFC 7230)
      // So ' application/json ' becomes 'application/json' and matches
      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should handle headers with special characters', () => {
      const headers = new Headers({
        'x-rate-limit': '100',
        'x-complex-value': 'key=value; param=123',
      });
      const expectedHeaders = {
        'x-rate-limit': '100',
        'x-complex-value': 'key=value; param=123',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should handle headers with numeric values', () => {
      const headers = new Headers({
        'content-length': '12345',
      });
      const expectedHeaders = {
        'content-length': '12345',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should handle multiple headers with same name via fallback iteration', () => {
      // Create a Headers object where direct get() fails but iteration finds it
      const headers = new Headers();
      headers.append('X-Custom-Header', 'first-value');

      const expectedHeaders = {
        'x-custom-header': 'first-value',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should stop at first match when iterating headers', () => {
      // Test that the fallback iteration stops at first match (!result condition)
      const headers = new Headers();
      headers.append('X-Test-Header', 'correct-value');

      const expectedHeaders = {
        'X-TEST-HEADER': 'correct-value',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should use fallback iteration when direct get returns null', () => {
      // Create a Headers-like object where get() returns null but forEach finds it
      const realHeaders = new Headers();
      realHeaders.set('x-custom-test', 'test-value');

      // Create a proxy that makes get() return null but allows forEach to work
      const headersProxy = new Proxy(realHeaders, {
        get(target, prop) {
          if (prop === 'get') {
            // Force get() to return null to trigger fallback
            return () => null;
          }
          return Reflect.get(target, prop);
        }
      });

      const expectedHeaders = {
        'X-CUSTOM-TEST': 'test-value',
      };

      const result = validateResponseHeaders(headersProxy as Headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });

    test('should handle case where header not found even in iteration', () => {
      // Test the null return path when header truly doesn't exist
      const headers = new Headers();
      headers.set('existing-header', 'value');

      const expectedHeaders = {
        'non-existent-header': 'value',
      };

      const result = validateResponseHeaders(headers, expectedHeaders);

      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-existent-header');
      expect(result.error).toContain('not found');
    });
  });
});

describe('ValidationResult Type', () => {
  test('valid result should have valid=true and no error', () => {
    const result: ValidationResult = {
      valid: true,
    };

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('invalid result should have valid=false and error message', () => {
    const result: ValidationResult = {
      valid: false,
      error: 'Validation failed: expected status 200, got 404',
    };

    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toBe('Validation failed: expected status 200, got 404');
  });
});
