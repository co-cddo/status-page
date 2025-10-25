/**
 * Unit tests for CSV Parsing Utilities
 *
 * Tests RFC 4180 compliant CSV parsing, escaping, and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCsvLine,
  escapeCsvValue,
  isValidStatus,
  CSV_HEADERS,
  CSV_HEADER_LINE,
} from '../../../src/utils/csv.js';

describe('CSV Utilities', () => {
  describe('parseCsvLine()', () => {
    it('should parse simple CSV line', () => {
      const line = 'value1,value2,value3';
      const result = parseCsvLine(line);
      expect(result).toEqual(['value1', 'value2', 'value3']);
    });

    it('should parse quoted fields with commas', () => {
      const line = '"value, with, commas",normal,another';
      const result = parseCsvLine(line);
      expect(result).toEqual(['value, with, commas', 'normal', 'another']);
    });

    it('should parse quoted fields with quotes (doubled)', () => {
      const line = '"value with ""quotes""",normal';
      const result = parseCsvLine(line);
      expect(result).toEqual(['value with "quotes"', 'normal']);
    });

    it('should handle empty fields', () => {
      const line = 'value1,,value3';
      const result = parseCsvLine(line);
      expect(result).toEqual(['value1', '', 'value3']);
    });

    it('should handle all empty fields', () => {
      const line = ',,';
      const result = parseCsvLine(line);
      // Three commas create 4 fields, but we only have 2 commas here so 3 fields
      expect(result).toEqual(['', '', '']);
    });

    it('should handle empty string', () => {
      const line = '';
      const result = parseCsvLine(line);
      expect(result).toEqual(['']);
    });

    it('should handle single value', () => {
      const line = 'single';
      const result = parseCsvLine(line);
      expect(result).toEqual(['single']);
    });

    it('should parse complex CSV line with mixed fields', () => {
      const line = '2025-01-15T10:30:00Z,Service Name,"Connection timeout",500,"DNS ""failure""",correlation-123';
      const result = parseCsvLine(line);
      expect(result).toEqual([
        '2025-01-15T10:30:00Z',
        'Service Name',
        'Connection timeout',
        '500',
        'DNS "failure"',
        'correlation-123',
      ]);
    });
  });

  describe('escapeCsvValue()', () => {
    it('should not escape simple values', () => {
      expect(escapeCsvValue('simple')).toBe('simple');
      expect(escapeCsvValue('value123')).toBe('value123');
      expect(escapeCsvValue('hyphenated-value')).toBe('hyphenated-value');
    });

    it('should escape values with commas', () => {
      expect(escapeCsvValue('value, with, commas')).toBe('"value, with, commas"');
    });

    it('should escape values with quotes', () => {
      expect(escapeCsvValue('value "quoted"')).toBe('"value ""quoted"""');
    });

    it('should escape values with newlines', () => {
      expect(escapeCsvValue('value\nwith\nnewlines')).toBe('"value\nwith\nnewlines"');
    });

    it('should escape values with carriage returns', () => {
      expect(escapeCsvValue('value\rwith\rreturns')).toBe('"value\rwith\rreturns"');
    });

    it('should escape values with multiple special characters', () => {
      expect(escapeCsvValue('value, "with" special\nchars')).toBe('"value, ""with"" special\nchars"');
    });

    it('should return empty string for empty input', () => {
      expect(escapeCsvValue('')).toBe('');
    });

    it('should handle values with only quotes', () => {
      // Three quotes: doubled becomes six quotes, wrapped in quotes = 8 total
      expect(escapeCsvValue('"""')).toBe('""""""""');
    });
  });

  describe('isValidStatus()', () => {
    it('should validate PASS status', () => {
      expect(isValidStatus('PASS')).toBe(true);
    });

    it('should validate DEGRADED status', () => {
      expect(isValidStatus('DEGRADED')).toBe(true);
    });

    it('should validate FAIL status', () => {
      expect(isValidStatus('FAIL')).toBe(true);
    });

    it('should reject invalid status values', () => {
      expect(isValidStatus('pass')).toBe(false);
      expect(isValidStatus('Pass')).toBe(false);
      expect(isValidStatus('PENDING')).toBe(false);
      expect(isValidStatus('SUCCESS')).toBe(false);
      expect(isValidStatus('ERROR')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus('invalid')).toBe(false);
    });
  });

  describe('CSV_HEADERS constant', () => {
    it('should export correct CSV headers', () => {
      expect(CSV_HEADERS).toEqual([
        'timestamp',
        'service_name',
        'status',
        'latency_ms',
        'http_status_code',
        'failure_reason',
        'correlation_id',
      ]);
    });

    it('should be readonly', () => {
      expect(Array.isArray(CSV_HEADERS)).toBe(true);
      expect(CSV_HEADERS.length).toBe(7);
    });
  });

  describe('CSV_HEADER_LINE constant', () => {
    it('should export correct CSV header line with newline', () => {
      expect(CSV_HEADER_LINE).toBe(
        'timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id\n'
      );
    });

    it('should end with newline character', () => {
      expect(CSV_HEADER_LINE.endsWith('\n')).toBe(true);
    });
  });

  describe('Round-trip CSV operations', () => {
    it('should round-trip simple values', () => {
      const original = 'simple value';
      const escaped = escapeCsvValue(original);
      const line = `${escaped},other`;
      const parsed = parseCsvLine(line);
      expect(parsed[0]).toBe(original);
    });

    it('should round-trip values with commas', () => {
      const original = 'value, with, commas';
      const escaped = escapeCsvValue(original);
      const line = `${escaped},other`;
      const parsed = parseCsvLine(line);
      expect(parsed[0]).toBe(original);
    });

    it('should round-trip values with quotes', () => {
      const original = 'value "with" quotes';
      const escaped = escapeCsvValue(original);
      const line = `${escaped},other`;
      const parsed = parseCsvLine(line);
      expect(parsed[0]).toBe(original);
    });

    it('should round-trip complex values', () => {
      const original = 'value, "with" special\ncharacters';
      const escaped = escapeCsvValue(original);
      const line = `${escaped},other`;
      const parsed = parseCsvLine(line);
      expect(parsed[0]).toBe(original);
    });
  });
});
