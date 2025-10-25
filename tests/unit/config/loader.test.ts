/**
 * Unit tests for Configuration Loader
 *
 * Tests YAML file loading, path resolution, and error handling.
 * Covers FR-001: Load config.yaml using js-yaml
 */

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import {
  loadConfiguration,
  loadConfigurationWithFallback,
  ConfigurationLoadError,
} from '../../../src/config/loader.js';

const FIXTURES_DIR = join(__dirname, '../../fixtures/config');
const TEMP_DIR = join(__dirname, '../../tmp');

describe('Configuration Loader', () => {
  describe('loadConfiguration()', () => {
    describe('Valid Configurations', () => {
      it('should load valid YAML config from file', () => {
        const configPath = join(FIXTURES_DIR, 'valid-config.yaml');
        const config = loadConfiguration(configPath);

        expect(config).toBeDefined();
        expect(config.pings).toBeInstanceOf(Array);
        expect(config.pings.length).toBeGreaterThan(0);
        expect(config.settings).toBeDefined();
      });

      it('should load minimal config with only required fields', () => {
        const configPath = join(FIXTURES_DIR, 'minimal-config.yaml');
        const config = loadConfiguration(configPath);

        expect(config).toBeDefined();
        expect(config.pings).toHaveLength(1);
        expect(config.pings[0]!.name).toBe('Minimal Service');
        expect(config.pings[0]!.protocol).toBe('HTTP');
        expect(config.pings[0]!.method).toBe('GET');
        expect(config.pings[0]!.resource).toBe('http://example.com');
        expect(config.pings[0]!.expected.status).toBe(200);
      });

      it('should resolve relative paths correctly', () => {
        const relativePath = 'tests/fixtures/config/valid-config.yaml';
        const config = loadConfiguration(relativePath);

        expect(config).toBeDefined();
        expect(config.pings).toBeInstanceOf(Array);
      });

      it('should resolve absolute paths correctly', () => {
        const absolutePath = join(process.cwd(), 'tests/fixtures/config/valid-config.yaml');
        const config = loadConfiguration(absolutePath);

        expect(config).toBeDefined();
        expect(config.pings).toBeInstanceOf(Array);
      });

      it('should use default path if no argument provided', () => {
        // This will fail if config.yaml doesn't exist in cwd, which is expected
        // We test the default value is used
        try {
          loadConfiguration();
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.filePath).toContain('config.yaml');
          }
        }
      });
    });

    describe('Error Handling', () => {
      it('should throw ConfigurationLoadError for missing file', () => {
        const nonExistentPath = join(FIXTURES_DIR, 'does-not-exist.yaml');

        expect(() => loadConfiguration(nonExistentPath)).toThrow(ConfigurationLoadError);

        try {
          loadConfiguration(nonExistentPath);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.message).toContain('not found');
            expect(error.filePath).toBe(nonExistentPath);
            expect(error.cause).toBeDefined();
          }
        }
      });

      it('should throw ConfigurationLoadError for invalid YAML syntax', () => {
        const invalidYamlPath = join(FIXTURES_DIR, 'invalid-yaml.yaml');

        expect(() => loadConfiguration(invalidYamlPath)).toThrow(ConfigurationLoadError);

        try {
          loadConfiguration(invalidYamlPath);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.message).toContain('Failed to parse YAML');
            expect(error.filePath).toBe(invalidYamlPath);
            expect(error.cause).toBeDefined();
          }
        }
      });

      it('should throw ConfigurationLoadError for non-object YAML', () => {
        const notObjectPath = join(FIXTURES_DIR, 'not-an-object.yaml');

        expect(() => loadConfiguration(notObjectPath)).toThrow(ConfigurationLoadError);

        try {
          loadConfiguration(notObjectPath);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.message).toContain('must contain a YAML object');
            expect(error.message).toContain('got string');
            expect(error.filePath).toBe(notObjectPath);
          }
        }
      });

      it('should handle null YAML content', () => {
        // Create temp directory
        mkdirSync(TEMP_DIR, { recursive: true });

        const nullYamlPath = join(TEMP_DIR, 'null-config.yaml');
        writeFileSync(nullYamlPath, '# Just a comment\n');

        expect(() => loadConfiguration(nullYamlPath)).toThrow(ConfigurationLoadError);

        try {
          loadConfiguration(nullYamlPath);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.message).toContain('must contain a YAML object');
          }
        }

        // Cleanup
        rmSync(TEMP_DIR, { recursive: true, force: true });
      });

      it('should handle empty file', () => {
        // Create temp directory
        mkdirSync(TEMP_DIR, { recursive: true });

        const emptyFilePath = join(TEMP_DIR, 'empty-config.yaml');
        writeFileSync(emptyFilePath, '');

        expect(() => loadConfiguration(emptyFilePath)).toThrow(ConfigurationLoadError);

        // Cleanup
        rmSync(TEMP_DIR, { recursive: true, force: true });
      });

      it('should handle malformed file paths', () => {
        const malformedPath = '\0invalid\0path';

        expect(() => loadConfiguration(malformedPath)).toThrow(ConfigurationLoadError);
      });
    });

    describe('ConfigurationLoadError', () => {
      it('should create error with message, filePath, and cause', () => {
        const cause = new Error('Original error');
        const error = new ConfigurationLoadError('Test error', '/path/to/config.yaml', cause);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ConfigurationLoadError);
        expect(error.name).toBe('ConfigurationLoadError');
        expect(error.message).toBe('Test error');
        expect(error.filePath).toBe('/path/to/config.yaml');
        expect(error.cause).toBe(cause);
      });

      it('should create error without cause', () => {
        const error = new ConfigurationLoadError('Test error', '/path/to/config.yaml');

        expect(error).toBeInstanceOf(ConfigurationLoadError);
        expect(error.cause).toBeUndefined();
      });
    });
  });

  describe('loadConfigurationWithFallback()', () => {
    describe('Search Path Behavior', () => {
      it('should try preferred path first', () => {
        const preferredPath = join(FIXTURES_DIR, 'valid-config.yaml');
        const config = loadConfigurationWithFallback(preferredPath);

        expect(config).toBeDefined();
        expect(config.pings).toBeInstanceOf(Array);
      });

      it('should fall back to default paths if preferred not found', () => {
        // Create temp directory with config.yaml
        mkdirSync(TEMP_DIR, { recursive: true });
        const configPath = join(TEMP_DIR, 'config.yaml');
        writeFileSync(
          configPath,
          `
pings:
  - name: 'Fallback Test'
    protocol: HTTP
    method: GET
    resource: 'http://example.com'
    expected:
      status: 200
`
        );

        // Change to temp directory
        const originalCwd = process.cwd();
        process.chdir(TEMP_DIR);

        try {
          // Try to load with non-existent preferred path
          const config = loadConfigurationWithFallback('/non/existent/path.yaml');

          expect(config).toBeDefined();
          expect(config.pings[0]!.name).toBe('Fallback Test');
        } finally {
          process.chdir(originalCwd);
          rmSync(TEMP_DIR, { recursive: true, force: true });
        }
      });

      it('should throw if no config found in any search path', () => {
        // Change to temp directory with no config
        mkdirSync(TEMP_DIR, { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(TEMP_DIR);

        try {
          expect(() => loadConfigurationWithFallback('/non/existent/path.yaml')).toThrow(
            ConfigurationLoadError
          );

          try {
            loadConfigurationWithFallback('/non/existent/path.yaml');
          } catch (error) {
            expect(error).toBeInstanceOf(ConfigurationLoadError);
            if (error instanceof ConfigurationLoadError) {
              expect(error.message).toContain('No configuration file found');
              expect(error.message).toContain('Searched paths');
            }
          }
        } finally {
          process.chdir(originalCwd);
          rmSync(TEMP_DIR, { recursive: true, force: true });
        }
      });

      it('should handle undefined preferred path', () => {
        // Create temp directory with config.yaml
        mkdirSync(TEMP_DIR, { recursive: true });
        const configPath = join(TEMP_DIR, 'config.yaml');
        writeFileSync(
          configPath,
          `
pings:
  - name: 'No Preferred Path'
    protocol: HTTP
    method: GET
    resource: 'http://example.com'
    expected:
      status: 200
`
        );

        const originalCwd = process.cwd();
        process.chdir(TEMP_DIR);

        try {
          const config = loadConfigurationWithFallback();

          expect(config).toBeDefined();
          expect(config.pings[0]!.name).toBe('No Preferred Path');
        } finally {
          process.chdir(originalCwd);
          rmSync(TEMP_DIR, { recursive: true, force: true });
        }
      });
    });

    describe('Error Aggregation', () => {
      it('should include all searched paths in error message', () => {
        // Change to temp directory with no config
        mkdirSync(TEMP_DIR, { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(TEMP_DIR);

        try {
          loadConfigurationWithFallback('/custom/path.yaml');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationLoadError);
          if (error instanceof ConfigurationLoadError) {
            expect(error.message).toContain('/custom/path.yaml');
            expect(error.message).toContain('config.yaml');
          }
        } finally {
          process.chdir(originalCwd);
          rmSync(TEMP_DIR, { recursive: true, force: true });
        }
      });
    });
  });
});
