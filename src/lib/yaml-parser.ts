/**
 * YAML configuration parser
 * Based on research.md - uses 'yaml' library from eemeli
 */

import { parse } from 'yaml';
import { readFile } from 'fs/promises';
import type { Configuration } from '../models/configuration.js';

/**
 * Parse YAML configuration file
 * @param filePath - Path to the YAML configuration file
 * @returns Parsed configuration object
 * @throws Error if file cannot be read or parsed
 */
export async function parseYamlConfig(filePath: string): Promise<Configuration> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const config = parse(content) as Configuration;

    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: Root must be an object');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Parse YAML configuration from string
 * @param content - YAML string content
 * @returns Parsed configuration object
 */
export function parseYamlString(content: string): Configuration {
  try {
    const config = parse(content) as Configuration;

    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: Root must be an object');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML: ${error.message}`);
    }
    throw error;
  }
}
