/**
 * Response validation implementation
 * T027: Implement response validation logic
 *
 * Validation functions for health check responses:
 * - Status code validation (match expected)
 * - Response text validation (case-sensitive substring, first 100KB)
 * - Response header validation (case-insensitive name, case-sensitive value)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates HTTP status code against expected value(s)
 * @param actualStatus Actual HTTP status code received
 * @param expectedStatus Expected status code (single number or array of acceptable codes)
 * @returns ValidationResult with status and error message
 */
export function validateStatusCode(
  actualStatus: number,
  expectedStatus: number | number[]
): ValidationResult {
  const isValid = typeof expectedStatus === 'number'
    ? actualStatus === expectedStatus
    : expectedStatus.includes(actualStatus);

  return {
    valid: isValid,
    error: isValid ? undefined :
      `Expected status ${Array.isArray(expectedStatus) ?
        expectedStatus.join(' or ') : expectedStatus}, got ${actualStatus}`
  };
}

/**
 * Validates that expected text is found in response body
 * Uses case-sensitive substring matching
 * Per FR-014: Searches first 100KB of response (handled by caller)
 *
 * @param responseBody Response body text to search
 * @param expectedText Expected substring to find
 * @returns ValidationResult with status and error message
 */
export function validateResponseText(
  responseBody: string,
  expectedText: string
): ValidationResult {
  const isValid = responseBody.includes(expectedText);

  return {
    valid: isValid,
    error: isValid ? undefined : `Expected text '${expectedText}' not found in response body`
  };
}

/**
 * Validates response headers against expected values
 * Uses case-insensitive header name matching and case-sensitive value matching
 * Per FR-004a: Supports redirect validation via Location header
 *
 * @param headers Response headers
 * @param expectedHeaders Expected header values (key = header name, value = expected value)
 * @returns ValidationResult with combined status and error message
 */
export function validateResponseHeaders(
  headers: Headers,
  expectedHeaders: Record<string, string>
): ValidationResult {
  const failures: string[] = [];

  for (const [expectedName, expectedValue] of Object.entries(expectedHeaders)) {
    // Case-insensitive header name matching
    const actualValue = getHeaderCaseInsensitive(headers, expectedName);

    // Case-sensitive value matching
    if (actualValue !== expectedValue) {
      if (actualValue === null) {
        failures.push(`Header '${expectedName}' not found (expected '${expectedValue}')`);
      } else {
        failures.push(`Expected header '${expectedName}: ${expectedValue}', got '${actualValue}'`);
      }
    }
  }

  return {
    valid: failures.length === 0,
    error: failures.length > 0 ? failures.join('; ') : undefined
  };
}

/**
 * Gets header value using case-insensitive name matching
 * Headers API in Node.js/browsers is case-insensitive, but this ensures compatibility
 *
 * @param headers Response headers
 * @param headerName Header name to search for (case-insensitive)
 * @returns Header value if found, null otherwise
 */
function getHeaderCaseInsensitive(headers: Headers, headerName: string): string | null {
  // Try direct access first (Headers API is case-insensitive)
  const directValue = headers.get(headerName);
  if (directValue !== null) {
    return directValue;
  }

  // Fallback: iterate through all headers with case-insensitive comparison
  const lowerName = headerName.toLowerCase();
  for (const [name, value] of headers.entries()) {
    if (name.toLowerCase() === lowerName) {
      return value;
    }
  }

  return null;
}
