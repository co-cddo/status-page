/**
 * YAML configuration loader
 * Per FR-001: Load config.yaml using js-yaml
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import type { Configuration } from '../types/config.js';

/**
 * Error thrown when configuration file cannot be loaded
 */
export class ConfigurationLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigurationLoadError';
  }
}

/**
 * Load configuration from YAML file
 *
 * @param filePath - Path to config.yaml (relative or absolute)
 * @returns Parsed configuration object
 * @throws {ConfigurationLoadError} If file cannot be read or parsed
 *
 * @example
 * ```typescript
 * const config = loadConfiguration('./config.yaml');
 * console.log(`Monitoring ${config.pings.length} services`);
 * ```
 */
export function loadConfiguration(filePath: string = 'config.yaml'): Configuration {
  const absolutePath = resolve(filePath);

  try {
    // Read file contents
    const fileContents = readFileSync(absolutePath, 'utf-8');

    // Parse YAML
    const parsed = loadYaml(fileContents);

    // Validate that parsed content is an object
    if (typeof parsed !== 'object' || parsed === null) {
      throw new ConfigurationLoadError(
        `Configuration file must contain a YAML object, got ${typeof parsed}`,
        absolutePath
      );
    }

    // Cast to Configuration type (will be validated by validator.ts)
    return parsed as Configuration;
  } catch (error) {
    if (error instanceof ConfigurationLoadError) {
      throw error;
    }

    // Handle file not found
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new ConfigurationLoadError(
        `Configuration file not found: ${absolutePath}`,
        absolutePath,
        error as Error
      );
    }

    // Handle YAML parse errors
    if (error instanceof Error) {
      throw new ConfigurationLoadError(
        `Failed to parse YAML configuration: ${error.message}`,
        absolutePath,
        error
      );
    }

    // Unexpected error
    throw new ConfigurationLoadError(
      `Unexpected error loading configuration: ${String(error)}`,
      absolutePath
    );
  }
}

/**
 * Load configuration with fallback to default path
 *
 * Attempts to load from specified path, then falls back to default locations:
 * 1. ./config.yaml
 * 2. ./config/config.yaml
 * 3. $HOME/.govuk-status-monitor/config.yaml
 *
 * @param preferredPath - Preferred configuration file path
 * @returns Parsed configuration object
 * @throws {ConfigurationLoadError} If no configuration file found
 */
export function loadConfigurationWithFallback(preferredPath?: string): Configuration {
  const searchPaths = [
    preferredPath,
    'config.yaml',
    'config/config.yaml',
    process.env.HOME ? `${process.env.HOME}/.govuk-status-monitor/config.yaml` : null,
  ].filter((path): path is string => path !== null && path !== undefined);

  const errors: Array<{ path: string; error: Error }> = [];

  for (const path of searchPaths) {
    try {
      return loadConfiguration(path);
    } catch (error) {
      if (error instanceof ConfigurationLoadError) {
        errors.push({ path, error });
      }
    }
  }

  // No configuration file found
  const errorMessage = [
    'No configuration file found. Searched paths:',
    ...errors.map((e) => `  - ${e.path}: ${e.error.message}`),
  ].join('\n');

  throw new ConfigurationLoadError(errorMessage, searchPaths[0] ?? 'config.yaml');
}
