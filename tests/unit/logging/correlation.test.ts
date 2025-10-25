/**
 * Unit tests for Correlation ID generation and management
 *
 * Tests UUID v4 generation, validation, extraction, and context management.
 * Covers FR-036: UUID v4 for traceability across services
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateCorrelationId,
  isValidCorrelationId,
  extractOrGenerateCorrelationId,
  CorrelationContext,
} from '../../../src/logging/correlation.js';

describe('Correlation ID Utilities', () => {
  describe('generateCorrelationId()', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateCorrelationId();

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate unique IDs across multiple calls', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCorrelationId());
      }

      expect(ids.size).toBe(100);
    });

    it('should generate IDs matching UUID v4 pattern', () => {
      const id = generateCorrelationId();
      const uuidv4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidv4Pattern);
    });
  });

  describe('isValidCorrelationId()', () => {
    it('should validate correct UUID v4 format', () => {
      const validIds = [
        '550e8400-e29b-41d4-a716-446655440000', // v4: has 4 in position 15
        'f47ac10b-58cc-4372-a567-0e02b2c3d479', // v4: has 4 in position 15
        '123e4567-e89b-42d3-a456-426614174000', // v4: has 4 in position 15
      ];

      for (const id of validIds) {
        expect(isValidCorrelationId(id)).toBe(true);
      }
    });

    it('should reject invalid UUID formats', () => {
      const invalidIds = [
        'not-a-uuid',
        '12345678-1234-1234-1234-123456789012', // Not v4 (missing 4)
        '550e8400-e29b-11d4-a716-446655440000', // Not v4 (1 instead of 4)
        '550e8400e29b41d4a716446655440000', // Missing hyphens
        '550e8400-e29b-41d4-a716', // Too short
        '',
        'abc',
        '00000000-0000-0000-0000-000000000000',
      ];

      for (const id of invalidIds) {
        expect(isValidCorrelationId(id)).toBe(false);
      }
    });

    it('should handle case-insensitive UUID v4', () => {
      const id = '550E8400-E29B-41D4-A716-446655440000';
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should reject UUIDs with wrong version', () => {
      // UUID v1 (time-based) - has 1 in version position, should be rejected
      expect(isValidCorrelationId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false);
      // UUID v3 (MD5 hash) - has 3 in version position, should be rejected
      expect(isValidCorrelationId('6ba7b810-9dad-31d1-80b4-00c04fd430c8')).toBe(false);
      // UUID v5 (SHA-1 hash) - has 5 in version position, should be rejected
      expect(isValidCorrelationId('6ba7b810-9dad-51d1-80b4-00c04fd430c8')).toBe(false);
    });
  });

  describe('extractOrGenerateCorrelationId()', () => {
    it('should extract correlationId from source object', () => {
      const existingId = generateCorrelationId();
      const source = { correlationId: existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should extract correlation_id (snake_case)', () => {
      const existingId = generateCorrelationId();
      const source = { correlation_id: existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should extract x-correlation-id header', () => {
      const existingId = generateCorrelationId();
      const source = { 'x-correlation-id': existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should extract x-request-id header', () => {
      const existingId = generateCorrelationId();
      const source = { 'x-request-id': existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should extract requestId', () => {
      const existingId = generateCorrelationId();
      const source = { requestId: existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should extract request_id', () => {
      const existingId = generateCorrelationId();
      const source = { request_id: existingId };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(existingId);
    });

    it('should generate new ID when source is undefined', () => {
      const result = extractOrGenerateCorrelationId(undefined);

      expect(isValidCorrelationId(result)).toBe(true);
    });

    it('should generate new ID when source has no correlation ID', () => {
      const source = { someOtherField: 'value' };

      const result = extractOrGenerateCorrelationId(source);

      expect(isValidCorrelationId(result)).toBe(true);
    });

    it('should generate new ID when correlation ID is invalid', () => {
      const source = { correlationId: 'not-a-valid-uuid' };

      const result = extractOrGenerateCorrelationId(source);

      expect(isValidCorrelationId(result)).toBe(true);
      expect(result).not.toBe('not-a-valid-uuid');
    });

    it('should generate new ID when correlation ID is not a string', () => {
      const source = { correlationId: 12345 };

      const result = extractOrGenerateCorrelationId(source);

      expect(isValidCorrelationId(result)).toBe(true);
    });

    it('should prioritize correlationId over other fields', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      const source = {
        correlationId: id1,
        'x-correlation-id': id2,
      };

      const result = extractOrGenerateCorrelationId(source);

      expect(result).toBe(id1);
    });
  });

  describe('CorrelationContext', () => {
    beforeEach(() => {
      CorrelationContext.clear();
    });

    afterEach(() => {
      CorrelationContext.clear();
    });

    describe('create()', () => {
      it('should create context with provided correlation ID', () => {
        const id = generateCorrelationId();
        const context = CorrelationContext.create(id);

        expect(typeof context).toBe('symbol');
        expect(CorrelationContext.get(context)).toBe(id);
      });

      it('should create context with generated ID if not provided', () => {
        const context = CorrelationContext.create();

        const id = CorrelationContext.get(context);
        expect(id).toBeDefined();
        expect(isValidCorrelationId(id!)).toBe(true);
      });

      it('should create unique context symbols', () => {
        const context1 = CorrelationContext.create();
        const context2 = CorrelationContext.create();

        expect(context1).not.toBe(context2);
      });
    });

    describe('get()', () => {
      it('should retrieve correlation ID from context', () => {
        const id = generateCorrelationId();
        const context = CorrelationContext.create(id);

        const retrieved = CorrelationContext.get(context);

        expect(retrieved).toBe(id);
      });

      it('should return undefined for non-existent context', () => {
        const fakeContext = Symbol('fake');

        const result = CorrelationContext.get(fakeContext);

        expect(result).toBeUndefined();
      });
    });

    describe('delete()', () => {
      it('should delete correlation context', () => {
        const id = generateCorrelationId();
        const context = CorrelationContext.create(id);

        expect(CorrelationContext.get(context)).toBe(id);

        CorrelationContext.delete(context);

        expect(CorrelationContext.get(context)).toBeUndefined();
      });

      it('should not throw when deleting non-existent context', () => {
        const fakeContext = Symbol('fake');

        expect(() => CorrelationContext.delete(fakeContext)).not.toThrow();
      });
    });

    describe('clear()', () => {
      it('should clear all correlation contexts', () => {
        const context1 = CorrelationContext.create();
        const context2 = CorrelationContext.create();

        expect(CorrelationContext.get(context1)).toBeDefined();
        expect(CorrelationContext.get(context2)).toBeDefined();

        CorrelationContext.clear();

        expect(CorrelationContext.get(context1)).toBeUndefined();
        expect(CorrelationContext.get(context2)).toBeUndefined();
      });

      it('should allow creating new contexts after clear', () => {
        CorrelationContext.create();
        CorrelationContext.clear();

        const context2 = CorrelationContext.create();

        expect(CorrelationContext.get(context2)).toBeDefined();
      });
    });
  });
});
