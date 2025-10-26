/**
 * Unit tests for string utilities
 * Tests: src/utils/string.ts
 */

import { describe, it, expect } from 'vitest';
import { escapeMarkdown, truncate } from '@/utils/string.js';

describe('escapeMarkdown', () => {
  describe('Valid string inputs', () => {
    it('should escape pipe characters', () => {
      expect(escapeMarkdown('Service | Name')).toBe('Service \\| Name');
    });

    it('should escape asterisks', () => {
      expect(escapeMarkdown('bold *text*')).toBe('bold \\*text\\*');
    });

    it('should escape underscores', () => {
      expect(escapeMarkdown('italic _text_')).toBe('italic \\_text\\_');
    });

    it('should escape backticks', () => {
      expect(escapeMarkdown('code `snippet`')).toBe('code \\`snippet\\`');
    });

    it('should escape brackets', () => {
      expect(escapeMarkdown('[link text]')).toBe('\\[link text\\]');
    });

    it('should escape backslashes first', () => {
      expect(escapeMarkdown('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape multiple special characters', () => {
      expect(escapeMarkdown('Service | *Name* | [Link]')).toBe('Service \\| \\*Name\\* \\| \\[Link\\]');
    });

    it('should return same string if no special characters', () => {
      expect(escapeMarkdown('Plain text')).toBe('Plain text');
    });

    it('should handle empty string', () => {
      expect(escapeMarkdown('')).toBe('');
    });

    it('should escape complex markdown table delimiter', () => {
      expect(escapeMarkdown('col1 | col2 | col3')).toBe('col1 \\| col2 \\| col3');
    });

    it('should escape backslash-pipe combination correctly', () => {
      expect(escapeMarkdown('\\|')).toBe('\\\\\\|');
    });
  });

  describe('Invalid inputs', () => {
    it('should return empty string for null', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown(undefined)).toBe('');
    });

    it('should return empty string for number', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown(123)).toBe('');
    });

    it('should return empty string for boolean', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown(true)).toBe('');
    });

    it('should return empty string for object', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown({})).toBe('');
    });

    it('should return empty string for array', () => {
      // @ts-expect-error - Testing runtime validation
      expect(escapeMarkdown([])).toBe('');
    });
  });
});

describe('truncate', () => {
  describe('Valid string inputs', () => {
    it('should truncate long text with default max length (100)', () => {
      const longText = 'A'.repeat(150);
      const result = truncate(longText);
      expect(result).toBe('A'.repeat(97) + '...');
      expect(result.length).toBe(100);
    });

    it('should truncate text at custom max length', () => {
      const text = 'This is a very long error message that needs truncation';
      const result = truncate(text, 20);
      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncate(text, 100)).toBe('Short text');
    });

    it('should not truncate text equal to max length', () => {
      const text = 'A'.repeat(100);
      expect(truncate(text, 100)).toBe(text);
    });

    it('should handle empty string', () => {
      expect(truncate('')).toBe('');
    });

    it('should truncate text exactly at boundary', () => {
      const text = 'A'.repeat(101);
      const result = truncate(text, 100);
      expect(result).toBe('A'.repeat(97) + '...');
      expect(result.length).toBe(100);
    });

    it('should handle very short max length', () => {
      const text = 'Long text here';
      const result = truncate(text, 5);
      expect(result).toBe('Lo...');
      expect(result.length).toBe(5);
    });

    it('should preserve spaces and special characters', () => {
      const text = 'Error: Connection timeout | Service unavailable';
      const result = truncate(text, 30);
      // Text is truncated at position 27 (30 - 3 for '...')
      expect(result).toBe('Error: Connection timeout |...');
    });

    it('should handle multiline text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const result = truncate(text, 15);
      // Text is truncated at position 12 (15 - 3 for '...')
      expect(result).toBe('Line 1\nLine ...');
    });

    it('should handle text with max length of 3 (edge case)', () => {
      const text = 'Long text';
      const result = truncate(text, 3);
      expect(result).toBe('...');
      expect(result.length).toBe(3);
    });
  });

  describe('Invalid inputs', () => {
    it('should return empty string for null', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate(undefined)).toBe('');
    });

    it('should return empty string for number', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate(123)).toBe('');
    });

    it('should return empty string for boolean', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate(false)).toBe('');
    });

    it('should return empty string for object', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate({})).toBe('');
    });

    it('should return empty string for array', () => {
      // @ts-expect-error - Testing runtime validation
      expect(truncate([])).toBe('');
    });
  });

  describe('Edge cases', () => {
    it('should handle unicode characters', () => {
      const text = '🎉'.repeat(50);
      const result = truncate(text, 20);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
    });

    it('should handle text with only whitespace', () => {
      const text = ' '.repeat(150);
      const result = truncate(text, 100);
      expect(result).toBe(' '.repeat(97) + '...');
    });

    it('should handle max length larger than text', () => {
      const text = 'Short';
      expect(truncate(text, 1000)).toBe('Short');
    });
  });
});
