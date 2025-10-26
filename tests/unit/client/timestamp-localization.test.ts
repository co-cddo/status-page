/**
 * Unit tests for timestamp localization utilities
 *
 * Tests ISO 8601 UTC timestamp conversion to browser local timezone
 * and relative time formatting (progressive enhancement).
 *
 * Requirements:
 * - Issue #30: Localized timestamp display
 * - Progressive enhancement (works without JavaScript)
 * - WCAG 2.2 AAA accessible
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatLocalTimestamp,
  formatRelativeTime,
  getOriginalUTCString,
  updateTimestamp,
  addRelativeTime,
} from '../../../assets/js/timestamp-localization.ts';

describe('Timestamp Localization', () => {
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // Mock current time for consistent testing
    originalDateNow = Date.now;
    const mockNow = new Date('2025-10-26T15:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  });

  afterEach(() => {
    Date.now = originalDateNow;
    vi.restoreAllMocks();
  });

  describe('formatLocalTimestamp', () => {
    it('should convert ISO 8601 UTC timestamp to local date string', () => {
      const utcTimestamp = '2025-10-26T14:30:00Z';
      const result = formatLocalTimestamp(utcTimestamp);

      // Should return a formatted date string in browser timezone
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle invalid timestamp gracefully', () => {
      const invalidTimestamp = 'not-a-timestamp';
      const result = formatLocalTimestamp(invalidTimestamp);

      // Should return the original value or a fallback
      expect(result).toBeDefined();
    });

    it('should handle null or undefined timestamps', () => {
      expect(formatLocalTimestamp(null)).toBe('');
      expect(formatLocalTimestamp(undefined)).toBe('');
    });

    it('should preserve timezone information in ISO 8601 format', () => {
      const utcTimestamp = '2025-10-26T14:30:00Z';
      const parsed = new Date(utcTimestamp);

      // Verify timestamp is correctly parsed as UTC
      // Note: toISOString() may add milliseconds (.000Z)
      expect(parsed.toISOString()).toMatch(/^2025-10-26T14:30:00(\.\d{3})?Z$/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent timestamps as "just now"', () => {
      // Current time: 2025-10-26T15:00:00Z
      const recentTimestamp = '2025-10-26T14:59:45Z'; // 15 seconds ago
      const result = formatRelativeTime(recentTimestamp);

      expect(result).toBe('just now');
    });

    it('should format timestamps within last minute as "X seconds ago"', () => {
      const timestamp = '2025-10-26T14:59:30Z'; // 30 seconds ago
      const result = formatRelativeTime(timestamp);

      expect(result).toMatch(/\d+ seconds? ago|30 seconds ago/);
    });

    it('should format timestamps within last hour as "X minutes ago"', () => {
      const timestamp = '2025-10-26T14:45:00Z'; // 15 minutes ago
      const result = formatRelativeTime(timestamp);

      expect(result).toBe('15 minutes ago');
    });

    it('should format single minute correctly', () => {
      const timestamp = '2025-10-26T14:59:00Z'; // 1 minute ago
      const result = formatRelativeTime(timestamp);

      expect(result).toMatch(/1 minute ago|just now/);
    });

    it('should format timestamps within last day as "X hours ago"', () => {
      const timestamp = '2025-10-26T12:00:00Z'; // 3 hours ago
      const result = formatRelativeTime(timestamp);

      expect(result).toBe('3 hours ago');
    });

    it('should format single hour correctly', () => {
      const timestamp = '2025-10-26T14:00:00Z'; // 1 hour ago
      const result = formatRelativeTime(timestamp);

      expect(result).toBe('1 hour ago');
    });

    it('should format timestamps within last week as "X days ago"', () => {
      const timestamp = '2025-10-24T15:00:00Z'; // 2 days ago
      const result = formatRelativeTime(timestamp);

      expect(result).toBe('2 days ago');
    });

    it('should format single day correctly', () => {
      const timestamp = '2025-10-25T15:00:00Z'; // 1 day ago
      const result = formatRelativeTime(timestamp);

      expect(result).toBe('1 day ago');
    });

    it('should format older timestamps as absolute date', () => {
      const timestamp = '2025-10-10T15:00:00Z'; // 16 days ago
      const result = formatRelativeTime(timestamp);

      // Should return formatted date instead of relative time
      expect(result).toBeDefined();
      expect(result).not.toMatch(/ago/);
    });

    it('should handle invalid timestamps gracefully', () => {
      const invalidTimestamp = 'invalid-date';
      const result = formatRelativeTime(invalidTimestamp);

      expect(result).toBeDefined();
    });

    it('should handle null or undefined timestamps', () => {
      expect(formatRelativeTime(null)).toBe('');
      expect(formatRelativeTime(undefined)).toBe('');
    });

    it('should handle future timestamps', () => {
      const futureTimestamp = '2025-10-27T15:00:00Z'; // 1 day in future
      const result = formatRelativeTime(futureTimestamp);

      // Should indicate it's in the future or show as "just now"
      expect(result).toBeDefined();
    });
  });

  describe('getOriginalUTCString', () => {
    it('should return formatted UTC string for tooltip', () => {
      const utcTimestamp = '2025-10-26T14:30:00Z';
      const result = getOriginalUTCString(utcTimestamp);

      expect(result).toBeDefined();
      expect(result).toMatch(/UTC/i);
    });

    it('should handle invalid timestamps', () => {
      const invalidTimestamp = 'not-a-date';
      const result = getOriginalUTCString(invalidTimestamp);

      expect(result).toBeDefined();
    });

    it('should handle null or undefined', () => {
      expect(getOriginalUTCString(null)).toBe('');
      expect(getOriginalUTCString(undefined)).toBe('');
    });
  });

  describe('updateTimestamp', () => {
    it('should update element text with localized time', () => {
      const element = document.createElement('time');
      element.setAttribute('datetime', '2025-10-26T14:30:00Z');
      element.textContent = '2025-10-26T14:30:00Z';

      updateTimestamp(element);

      // Element should be updated with formatted time
      expect(element.textContent).not.toBe('2025-10-26T14:30:00Z');
      expect(element.textContent).toBeDefined();
    });

    it('should add title attribute with original UTC time', () => {
      const element = document.createElement('time');
      element.setAttribute('datetime', '2025-10-26T14:30:00Z');

      updateTimestamp(element);

      // Element should have title for tooltip
      expect(element.getAttribute('title')).toBeDefined();
      expect(element.getAttribute('title')).toMatch(/UTC/i);
    });

    it('should preserve datetime attribute', () => {
      const element = document.createElement('time');
      const originalDatetime = '2025-10-26T14:30:00Z';
      element.setAttribute('datetime', originalDatetime);

      updateTimestamp(element);

      // datetime attribute should remain unchanged (machine-readable)
      expect(element.getAttribute('datetime')).toBe(originalDatetime);
    });

    it('should handle elements without datetime attribute', () => {
      const element = document.createElement('time');
      element.textContent = '2025-10-26T14:30:00Z';

      // Should not throw error
      expect(() => updateTimestamp(element)).not.toThrow();
    });
  });

  describe('addRelativeTime', () => {
    it('should add relative time after absolute time', () => {
      // Create a container to properly test DOM manipulation
      const container = document.createElement('div');
      document.body.appendChild(container);

      const element = document.createElement('time');
      element.setAttribute('datetime', '2025-10-26T14:45:00Z');
      element.textContent = '26 October 2025, 2:45pm';
      container.appendChild(element);

      addRelativeTime(element);

      // Should add relative time indicator
      const relativeElement = element.nextElementSibling;
      expect(relativeElement).toBeTruthy();
      expect(relativeElement?.textContent).toMatch(/ago|just now/);

      // Cleanup
      document.body.removeChild(container);
    });

    it('should use aria-label for relative time for screen readers', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const element = document.createElement('time');
      element.setAttribute('datetime', '2025-10-26T14:45:00Z');
      container.appendChild(element);

      addRelativeTime(element);

      const relativeElement = element.nextElementSibling;
      expect(relativeElement).toBeTruthy();
      expect(relativeElement?.hasAttribute('aria-label')).toBe(true);

      // Cleanup
      document.body.removeChild(container);
    });

    it('should update relative time periodically', () => {
      const element = document.createElement('time');
      element.setAttribute('datetime', '2025-10-26T14:59:00Z');

      addRelativeTime(element);

      // Should mark element for periodic updates
      expect(element.getAttribute('data-update-relative-time')).toBe('true');
    });
  });
});
