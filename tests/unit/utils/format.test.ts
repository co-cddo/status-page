/**
 * Unit tests for formatting utilities
 * Tests: src/utils/format.ts
 */

import { describe, it, expect } from 'vitest';
import { formatLatency, formatTimestamp } from '@/utils/format';

describe('formatLatency', () => {
  describe('Valid millisecond values', () => {
    it('should format values under 1000ms as milliseconds', () => {
      expect(formatLatency(150)).toBe('150 ms');
    });

    it('should format 0ms correctly', () => {
      expect(formatLatency(0)).toBe('0 ms');
    });

    it('should format 1ms correctly', () => {
      expect(formatLatency(1)).toBe('1 ms');
    });

    it('should format 999ms correctly', () => {
      expect(formatLatency(999)).toBe('999 ms');
    });

    it('should format decimal milliseconds correctly', () => {
      expect(formatLatency(150.5)).toBe('150.5 ms');
    });
  });

  describe('Values >= 1000ms (seconds)', () => {
    it('should format 1000ms as 1.0 s', () => {
      expect(formatLatency(1000)).toBe('1.0 s');
    });

    it('should format 1500ms as 1.5 s', () => {
      expect(formatLatency(1500)).toBe('1.5 s');
    });

    it('should format 3500ms as 3.5 s', () => {
      expect(formatLatency(3500)).toBe('3.5 s');
    });

    it('should format 10000ms as 10.0 s', () => {
      expect(formatLatency(10000)).toBe('10.0 s');
    });

    it('should format with one decimal place', () => {
      expect(formatLatency(1234)).toBe('1.2 s');
    });

    it('should round to one decimal place', () => {
      expect(formatLatency(1567)).toBe('1.6 s');
    });

    it('should handle large values', () => {
      expect(formatLatency(60000)).toBe('60.0 s');
    });

    it('should handle very large values', () => {
      expect(formatLatency(120000)).toBe('120.0 s');
    });
  });

  describe('Invalid values', () => {
    it('should return N/A for negative values', () => {
      expect(formatLatency(-1)).toBe('N/A');
    });

    it('should return N/A for negative milliseconds', () => {
      expect(formatLatency(-100)).toBe('N/A');
    });

    it('should return N/A for Infinity', () => {
      expect(formatLatency(Infinity)).toBe('N/A');
    });

    it('should return N/A for -Infinity', () => {
      expect(formatLatency(-Infinity)).toBe('N/A');
    });

    it('should return N/A for NaN', () => {
      expect(formatLatency(NaN)).toBe('N/A');
    });

    it('should return N/A for non-number types (string)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatLatency('150')).toBe('N/A');
    });

    it('should return N/A for non-number types (null)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatLatency(null)).toBe('N/A');
    });

    it('should return N/A for non-number types (undefined)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatLatency(undefined)).toBe('N/A');
    });

    it('should return N/A for non-number types (object)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatLatency({})).toBe('N/A');
    });

    it('should return N/A for non-number types (array)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatLatency([150])).toBe('N/A');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small positive values', () => {
      expect(formatLatency(0.1)).toBe('0.1 ms');
    });

    it('should handle boundary at 1000ms', () => {
      expect(formatLatency(999.9)).toBe('999.9 ms');
      expect(formatLatency(1000)).toBe('1.0 s');
      expect(formatLatency(1000.1)).toBe('1.0 s');
    });

    it('should handle Number.MAX_SAFE_INTEGER', () => {
      const result = formatLatency(Number.MAX_SAFE_INTEGER);
      expect(result).toContain(' s');
      expect(result).not.toBe('N/A');
    });

    it('should handle extremely small decimals', () => {
      expect(formatLatency(0.001)).toBe('0.001 ms');
    });
  });
});

