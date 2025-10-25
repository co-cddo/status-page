/**
 * Eleventy static site generator runner implementation
 * Spawns Eleventy as a subprocess to generate static HTML from templates
 *
 * Per T035:
 * - Validates _data/health.json input against ServiceStatusAPI schema
 * - Spawns Eleventy subprocess with proper configuration
 * - Handles timeouts, errors, and concurrent build prevention
 * - Tracks build duration and verifies output
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServiceStatusAPI } from '../types/health-check.ts';
import { TIMEOUTS } from '../constants/timeouts.ts';

export interface EleventyBuildOptions {
  dataDir?: string;
  outputDir?: string;
  timeout?: number;
  quiet?: boolean;
}

export interface EleventyBuildResult {
  success: boolean;
  outputPath: string;
  duration: number;
  error?: {
    message: string;
    code?: string;
    stderr?: string;
  };
}

/**
 * Valid ServiceStatus values per OpenAPI schema
 */
const VALID_STATUSES = ['PENDING', 'PASS', 'DEGRADED', 'FAIL'] as const;

export class EleventyRunner {
  private readonly dataDir: string;
  private readonly outputDir: string;
  private readonly timeout: number;
  private readonly quiet: boolean;
  private buildInProgress: boolean = false;

  constructor(options?: EleventyBuildOptions) {
    this.dataDir = options?.dataDir ?? '_data';
    this.outputDir = options?.outputDir ?? 'output';
    this.timeout = options?.timeout ?? TIMEOUTS.ELEVENTY_BUILD_TIMEOUT;
    this.quiet = options?.quiet ?? false;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getOutputDir(): string {
    return this.outputDir;
  }

  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Validate _data/health.json input file
   * Checks file exists, is valid JSON, and matches ServiceStatusAPI schema
   * Refactored to use helper methods (Issue #17)
   */
  async validateInput(): Promise<boolean> {
    const healthJsonPath = join(this.dataDir, 'health.json');

    // Read and parse JSON file
    const parsedData = await this.readAndParseJson(healthJsonPath);

    // Validate array structure
    this.validateArrayStructure(parsedData);

    // Empty array is valid
    if (parsedData.length === 0) {
      return true;
    }

    // Validate each service object
    this.validateServiceObjects(parsedData);

    return true;
  }

  /**
   * Reads and parses JSON file
   * Extracted to reduce complexity of validateInput()
   */
  private async readAndParseJson(filePath: string): Promise<unknown> {
    // Check file exists
    try {
      await access(filePath);
    } catch {
      throw new Error(`health.json not found at ${filePath}`);
    }

    // Read JSON file
    let jsonContent: string;
    try {
      jsonContent = await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read health.json: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Handle empty content
    if (!jsonContent) {
      return [];
    }

    // Parse JSON
    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(
        `Invalid JSON in health.json: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }

  /**
   * Validates that parsed data is an array
   * Extracted to reduce complexity of validateInput()
   */
  private validateArrayStructure(parsedData: unknown): asserts parsedData is unknown[] {
    if (!Array.isArray(parsedData)) {
      throw new Error('Schema validation failed: health.json must be an array');
    }
  }

  /**
   * Validates all service objects in the array
   * Extracted to reduce complexity of validateInput()
   */
  private validateServiceObjects(services: unknown[]): void {
    for (let i = 0; i < services.length; i++) {
      const service = services[i] as Partial<ServiceStatusAPI>;
      this.validateServiceObject(service, i);
    }
  }

  /**
   * Validates a single service object
   * Extracted to reduce complexity of validateInput()
   */
  private validateServiceObject(service: Partial<ServiceStatusAPI>, index: number): void {
    this.validateRequiredFields(service, index);
    this.validateStatusEnum(service, index);
    this.validateFieldTypes(service, index);
  }

  /**
   * Validates all required fields are present
   * Extracted to reduce complexity and repetition
   */
  private validateRequiredFields(service: Partial<ServiceStatusAPI>, index: number): void {
    const requiredFields: Array<keyof ServiceStatusAPI> = [
      'name',
      'status',
      'latency_ms',
      'last_check_time',
      'tags',
      'http_status_code',
      'failure_reason',
    ];

    for (const field of requiredFields) {
      if (!(field in service)) {
        throw new Error(
          `Schema validation failed: Missing required field '${field}' at index ${index}`
        );
      }
    }
  }

  /**
   * Validates status enum value
   * Extracted to reduce complexity
   */
  private validateStatusEnum(service: Partial<ServiceStatusAPI>, index: number): void {
    if (!service.status) {
      throw new Error(`Schema validation failed: Missing required field 'status' at index ${index}`);
    }

    if (!VALID_STATUSES.includes(service.status as (typeof VALID_STATUSES)[number])) {
      throw new Error(
        `Invalid status value '${service.status}' at index ${index}. Must be one of: ${VALID_STATUSES.join(', ')}`
      );
    }
  }

  /**
   * Validates field types based on status
   * Extracted to reduce complexity and handle PENDING vs non-PENDING logic
   */
  private validateFieldTypes(service: Partial<ServiceStatusAPI>, index: number): void {
    // Name must always be a string
    if (typeof service.name !== 'string') {
      throw new Error(`Schema validation failed: 'name' must be a string at index ${index}`);
    }

    // Tags must always be an array
    if (!Array.isArray(service.tags)) {
      throw new Error(`Schema validation failed: 'tags' must be an array at index ${index}`);
    }

    // Failure reason must always be a string
    if (typeof service.failure_reason !== 'string') {
      throw new Error(
        `Schema validation failed: 'failure_reason' must be a string at index ${index}`
      );
    }

    // For PENDING status, certain fields can be null
    if (service.status === 'PENDING') {
      this.validatePendingServiceFields(service, index);
    } else {
      this.validateNonPendingServiceFields(service, index);
    }
  }

  /**
   * Validates field types for PENDING services (allows null values)
   * Extracted to separate PENDING-specific validation logic
   */
  private validatePendingServiceFields(service: Partial<ServiceStatusAPI>, index: number): void {
    if (service.latency_ms !== null && typeof service.latency_ms !== 'number') {
      throw new Error(
        `Schema validation failed: 'latency_ms' must be number or null at index ${index}`
      );
    }

    if (service.last_check_time !== null && typeof service.last_check_time !== 'string') {
      throw new Error(
        `Schema validation failed: 'last_check_time' must be string or null at index ${index}`
      );
    }

    if (service.http_status_code !== null && typeof service.http_status_code !== 'number') {
      throw new Error(
        `Schema validation failed: 'http_status_code' must be number or null at index ${index}`
      );
    }
  }

  /**
   * Validates field types for non-PENDING services (requires non-null values)
   * Extracted to separate non-PENDING validation logic
   */
  private validateNonPendingServiceFields(service: Partial<ServiceStatusAPI>, index: number): void {
    if (typeof service.latency_ms !== 'number') {
      throw new Error(`Schema validation failed: 'latency_ms' must be a number at index ${index}`);
    }

    if (typeof service.last_check_time !== 'string') {
      throw new Error(
        `Schema validation failed: 'last_check_time' must be a string at index ${index}`
      );
    }

    if (typeof service.http_status_code !== 'number') {
      throw new Error(
        `Schema validation failed: 'http_status_code' must be a number at index ${index}`
      );
    }
  }

  /**
   * Build static HTML using Eleventy
   * Spawns Eleventy as subprocess and waits for completion
   */
  async build(): Promise<EleventyBuildResult> {
    // Prevent concurrent builds
    if (this.buildInProgress) {
      throw new Error('Build already in progress');
    }

    this.buildInProgress = true;
    const startTime = Date.now();

    try {
      // Validate input before building
      await this.validateInput();

      // Spawn Eleventy process
      const args = ['@11ty/eleventy'];
      if (this.quiet) {
        args.push('--quiet');
      }

      let childProcess: ChildProcess;
      try {
        childProcess = spawn('npx', args, {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'production',
          },
          stdio: 'pipe',
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorResult: EleventyBuildResult = {
          success: false,
          outputPath: join(this.outputDir, 'index.html'),
          duration,
          error: {
            message: error instanceof Error ? error.message : 'Failed to spawn Eleventy process',
          },
        };

        // Add code only if it exists (exactOptionalPropertyTypes compliance)
        if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
          errorResult.error!.code = error.code;
        }

        return errorResult;
      }

      // Capture stdout and stderr
      let _stdout = '';
      let stderr = '';

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          _stdout += data.toString();
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Wait for process to complete with timeout
      const result = await new Promise<{
        code: number | null;
        signal: string | null;
        didTimeout: boolean;
      }>((resolve) => {
        let hasResolved = false;

        // Setup timeout
        const timeoutId = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            childProcess.kill('SIGTERM');
            resolve({ code: null, signal: 'SIGTERM', didTimeout: true });
          }
        }, this.timeout);

        // Wait for process to complete
        childProcess.on('close', (code: number | null, signal: string | null) => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            resolve({ code, signal, didTimeout: false });
          }
        });
      });

      const duration = Date.now() - startTime;
      const { code, signal, didTimeout } = result;

      // Handle timeout
      if (didTimeout) {
        return {
          success: false,
          outputPath: join(this.outputDir, 'index.html'),
          duration,
          error: {
            message: `Build timeout after ${this.timeout}ms`,
            code: 'TIMEOUT',
            stderr,
          },
        };
      }

      // Handle signal termination
      if (signal) {
        return {
          success: false,
          outputPath: join(this.outputDir, 'index.html'),
          duration,
          error: {
            message: `Process terminated with signal ${signal}`,
            code: 'SIGNAL',
            stderr,
          },
        };
      }

      // Handle non-zero exit code
      if (code !== 0) {
        return {
          success: false,
          outputPath: join(this.outputDir, 'index.html'),
          duration,
          error: {
            message: stderr || `Build failed with exit code ${code}`,
            code: `EXIT_${code}`,
            stderr,
          },
        };
      }

      // Verify output file exists
      const outputPath = join(this.outputDir, 'index.html');
      await access(outputPath);

      // Success
      return {
        success: true,
        outputPath,
        duration,
      };
    } finally {
      this.buildInProgress = false;
    }
  }
}
