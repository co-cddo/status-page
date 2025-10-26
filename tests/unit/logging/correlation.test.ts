/**
 * Unit tests for Correlation ID utilities
 *
 * Tests correlation ID generation, validation, extraction, and context management
 * for distributed tracing across health checks, logs, and metrics.
 *
 * Coverage:
 * - UUID v4 generation
 * - UUID v4 format validation
 * - Correlation ID extraction from various header formats
 * - CorrelationContext static class methods
 * - Edge cases and error conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateCorrelationId,
  isValidCorrelationId,
  extractOrGenerateCorrelationId,
  CorrelationContext,
} from '../../../src/logging/correlation.js';

describe('generateCorrelationId', () => {
  it('should generate a valid UUID v4', () => {
    const id = generateCorrelationId();
    expect(isValidCorrelationId(id)).toBe(true);
  });

  it('should generate unique IDs on each call', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    const id3 = generateCorrelationId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should generate IDs with correct UUID v4 format', () => {
    const id = generateCorrelationId();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where y is one of [8, 9, a, b]
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidv4Regex);
  });

  it('should generate IDs with lowercase hexadecimal characters', () => {
    const id = generateCorrelationId();

    // UUID library generates lowercase by default
    expect(id).toMatch(/^[0-9a-f-]+$/);
  });

  it('should generate IDs with correct length (36 characters)', () => {
    const id = generateCorrelationId();
    expect(id).toHaveLength(36);
  });

  it('should have version 4 marker in correct position', () => {
    const id = generateCorrelationId();

    // 15th character (index 14) should be '4'
    expect(id[14]).toBe('4');
  });

  it('should have variant marker in correct position', () => {
    const id = generateCorrelationId();

    // 20th character (index 19) should be one of [8, 9, a, b]
    const variantChar = id[19];
    expect(['8', '9', 'a', 'b']).toContain(variantChar);
  });
});

describe('isValidCorrelationId', () => {
  describe('Valid UUID v4 formats', () => {
    it('should accept valid UUID v4 with lowercase letters', () => {
      expect(isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should accept valid UUID v4 with uppercase letters', () => {
      expect(isValidCorrelationId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should accept valid UUID v4 with mixed case', () => {
      expect(isValidCorrelationId('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('should accept UUID v4 with variant 8', () => {
      expect(isValidCorrelationId('12345678-1234-4234-8234-123456789012')).toBe(true);
    });

    it('should accept UUID v4 with variant 9', () => {
      expect(isValidCorrelationId('12345678-1234-4234-9234-123456789012')).toBe(true);
    });

    it('should accept UUID v4 with variant a', () => {
      expect(isValidCorrelationId('12345678-1234-4234-a234-123456789012')).toBe(true);
    });

    it('should accept UUID v4 with variant b', () => {
      expect(isValidCorrelationId('12345678-1234-4234-b234-123456789012')).toBe(true);
    });

    it('should accept UUID v4 with all zeros except version/variant', () => {
      expect(isValidCorrelationId('00000000-0000-4000-8000-000000000000')).toBe(true);
    });

    it('should accept UUID v4 with all fs except version/variant', () => {
      expect(isValidCorrelationId('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBe(true);
    });

    it('should accept generated UUIDs', () => {
      const id = generateCorrelationId();
      expect(isValidCorrelationId(id)).toBe(true);
    });
  });

  describe('Invalid UUID formats', () => {
    it('should reject UUID v1 (time-based)', () => {
      // Version 1 has '1' at position 14
      expect(isValidCorrelationId('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
    });

    it('should reject UUID v3 (MD5 hash)', () => {
      // Version 3 has '3' at position 14
      expect(isValidCorrelationId('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
    });

    it('should reject UUID v5 (SHA-1 hash)', () => {
      // Version 5 has '5' at position 14
      expect(isValidCorrelationId('550e8400-e29b-51d4-a716-446655440000')).toBe(false);
    });

    it('should reject UUID with invalid variant (c)', () => {
      expect(isValidCorrelationId('12345678-1234-4234-c234-123456789012')).toBe(false);
    });

    it('should reject UUID with invalid variant (d)', () => {
      expect(isValidCorrelationId('12345678-1234-4234-d234-123456789012')).toBe(false);
    });

    it('should reject UUID with invalid variant (e)', () => {
      expect(isValidCorrelationId('12345678-1234-4234-e234-123456789012')).toBe(false);
    });

    it('should reject UUID with invalid variant (f)', () => {
      expect(isValidCorrelationId('12345678-1234-4234-f234-123456789012')).toBe(false);
    });

    it('should reject UUID with invalid variant (0-7)', () => {
      expect(isValidCorrelationId('12345678-1234-4234-0234-123456789012')).toBe(false);
      expect(isValidCorrelationId('12345678-1234-4234-1234-123456789012')).toBe(false);
      expect(isValidCorrelationId('12345678-1234-4234-7234-123456789012')).toBe(false);
    });

    it('should reject non-UUID strings', () => {
      expect(isValidCorrelationId('not-a-uuid')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidCorrelationId('')).toBe(false);
    });

    it('should reject UUID without hyphens', () => {
      expect(isValidCorrelationId('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('should reject UUID with wrong hyphen positions', () => {
      expect(isValidCorrelationId('550e-8400-e29b-41d4-a716-446655440000')).toBe(false);
    });

    it('should reject UUID with too few characters', () => {
      expect(isValidCorrelationId('550e8400-e29b-41d4-a716-44665544000')).toBe(false);
    });

    it('should reject UUID with too many characters', () => {
      expect(isValidCorrelationId('550e8400-e29b-41d4-a716-4466554400000')).toBe(false);
    });

    it('should reject UUID with non-hexadecimal characters', () => {
      expect(isValidCorrelationId('550g8400-e29b-41d4-a716-446655440000')).toBe(false);
      expect(isValidCorrelationId('550e8400-e29b-41d4-a716-44665544000z')).toBe(false);
    });

    it('should reject UUID with special characters', () => {
      expect(isValidCorrelationId('550e8400-e29b-41d4-a716-446655440000!')).toBe(false);
    });

    it('should reject UUID with spaces', () => {
      expect(isValidCorrelationId('550e8400 e29b 41d4 a716 446655440000')).toBe(false);
    });

    it('should reject completely random string', () => {
      expect(isValidCorrelationId('completely-random-string-here')).toBe(false);
    });

    it('should reject numeric string', () => {
      expect(isValidCorrelationId('12345')).toBe(false);
    });
  });
});

describe('extractOrGenerateCorrelationId', () => {
  describe('Undefined/null source', () => {
    it('should generate new ID when source is undefined', () => {
      const id = extractOrGenerateCorrelationId(undefined);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate unique IDs for undefined source', () => {
      const id1 = extractOrGenerateCorrelationId(undefined);
      const id2 = extractOrGenerateCorrelationId(undefined);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Empty object source', () => {
    it('should generate new ID when source is empty object', () => {
      const id = extractOrGenerateCorrelationId({});
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate unique IDs for empty objects', () => {
      const id1 = extractOrGenerateCorrelationId({});
      const id2 = extractOrGenerateCorrelationId({});
      expect(id1).not.toBe(id2);
    });
  });

  describe('Valid correlation ID extraction', () => {
    const validId = '550e8400-e29b-41d4-a716-446655440000';

    it('should extract from correlationId property', () => {
      const source = { correlationId: validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should extract from correlation_id property', () => {
      const source = { correlation_id: validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should extract from x-correlation-id property', () => {
      const source = { 'x-correlation-id': validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should extract from x-request-id property', () => {
      const source = { 'x-request-id': validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should extract from requestId property', () => {
      const source = { requestId: validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should extract from request_id property', () => {
      const source = { request_id: validId };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should accept uppercase UUID', () => {
      const uppercaseId = validId.toUpperCase();
      const source = { correlationId: uppercaseId };
      expect(extractOrGenerateCorrelationId(source)).toBe(uppercaseId);
    });

    it('should accept mixed case UUID', () => {
      const mixedCaseId = '550e8400-E29B-41d4-A716-446655440000';
      const source = { correlationId: mixedCaseId };
      expect(extractOrGenerateCorrelationId(source)).toBe(mixedCaseId);
    });
  });

  describe('Header name priority', () => {
    const id1 = '11111111-1111-4111-8111-111111111111';
    const id2 = '22222222-2222-4222-8222-222222222222';
    const id3 = '33333333-3333-4333-8333-333333333333';

    it('should prioritize correlationId over other headers', () => {
      const source = {
        correlationId: id1,
        correlation_id: id2,
        'x-correlation-id': id3,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });

    it('should use correlation_id if correlationId not present', () => {
      const source = {
        correlation_id: id1,
        'x-correlation-id': id2,
        'x-request-id': id3,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });

    it('should use x-correlation-id if earlier headers not present', () => {
      const source = {
        'x-correlation-id': id1,
        'x-request-id': id2,
        requestId: id3,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });

    it('should use x-request-id if earlier headers not present', () => {
      const source = {
        'x-request-id': id1,
        requestId: id2,
        request_id: id3,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });

    it('should use requestId if earlier headers not present', () => {
      const source = {
        requestId: id1,
        request_id: id2,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });

    it('should use request_id if earlier headers not present', () => {
      const source = {
        request_id: id1,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(id1);
    });
  });

  describe('Invalid correlation ID handling', () => {
    it('should generate new ID when value is not a UUID', () => {
      const source = { correlationId: 'not-a-uuid' };
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
      expect(id).not.toBe('not-a-uuid');
    });

    it('should generate new ID when value is empty string', () => {
      const source = { correlationId: '' };
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is UUID v1', () => {
      const source = { correlationId: '550e8400-e29b-11d4-a716-446655440000' };
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
      expect(id).not.toBe(source.correlationId);
    });

    it('should generate new ID when value is wrong variant', () => {
      const source = { correlationId: '12345678-1234-4234-c234-123456789012' };
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
      expect(id).not.toBe(source.correlationId);
    });
  });

  describe('Non-string value handling', () => {
    it('should generate new ID when value is number', () => {
      const source = { correlationId: 12345 } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is boolean', () => {
      const source = { correlationId: true } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is null', () => {
      const source = { correlationId: null } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is object', () => {
      const source = { correlationId: { nested: 'value' } } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is array', () => {
      const source = { correlationId: ['array', 'values'] } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    it('should generate new ID when value is undefined', () => {
      const source = { correlationId: undefined } as Record<string, unknown>;
      const id = extractOrGenerateCorrelationId(source);
      expect(isValidCorrelationId(id)).toBe(true);
    });
  });

  describe('Source with other properties', () => {
    it('should ignore unrelated properties', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const source = {
        correlationId: validId,
        unrelated: 'value',
        another: 123,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should skip invalid header and check next one', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const source = {
        correlationId: 'invalid-uuid',
        correlation_id: validId,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should skip non-string values and check next header', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const source = {
        correlationId: 12345,
        correlation_id: validId,
      } as Record<string, unknown>;
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });
  });

  describe('Edge cases', () => {
    it('should handle source with symbol properties', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const symbolKey = Symbol('correlationId');
      const source: Record<string, unknown> = {
        [symbolKey]: validId,
        correlationId: validId,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should handle source with numeric properties', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const source: Record<string, unknown> = {
        0: validId,
        correlationId: validId,
      };
      expect(extractOrGenerateCorrelationId(source)).toBe(validId);
    });

    it('should generate different IDs when no valid ID found', () => {
      const source1 = { correlationId: 'invalid' };
      const source2 = { correlationId: 'invalid' };
      const id1 = extractOrGenerateCorrelationId(source1);
      const id2 = extractOrGenerateCorrelationId(source2);
      expect(id1).not.toBe(id2);
    });
  });
});

describe('CorrelationContext', () => {
  // Clean up contexts before and after each test
  beforeEach(() => {
    CorrelationContext.clear();
  });

  afterEach(() => {
    CorrelationContext.clear();
  });

  describe('create', () => {
    it('should create context with provided correlation ID', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context = CorrelationContext.create(validId);

      expect(typeof context).toBe('symbol');
      expect(CorrelationContext.get(context)).toBe(validId);
    });

    it('should create context with generated ID when not provided', () => {
      const context = CorrelationContext.create();

      const id = CorrelationContext.get(context);
      expect(id).toBeDefined();
      expect(isValidCorrelationId(id!)).toBe(true);
    });

    it('should create context with undefined explicitly passed', () => {
      const context = CorrelationContext.create(undefined);

      const id = CorrelationContext.get(context);
      expect(id).toBeDefined();
      expect(isValidCorrelationId(id!)).toBe(true);
    });

    it('should create unique contexts for each call', () => {
      const context1 = CorrelationContext.create();
      const context2 = CorrelationContext.create();

      expect(context1).not.toBe(context2);
    });

    it('should create unique contexts even with same correlation ID', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context1 = CorrelationContext.create(validId);
      const context2 = CorrelationContext.create(validId);

      expect(context1).not.toBe(context2);
      expect(CorrelationContext.get(context1)).toBe(validId);
      expect(CorrelationContext.get(context2)).toBe(validId);
    });

    it('should return symbol type', () => {
      const context = CorrelationContext.create();
      expect(typeof context).toBe('symbol');
    });

    it('should store multiple contexts independently', () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const id2 = '22222222-2222-4222-8222-222222222222';
      const id3 = '33333333-3333-4333-8333-333333333333';

      const context1 = CorrelationContext.create(id1);
      const context2 = CorrelationContext.create(id2);
      const context3 = CorrelationContext.create(id3);

      expect(CorrelationContext.get(context1)).toBe(id1);
      expect(CorrelationContext.get(context2)).toBe(id2);
      expect(CorrelationContext.get(context3)).toBe(id3);
    });
  });

  describe('get', () => {
    it('should retrieve correlation ID from valid context', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context = CorrelationContext.create(validId);

      expect(CorrelationContext.get(context)).toBe(validId);
    });

    it('should return undefined for non-existent context', () => {
      const fakeContext = Symbol('fakeContext');
      expect(CorrelationContext.get(fakeContext)).toBeUndefined();
    });

    it('should return undefined for deleted context', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context = CorrelationContext.create(validId);

      CorrelationContext.delete(context);
      expect(CorrelationContext.get(context)).toBeUndefined();
    });

    it('should return correct ID after multiple creates', () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const id2 = '22222222-2222-4222-8222-222222222222';

      const context1 = CorrelationContext.create(id1);
      const context2 = CorrelationContext.create(id2);

      expect(CorrelationContext.get(context1)).toBe(id1);
      expect(CorrelationContext.get(context2)).toBe(id2);
    });

    it('should return generated ID for context created without ID', () => {
      const context = CorrelationContext.create();
      const id = CorrelationContext.get(context);

      expect(id).toBeDefined();
      expect(isValidCorrelationId(id!)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete existing context', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context = CorrelationContext.create(validId);

      CorrelationContext.delete(context);
      expect(CorrelationContext.get(context)).toBeUndefined();
    });

    it('should not throw when deleting non-existent context', () => {
      const fakeContext = Symbol('fakeContext');
      expect(() => CorrelationContext.delete(fakeContext)).not.toThrow();
    });

    it('should not throw when deleting already deleted context', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context = CorrelationContext.create(validId);

      CorrelationContext.delete(context);
      expect(() => CorrelationContext.delete(context)).not.toThrow();
    });

    it('should only delete specified context', () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const id2 = '22222222-2222-4222-8222-222222222222';

      const context1 = CorrelationContext.create(id1);
      const context2 = CorrelationContext.create(id2);

      CorrelationContext.delete(context1);

      expect(CorrelationContext.get(context1)).toBeUndefined();
      expect(CorrelationContext.get(context2)).toBe(id2);
    });

    it('should allow creating new context with same ID after deletion', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const context1 = CorrelationContext.create(validId);

      CorrelationContext.delete(context1);

      const context2 = CorrelationContext.create(validId);
      expect(CorrelationContext.get(context2)).toBe(validId);
    });
  });

  describe('clear', () => {
    it('should clear all contexts', () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const id2 = '22222222-2222-4222-8222-222222222222';
      const id3 = '33333333-3333-4333-8333-333333333333';

      const context1 = CorrelationContext.create(id1);
      const context2 = CorrelationContext.create(id2);
      const context3 = CorrelationContext.create(id3);

      CorrelationContext.clear();

      expect(CorrelationContext.get(context1)).toBeUndefined();
      expect(CorrelationContext.get(context2)).toBeUndefined();
      expect(CorrelationContext.get(context3)).toBeUndefined();
    });

    it('should not throw when clearing empty contexts', () => {
      expect(() => CorrelationContext.clear()).not.toThrow();
    });

    it('should allow creating new contexts after clear', () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const context1 = CorrelationContext.create(id1);

      CorrelationContext.clear();

      const id2 = '22222222-2222-4222-8222-222222222222';
      const context2 = CorrelationContext.create(id2);

      expect(CorrelationContext.get(context1)).toBeUndefined();
      expect(CorrelationContext.get(context2)).toBe(id2);
    });

    it('should not throw when called multiple times', () => {
      CorrelationContext.clear();
      expect(() => CorrelationContext.clear()).not.toThrow();
    });
  });

  describe('Context lifecycle', () => {
    it('should support create -> get -> delete flow', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';

      // Create
      const context = CorrelationContext.create(validId);
      expect(typeof context).toBe('symbol');

      // Get
      const retrievedId = CorrelationContext.get(context);
      expect(retrievedId).toBe(validId);

      // Delete
      CorrelationContext.delete(context);
      expect(CorrelationContext.get(context)).toBeUndefined();
    });

    it('should support multiple concurrent contexts', () => {
      const contexts: symbol[] = [];
      const ids: string[] = [];

      // Create 10 contexts
      for (let i = 0; i < 10; i++) {
        const id = generateCorrelationId();
        ids.push(id);
        contexts.push(CorrelationContext.create(id));
      }

      // Verify all exist
      for (let i = 0; i < 10; i++) {
        expect(CorrelationContext.get(contexts[i])).toBe(ids[i]);
      }

      // Delete half
      for (let i = 0; i < 5; i++) {
        CorrelationContext.delete(contexts[i]);
      }

      // Verify deleted
      for (let i = 0; i < 5; i++) {
        expect(CorrelationContext.get(contexts[i])).toBeUndefined();
      }

      // Verify remaining
      for (let i = 5; i < 10; i++) {
        expect(CorrelationContext.get(contexts[i])).toBe(ids[i]);
      }
    });

    it('should isolate contexts between test runs with clear', () => {
      // First run
      const id1 = '11111111-1111-4111-8111-111111111111';
      const context1 = CorrelationContext.create(id1);
      expect(CorrelationContext.get(context1)).toBe(id1);

      // Clear
      CorrelationContext.clear();

      // Second run
      const id2 = '22222222-2222-4222-8222-222222222222';
      const context2 = CorrelationContext.create(id2);
      expect(CorrelationContext.get(context1)).toBeUndefined();
      expect(CorrelationContext.get(context2)).toBe(id2);
    });
  });
});