describe('formatTimestamp', () => {
  describe('Valid Date objects', () => {
    it('should format Date object to ISO string', () => {
      const date = new Date('2025-10-22T20:45:00.000Z');
      expect(formatTimestamp(date)).toBe('2025-10-22T20:45:00.000Z');
    });

    it('should format current date correctly', () => {
      const now = new Date();
      const result = formatTimestamp(now);
      expect(result).toBe(now.toISOString());
    });

    it('should format date with milliseconds', () => {
      const date = new Date('2025-10-22T20:45:00.123Z');
      expect(formatTimestamp(date)).toBe('2025-10-22T20:45:00.123Z');
    });

    it('should format historical dates', () => {
      const date = new Date('2000-01-01T00:00:00.000Z');
      expect(formatTimestamp(date)).toBe('2000-01-01T00:00:00.000Z');
    });

    it('should format future dates', () => {
      const date = new Date('2030-12-31T23:59:59.999Z');
      expect(formatTimestamp(date)).toBe('2030-12-31T23:59:59.999Z');
    });
  });

  describe('Valid ISO 8601 string inputs', () => {
    it('should format ISO string with full precision', () => {
      expect(formatTimestamp('2025-10-22T20:45:00.000Z')).toBe('2025-10-22T20:45:00.000Z');
    });

    it('should format ISO string without milliseconds', () => {
      expect(formatTimestamp('2025-10-22T20:45:00Z')).toBe('2025-10-22T20:45:00.000Z');
    });

    it('should format ISO string with timezone offset', () => {
      const result = formatTimestamp('2025-10-22T20:45:00+01:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should format partial ISO string', () => {
      const result = formatTimestamp('2025-10-22');
      expect(result).toMatch(/^2025-10-22T00:00:00\.000Z$/);
    });
  });

  describe('Invalid inputs', () => {
    it('should return "Invalid Date" for invalid date string', () => {
      expect(formatTimestamp('not a date')).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for empty string', () => {
      expect(formatTimestamp('')).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for invalid Date object', () => {
      const invalidDate = new Date('invalid');
      expect(formatTimestamp(invalidDate)).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for non-date types (number)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp(12345)).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for non-date types (null)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp(null)).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for non-date types (undefined)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp(undefined)).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for non-date types (object)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp({})).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for non-date types (array)', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp([])).toBe('Invalid Date');
    });

    it('should return "Invalid Date" for boolean', () => {
      // @ts-expect-error - Testing runtime validation
      expect(formatTimestamp(true)).toBe('Invalid Date');
    });
  });

  describe('Edge cases', () => {
    it('should handle Unix epoch', () => {
      const date = new Date(0);
      expect(formatTimestamp(date)).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle date at max safe timestamp', () => {
      const date = new Date(8640000000000000); // Max Date value
      const result = formatTimestamp(date);
      // Max date has 6-digit year with + prefix
      expect(result).toMatch(/^[+-]\d{6}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle date at min safe timestamp', () => {
      const date = new Date(-8640000000000000); // Min Date value
      const result = formatTimestamp(date);
      expect(result).toMatch(/^-\d{6}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle malformed ISO string', () => {
      expect(formatTimestamp('2025-13-45T99:99:99Z')).toBe('Invalid Date');
    });

    it('should handle string with extra whitespace', () => {
      expect(formatTimestamp('  2025-10-22T20:45:00Z  ')).toBe('Invalid Date');
    });

    it('should handle date string in different format', () => {
      const result = formatTimestamp('Oct 22, 2025');
      // Date parsing depends on timezone - just verify it's a valid ISO string
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // Verify it parsed to a date in October 2025
      const parsed = new Date(result);
      expect(parsed.getUTCFullYear()).toBe(2025);
      expect(parsed.getUTCMonth()).toBe(9); // October is month 9 (0-indexed)
    });

    it('should catch exceptions and return "Invalid Date"', () => {
      // Test with an object that throws during property access
      const throwingObject = {
        get [Symbol.toPrimitive]() {
          throw new Error('Symbol.toPrimitive error');
        },
        toString() {
          throw new Error('toString error');
        },
        valueOf() {
          throw new Error('valueOf error');
        }
      };

      // @ts-expect-error - Testing runtime validation with throwing object
      const result = formatTimestamp(throwingObject);
      expect(result).toBe('Invalid Date');
    });

    it('should catch toISOString exceptions', () => {
      // Create a Date object that throws on toISOString
      const badDate = new Date('2025-10-22');
      badDate.toISOString = () => {
        throw new Error('toISOString error');
      };

      const result = formatTimestamp(badDate);
      expect(result).toBe('Invalid Date');
    });
  });
});
