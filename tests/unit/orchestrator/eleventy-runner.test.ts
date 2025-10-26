/**
 * Unit tests for Eleventy static site generator runner
 * Tests subprocess invocation, input validation, HTML generation, error handling
 *
 * Per tasks.md T035a:
 * - Test 11ty subprocess invocation
 * - Test _data/health.json input validation
 * - Test HTML output generation
 * - Test build error handling
 * - Test build timeout handling
 *
 * Tests MUST fail before T035 implementation (TDD principle)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { EleventyRunner } from '../../../src/orchestrator/eleventy-runner.ts';
import type { ServiceStatusAPI } from '../../../src/types/health-check.ts';

// Mock child_process module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs/promises module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

/**
 * Eleventy build options interface
 * Note: Interface defined for type documentation but not used in tests
 */
// interface EleventyBuildOptions {
//   dataDir?: string;
//   outputDir?: string;
//   timeout?: number;
//   quiet?: boolean;
// }

/**
 * Eleventy build result interface
 */
interface EleventyBuildResult {
  success: boolean;
  outputPath: string;
  duration: number;
  error?: {
    message: string;
    code?: string;
    stderr?: string;
  };
}

describe('Eleventy Runner', () => {
  let eleventyRunner: EleventyRunner;
  const testDataDir = '_data';
  const testOutputDir = 'output';
  const healthJsonPath = join(testDataDir, 'health.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Runner Initialization', () => {
    it('should initialize with default options', () => {
      // Act
      eleventyRunner = new EleventyRunner();

      // Assert
      expect(eleventyRunner.getDataDir()).toBe('_data');
      expect(eleventyRunner.getOutputDir()).toBe('output');
    });

    it('should initialize with custom data directory', () => {
      // Arrange
      const customDataDir = 'custom-data';

      // Act
      eleventyRunner = new EleventyRunner({ dataDir: customDataDir });

      // Assert
      expect(eleventyRunner.getDataDir()).toBe(customDataDir);
    });

    it('should initialize with custom output directory', () => {
      // Arrange
      const customOutputDir = 'dist';

      // Act
      eleventyRunner = new EleventyRunner({ outputDir: customOutputDir });

      // Assert
      expect(eleventyRunner.getOutputDir()).toBe(customOutputDir);
    });

    it('should initialize with default timeout (120 seconds)', () => {
      // Act
      eleventyRunner = new EleventyRunner();

      // Assert
      expect(eleventyRunner.getTimeout()).toBe(120000); // 120 seconds in ms
    });

    it('should initialize with custom timeout', () => {
      // Arrange
      const customTimeout = 60000; // 60 seconds

      // Act
      eleventyRunner = new EleventyRunner({ timeout: customTimeout });

      // Assert
      expect(eleventyRunner.getTimeout()).toBe(customTimeout);
    });
  });

  describe('Input Validation (_data/health.json)', () => {
    beforeEach(() => {
      eleventyRunner = new EleventyRunner();
    });

    it('should validate health.json file exists', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(access).toHaveBeenCalledWith(healthJsonPath);
      expect(isValid).toBe(true);
    });

    it('should fail validation when health.json does not exist', async () => {
      // Arrange
      vi.mocked(access).mockRejectedValue(new Error('ENOENT: file not found'));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('health.json not found');
    });

    it('should validate health.json contains valid JSON', async () => {
      // Arrange
      const validHealthData: ServiceStatusAPI[] = [
        {
          name: 'test-service',
          status: 'PASS',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: ['api'],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(validHealthData));

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(readFile).toHaveBeenCalledWith(healthJsonPath, 'utf-8');
      expect(isValid).toBe(true);
    });

    it('should fail validation for malformed JSON', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('{ invalid json');

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('Invalid JSON');
    });

    it('should validate health.json matches ServiceStatusAPI schema', async () => {
      // Arrange
      const validData: ServiceStatusAPI[] = [
        {
          name: 'service-1',
          status: 'PASS',
          latency_ms: 150,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: ['frontend'],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
        {
          name: 'service-2',
          status: 'DEGRADED',
          latency_ms: 2500,
          last_check_time: '2025-01-01T00:01:00Z',
          tags: ['backend'],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(validData));

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should fail validation for invalid schema (missing required fields)', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'incomplete-service',
          // Missing status, latency_ms, etc.
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('Schema validation failed');
    });

    it('should fail validation for invalid status values', async () => {
      // Arrange
      const invalidData: unknown[] = [
        {
          name: 'invalid-status',
          status: 'INVALID', // Not PASS/DEGRADED/FAIL/PENDING
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('Invalid status value');
    });

    it('should fail validation for empty string status', async () => {
      // Arrange
      const invalidData: unknown[] = [
        {
          name: 'empty-status',
          status: '', // Empty string is falsy
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: Missing required field 'status'"
      );
    });

    it('should validate empty array as valid input', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should validate PENDING services with null values', async () => {
      // Arrange
      const pendingData: ServiceStatusAPI[] = [
        {
          name: 'pending-service',
          status: 'PENDING',
          latency_ms: null,
          last_check_time: null,
          tags: [],
          http_status_code: null,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(pendingData));

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should fail validation when readFile throws error', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('Failed to read health.json');
    });

    it('should handle empty string content as empty array', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('');

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should fail validation when data is not an array', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('{"not": "an array"}');

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        'Schema validation failed: health.json must be an array'
      );
    });

    it('should fail validation when name is not a string', async () => {
      // Arrange
      const invalidData = [
        {
          name: 123, // Should be string
          status: 'PASS',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'name' must be a string"
      );
    });

    it('should fail validation when tags is not an array', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PASS',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: 'not-an-array', // Should be array
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'tags' must be an array"
      );
    });

    it('should fail validation when failure_reason is not a string', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PASS',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: null, // Should be string
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'failure_reason' must be a string"
      );
    });

    it('should fail validation for PENDING service with invalid latency_ms type', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PENDING',
          latency_ms: 'invalid', // Should be number or null
          last_check_time: null,
          tags: [],
          http_status_code: null,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'latency_ms' must be number or null"
      );
    });

    it('should fail validation for PENDING service with invalid last_check_time type', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PENDING',
          latency_ms: null,
          last_check_time: 123, // Should be string or null
          tags: [],
          http_status_code: null,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'last_check_time' must be string or null"
      );
    });

    it('should fail validation for PENDING service with invalid http_status_code type', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PENDING',
          latency_ms: null,
          last_check_time: null,
          tags: [],
          http_status_code: 'invalid', // Should be number or null
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'http_status_code' must be number or null"
      );
    });

    it('should fail validation for non-PENDING service with null latency_ms', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'PASS',
          latency_ms: null, // Should be number for non-PENDING
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'latency_ms' must be a number"
      );
    });

    it('should fail validation for non-PENDING service with null last_check_time', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'DEGRADED',
          latency_ms: 100,
          last_check_time: null, // Should be string for non-PENDING
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'last_check_time' must be a string"
      );
    });

    it('should fail validation for non-PENDING service with null http_status_code', async () => {
      // Arrange
      const invalidData = [
        {
          name: 'test-service',
          status: 'FAIL',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: null, // Should be number for non-PENDING
          failure_reason: 'Connection timeout',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidData));

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow(
        "Schema validation failed: 'http_status_code' must be a number"
      );
    });

    it('should validate PENDING service with non-null numeric values', async () => {
      // Arrange
      const validData: ServiceStatusAPI[] = [
        {
          name: 'test-service',
          status: 'PENDING',
          latency_ms: 100, // PENDING can have non-null values
          last_check_time: '2025-01-01T00:00:00Z',
          tags: [],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://example.com',
        },
      ];

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(validData));

      // Act
      const isValid = await eleventyRunner.validateInput();

      // Assert
      expect(isValid).toBe(true);
    });

    it('should handle JSON parse error with non-Error object', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('{ invalid json');

      // Mock JSON.parse to throw a non-Error object
      const originalParse = JSON.parse;
      JSON.parse = vi.fn(() => {
        throw 'String error'; // Non-Error throw
      });

      try {
        // Act & Assert
        await expect(eleventyRunner.validateInput()).rejects.toThrow('Invalid JSON');
      } finally {
        // Restore JSON.parse
        JSON.parse = originalParse;
      }
    });

    it('should handle readFile error with non-Error object', async () => {
      // Arrange
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockRejectedValue('String error'); // Non-Error reject

      // Act & Assert
      await expect(eleventyRunner.validateInput()).rejects.toThrow('Failed to read health.json');
    });
  });

  describe('Eleventy Subprocess Invocation', () => {
    beforeEach(() => {
      eleventyRunner = new EleventyRunner();
    });

    it('should spawn Eleventy process with correct command', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(spawn).toHaveBeenCalledWith('npx', ['@11ty/eleventy'], expect.any(Object));
    });

    it('should pass correct working directory to subprocess', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@11ty/eleventy'],
        expect.objectContaining({
          cwd: expect.any(String),
        })
      );
    });

    it('should configure subprocess environment variables', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['@11ty/eleventy'],
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'production',
          }),
        })
      );
    });

    it('should capture stdout from Eleventy process', async () => {
      // Arrange
      const mockStdout = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from('[11ty] Build successful')), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: mockStdout,
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(mockStdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(result.success).toBe(true);
    });

    it('should capture stderr from Eleventy process', async () => {
      // Arrange
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from('[11ty] Warning: deprecated syntax')), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(mockStderr.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should run in quiet mode when configured', async () => {
      // Arrange
      eleventyRunner = new EleventyRunner({ quiet: true });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(spawn).toHaveBeenCalledWith('npx', ['@11ty/eleventy', '--quiet'], expect.any(Object));
    });
  });

  describe('HTML Output Generation', () => {
    beforeEach(() => {
      eleventyRunner = new EleventyRunner();
    });

    it('should generate HTML output successfully', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(join(testOutputDir, 'index.html'));
    });

    it('should verify output file exists after build', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert
      expect(access).toHaveBeenCalledWith(join(testOutputDir, 'index.html'));
    });

    it('should track build duration', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 100); // 100ms build time
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(200);
    });

    it('should return output path in build result', async () => {
      // Arrange
      const customOutputDir = 'custom-output';
      eleventyRunner = new EleventyRunner({ outputDir: customOutputDir });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.outputPath).toBe(join(customOutputDir, 'index.html'));
    });

    it('should handle successful build with warnings', async () => {
      // Arrange
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from('[11ty] Warning: deprecated filter')), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10); // Exit code 0 = success
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Build Error Handling', () => {
    beforeEach(() => {
      eleventyRunner = new EleventyRunner();
    });

    it('should handle template syntax errors', async () => {
      // Arrange
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from('Template syntax error: Unexpected token')), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10); // Non-zero exit code
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('syntax error');
    });

    it('should handle missing template files', async () => {
      // Arrange
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from('Error: Template not found: index.njk')), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Template not found');
    });

    it('should handle Eleventy configuration errors', async () => {
      // Arrange
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(
              () => handler(Buffer.from('Error: Invalid configuration in .eleventy.js')),
              5
            );
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('configuration');
    });

    it('should handle subprocess spawn errors', async () => {
      // Arrange
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('ENOENT: npx command not found');
      });

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('ENOENT');
    });

    it('should handle subprocess spawn errors with error code', async () => {
      // Arrange
      const spawnError = new Error('Command not found');
      Object.assign(spawnError, { code: 'ENOENT' });

      vi.mocked(spawn).mockImplementation(() => {
        throw spawnError;
      });

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Command not found');
      expect(result.error?.code).toBe('ENOENT');
    });

    it('should handle subprocess spawn errors without error code', async () => {
      // Arrange
      const spawnError = new Error('Generic spawn error');
      // No code property

      vi.mocked(spawn).mockImplementation(() => {
        throw spawnError;
      });

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Generic spawn error');
      expect(result.error?.code).toBeUndefined();
    });

    it('should handle subprocess spawn with non-Error throw', async () => {
      // Arrange
      vi.mocked(spawn).mockImplementation(() => {
        throw 'String error'; // Non-Error throw
      });

      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to spawn Eleventy process');
    });

    it('should include stderr in error details', async () => {
      // Arrange
      const errorMessage = 'Fatal error: Out of memory';
      const mockStderr = {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            setTimeout(() => handler(Buffer.from(errorMessage)), 5);
          }
        }),
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: mockStderr,
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.error?.stderr).toContain(errorMessage);
    });

    it('should handle process exit with signal (SIGTERM)', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number | null, signal?: string) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(null, 'SIGTERM'), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('SIGTERM');
    });
  });

  describe('Build Timeout Handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should timeout build after configured duration', async () => {
      // Arrange
      const timeout = 5000; // 5 seconds
      eleventyRunner = new EleventyRunner({ timeout });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const buildPromise = eleventyRunner.build();
      await vi.advanceTimersByTimeAsync(timeout + 100);

      const result: EleventyBuildResult = await buildPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should kill process on timeout', async () => {
      // Arrange
      const timeout = 1000;
      eleventyRunner = new EleventyRunner({ timeout });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const buildPromise = eleventyRunner.build();
      await vi.advanceTimersByTimeAsync(timeout + 100);
      await buildPromise;

      // Assert
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not timeout for fast builds', async () => {
      // Arrange
      const timeout = 10000; // 10 seconds
      eleventyRunner = new EleventyRunner({ timeout });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 100); // Fast build
          }
          return mockProcess;
        }),
        kill: vi.fn(),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const buildPromise = eleventyRunner.build();
      await vi.advanceTimersByTimeAsync(100);
      const result: EleventyBuildResult = await buildPromise;

      // Assert
      expect(result.success).toBe(true);
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should clear timeout after successful build', async () => {
      // Arrange
      eleventyRunner = new EleventyRunner({ timeout: 10000 });

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const buildPromise = eleventyRunner.build();
      await vi.advanceTimersByTimeAsync(10);
      const result = await buildPromise;

      // Advance past timeout to ensure it was cleared
      await vi.advanceTimersByTimeAsync(10000);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      eleventyRunner = new EleventyRunner();
    });

    it('should handle empty health.json array', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle very large health.json file', async () => {
      // Arrange
      const largeData: ServiceStatusAPI[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `service-${i}`,
        status: 'PASS' as const,
        latency_ms: 100,
        last_check_time: '2025-01-01T00:00:00Z',
        tags: [`tag-${i % 10}`],
        http_status_code: 200,
        failure_reason: '',
        resource: 'https://test.example.com',
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(largeData));

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle special characters in service names', async () => {
      // Arrange
      const dataWithSpecialChars: ServiceStatusAPI[] = [
        {
          name: 'Service with "quotes" and \'apostrophes\'',
          status: 'PASS',
          latency_ms: 100,
          last_check_time: '2025-01-01T00:00:00Z',
          tags: ['special-chars'],
          http_status_code: 200,
          failure_reason: '',
          resource: 'https://test.example.com',
        },
      ];

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(dataWithSpecialChars));

      // Act
      const result: EleventyBuildResult = await eleventyRunner.build();

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle concurrent build requests', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
          return mockProcess;
        }),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act - attempt concurrent builds
      const build1 = eleventyRunner.build();
      const build2 = eleventyRunner.build();

      // Assert - second build should be rejected
      await expect(build2).rejects.toThrow('Build already in progress');
      await build1;
    });

    it('should clean up resources after build failure', async () => {
      // Arrange
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10); // Failure
          }
          return mockProcess;
        }),
        removeAllListeners: vi.fn(),
      };

      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(readFile).mockResolvedValue('[]');

      // Act
      await eleventyRunner.build();

      // Assert - should allow new build after cleanup
      const secondBuild = eleventyRunner.build();
      await expect(secondBuild).resolves.toBeDefined();
    });
  });
});
