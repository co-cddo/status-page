/**
 * Text validation tests including inverse pattern support
 * Tests for validateResponseText function with positive and inverse patterns
 */

import { describe, it, expect } from 'vitest';
import { validateResponseText } from '../../../src/health-checks/validation.ts';

describe('validateResponseText', () => {
  describe('Positive patterns (text must be present)', () => {
    it('should pass when expected text is found', () => {
      const body = 'Apply for your first provisional driving licence on GOV.UK';
      const result = validateResponseText(body, 'Apply for');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when expected text is not found', () => {
      const body = 'Welcome to GOV.UK';
      const result = validateResponseText(body, 'Apply for');

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Expected text 'Apply for' not found in response body");
    });

    it('should be case-sensitive', () => {
      const body = 'APPLY FOR YOUR LICENCE';
      const result = validateResponseText(body, 'Apply for');

      expect(result.valid).toBe(false);
    });

    it('should search only first 100KB', () => {
      // Create a body larger than 100KB
      const largePart = 'x'.repeat(101 * 1024);
      const body = largePart + 'Apply for';
      const result = validateResponseText(body, 'Apply for');

      // Text is beyond 100KB, so should not be found
      expect(result.valid).toBe(false);
    });
  });

  describe('Inverse patterns (text must NOT be present)', () => {
    it('should pass when forbidden text is not found', () => {
      const body = 'Welcome to the service. Everything is working correctly.';
      const result = validateResponseText(body, "!We're sorry");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when forbidden text is found', () => {
      const body = "We're sorry, there is a problem with our service";
      const result = validateResponseText(body, "!We're sorry");

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Found forbidden text 'We're sorry' in response body (inverse pattern validation failed)"
      );
    });

    it('should detect error pages with "unavailable"', () => {
      const body = 'Sorry, this service is unavailable';
      const result = validateResponseText(body, '!unavailable');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('unavailable');
    });

    it('should detect error pages with "ERROR_404"', () => {
      const body = '<h1>ERROR_404</h1><p>Page not found</p>';
      const result = validateResponseText(body, '!ERROR_404');

      expect(result.valid).toBe(false);
    });

    it('should be case-sensitive for inverse patterns', () => {
      const body = "WE'RE SORRY, THERE IS A PROBLEM";
      const result = validateResponseText(body, "!We're sorry");

      // Should pass because case doesn't match
      expect(result.valid).toBe(true);
    });

    it('should search only first 100KB for inverse patterns', () => {
      // Create a body larger than 100KB with error text beyond limit
      const largePart = 'x'.repeat(101 * 1024);
      const body = largePart + "We're sorry";
      const result = validateResponseText(body, "!We're sorry");

      // Error text is beyond 100KB, so should pass
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response body', () => {
      const result = validateResponseText('', 'Apply for');
      expect(result.valid).toBe(false);
    });

    it('should handle empty expected text', () => {
      const result = validateResponseText('Some content', '');
      expect(result.valid).toBe(true); // Empty string is always found
    });

    it('should handle empty forbidden text (inverse)', () => {
      const result = validateResponseText('Some content', '!');
      // Empty string after ! will be found in any content, so should fail
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Found forbidden text');
    });

    it('should handle exact 100KB response', () => {
      const body = 'x'.repeat(100 * 1024);
      const result = validateResponseText(body, 'x');
      expect(result.valid).toBe(true);
    });

    it('should handle special characters in search text', () => {
      const body = '<div class="govuk-body">Apply for £100 grant</div>';
      const result = validateResponseText(body, '£100 grant');
      expect(result.valid).toBe(true);
    });

    it('should handle newlines and whitespace', () => {
      const body = 'Apply for\\nyour first\\nprovisional driving\\nlicence';
      const result = validateResponseText(body, 'Apply for\\nyour first');
      expect(result.valid).toBe(true);
    });
  });

  describe('Real-world error detection scenarios', () => {
    it('should detect "We\'re sorry" error pages', () => {
      const errorBody = `
        <title>This service is currently unavailable - Student Loans Company</title>
        <h1>We're sorry, there is a problem with our service but we're working hard to fix this</h1>
      `;
      const result = validateResponseText(errorBody, "!We're sorry");
      expect(result.valid).toBe(false);
    });

    it('should detect "Sorry, this service is" error pages', () => {
      const errorBody = `
        <title>Sorry, this service is unavailable - Personal tax account - GOV.UK</title>
        <h1>Sorry, this service is unavailable</h1>
      `;
      const result = validateResponseText(errorBody, '!Sorry, this service is');
      expect(result.valid).toBe(false);
    });

    it('should detect maintenance pages', () => {
      const maintenanceBody = '<h1>Service temporarily unavailable</h1>';
      const result = validateResponseText(maintenanceBody, '!temporarily unavailable');
      expect(result.valid).toBe(false);
    });

    it('should pass for working service pages', () => {
      const workingBody = `
        <title>Apply for a provisional driving licence - GOV.UK</title>
        <h1>Apply for your first provisional driving licence</h1>
        <p>You can start learning to drive when you're 15 years and 9 months old.</p>
      `;
      const result = validateResponseText(workingBody, '!unavailable');
      expect(result.valid).toBe(true);
    });
  });
});
