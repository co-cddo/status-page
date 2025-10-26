#!/usr/bin/env tsx
/**
 * Config Validation Script (T018)
 *
 * Validates config.yaml against JSON Schema:
 * - Loads and parses YAML
 * - Validates against schema
 * - Reports detailed errors
 *
 * Usage: tsx scripts/validate-config.ts [--config <path>]
 */

import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Load the existing config schema (if available)
function loadSchema(): object {
  try {
    // Try to load from the existing project schema
    const schemaPath = 'src/config/schema.json';
    return JSON.parse(readFileSync(schemaPath, 'utf-8'));
  } catch {
    // Fallback to basic schema
    return {
      type: 'object',
      required: ['settings', 'pings'],
      properties: {
        settings: {
          type: 'object',
          properties: {
            check_interval: { type: 'number', minimum: 1 },
            warning_threshold: { type: 'number', minimum: 0 },
            timeout: { type: 'number', minimum: 1 },
            page_refresh: { type: 'number', minimum: 1 },
            max_retries: { type: 'number', minimum: 0 },
            worker_pool_size: { type: 'number', minimum: 0 },
          },
        },
        pings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'protocol', 'method', 'resource', 'expected'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              protocol: { enum: ['HTTP', 'HTTPS'] },
              method: { enum: ['GET', 'HEAD', 'POST'] },
              resource: { type: 'string', format: 'uri' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              expected: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'number', minimum: 100, maximum: 599 },
                  text: { type: 'string' },
                  headers: { type: 'object' },
                },
              },
              headers: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'value'],
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'string' },
                  },
                },
              },
              payload: { type: 'object' },
              interval: { type: 'number', minimum: 1 },
              warning_threshold: { type: 'number', minimum: 0 },
              timeout: { type: 'number', minimum: 1 },
            },
          },
        },
      },
    };
  }
}

function validateConfig(configPath: string): boolean {
  console.log(`Loading config from: ${configPath}`);

  // Load YAML
  let config: unknown;
  try {
    const content = readFileSync(configPath, 'utf-8');
    config = yaml.load(content);
  } catch (error) {
    console.error('✗ Failed to parse YAML:', error);
    return false;
  }

  // Validate against schema
  const schema = loadSchema();
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const valid = validate(config);

  if (!valid) {
    console.error('✗ Config validation failed:');
    for (const error of validate.errors || []) {
      console.error(`  ${error.instancePath || '/'}: ${error.message}`);
      if (error.params) {
        console.error(`    Params: ${JSON.stringify(error.params)}`);
      }
    }
    return false;
  }

  // Additional custom validations
  const configObj = config as { pings: Array<{ name: string }> };
  const names = new Set<string>();
  const duplicateNames: string[] = [];

  for (const ping of configObj.pings || []) {
    if (names.has(ping.name)) {
      duplicateNames.push(ping.name);
    }
    names.add(ping.name);
  }

  if (duplicateNames.length > 0) {
    console.error('✗ Duplicate service names found:');
    for (const name of duplicateNames) {
      console.error(`  - ${name}`);
    }
    return false;
  }

  console.log('✓ Config validation passed');
  console.log(`  Total services: ${configObj.pings?.length || 0}`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf('--config');
  const configPath = configIndex !== -1 ? args[configIndex + 1] : 'config.yaml';

  const valid = validateConfig(configPath);
  process.exit(valid ? 0 : 1);
}

main();
