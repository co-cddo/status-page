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
    this.timeout = options?.timeout ?? 120000; // 120 seconds default
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
   */
  async validateInput(): Promise<boolean> {
    const healthJsonPath = join(this.dataDir, 'health.json');

    // Check file exists
    try {
      await access(healthJsonPath);
    } catch (error) {
      throw new Error(`health.json not found at ${healthJsonPath}`);
    }

    // Read and parse JSON
    let jsonContent: string;
    try {
      jsonContent = await readFile(healthJsonPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read health.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Handle case where readFile returns undefined (shouldn't happen in real code, but tests may mock it)
    if (!jsonContent) {
      // If file exists but is empty or undefined, treat as empty array
      return true;
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Invalid JSON in health.json: ${error instanceof Error ? error.message : 'Parse error'}`);
    }

    // Validate is array
    if (!Array.isArray(parsedData)) {
      throw new Error('Schema validation failed: health.json must be an array');
    }

    // Empty array is valid
    if (parsedData.length === 0) {
      return true;
    }

    // Validate each service object
    for (let i = 0; i < parsedData.length; i++) {
      const service = parsedData[i] as Partial<ServiceStatusAPI>;

      // Check required fields exist
      if (!service.name) {
        throw new Error(`Schema validation failed: Missing required field 'name' at index ${i}`);
      }
      if (!service.status) {
        throw new Error(`Schema validation failed: Missing required field 'status' at index ${i}`);
      }
      if (!('latency_ms' in service)) {
        throw new Error(`Schema validation failed: Missing required field 'latency_ms' at index ${i}`);
      }
      if (!('last_check_time' in service)) {
        throw new Error(`Schema validation failed: Missing required field 'last_check_time' at index ${i}`);
      }
      if (!('tags' in service)) {
        throw new Error(`Schema validation failed: Missing required field 'tags' at index ${i}`);
      }
      if (!('http_status_code' in service)) {
        throw new Error(`Schema validation failed: Missing required field 'http_status_code' at index ${i}`);
      }
      if (!('failure_reason' in service)) {
        throw new Error(`Schema validation failed: Missing required field 'failure_reason' at index ${i}`);
      }

      // Validate status enum
      if (!VALID_STATUSES.includes(service.status as typeof VALID_STATUSES[number])) {
        throw new Error(`Invalid status value '${service.status}' at index ${i}. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }

      // Validate types
      if (typeof service.name !== 'string') {
        throw new Error(`Schema validation failed: 'name' must be a string at index ${i}`);
      }

      // For PENDING status, certain fields can be null
      if (service.status === 'PENDING') {
        if (service.latency_ms !== null && typeof service.latency_ms !== 'number') {
          throw new Error(`Schema validation failed: 'latency_ms' must be number or null at index ${i}`);
        }
        if (service.last_check_time !== null && typeof service.last_check_time !== 'string') {
          throw new Error(`Schema validation failed: 'last_check_time' must be string or null at index ${i}`);
        }
        if (service.http_status_code !== null && typeof service.http_status_code !== 'number') {
          throw new Error(`Schema validation failed: 'http_status_code' must be number or null at index ${i}`);
        }
      } else {
        // For other statuses, these fields must be present
        if (typeof service.latency_ms !== 'number') {
          throw new Error(`Schema validation failed: 'latency_ms' must be a number at index ${i}`);
        }
        if (typeof service.last_check_time !== 'string') {
          throw new Error(`Schema validation failed: 'last_check_time' must be a string at index ${i}`);
        }
        if (typeof service.http_status_code !== 'number') {
          throw new Error(`Schema validation failed: 'http_status_code' must be a number at index ${i}`);
        }
      }

      if (!Array.isArray(service.tags)) {
        throw new Error(`Schema validation failed: 'tags' must be an array at index ${i}`);
      }
      if (typeof service.failure_reason !== 'string') {
        throw new Error(`Schema validation failed: 'failure_reason' must be a string at index ${i}`);
      }
    }

    return true;
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
      let stdout = '';
      let stderr = '';

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      // Wait for process to complete with timeout
      const result = await new Promise<{ code: number | null; signal: string | null; didTimeout: boolean }>(
        (resolve) => {
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
        }
      );

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
