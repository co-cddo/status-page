/**
 * Unit tests for ESLint Configuration
 *
 * Tests ESLint flat config migration from .eslintignore to ignores property.
 * Validates that all ignore patterns are correctly configured.
 * Covers Issue #32: Migrate from deprecated .eslintignore to flat config
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';

const PROJECT_ROOT = join(__dirname, '../../..');
const ESLINTIGNORE_PATH = join(PROJECT_ROOT, '.eslintignore');
const ESLINT_CONFIG_PATH = join(PROJECT_ROOT, 'eslint.config.js');

/**
 * Type definitions for ESLint flat config structure
 */
interface ESLintConfigObject {
  ignores?: string[];
  files?: string[];
  languageOptions?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  [key: string]: unknown;
}

type ESLintFlatConfig = ESLintConfigObject[];

describe('ESLint Configuration', () => {
  describe('Configuration File Validation', () => {
    it('should not have a deprecated .eslintignore file', () => {
      // Test that .eslintignore has been removed
      expect(existsSync(ESLINTIGNORE_PATH)).toBe(false);
    });

    it('should have a valid eslint.config.js file', () => {
      // Test that eslint.config.js exists
      expect(existsSync(ESLINT_CONFIG_PATH)).toBe(true);
    });

    it('should load ESLint configuration without errors', async () => {
      // Test that the configuration is valid and can be loaded by ESLint
      const eslint = new ESLint({
        cwd: PROJECT_ROOT,
      });

      // This will throw if the config is invalid
      // Calculate config for a real source file (not the config file itself)
      const testFilePath = join(PROJECT_ROOT, 'src/index.ts');
      const config = await eslint.calculateConfigForFile(testFilePath);
      expect(config).toBeDefined();
      expect(config.rules).toBeDefined();
    });

    it('should not produce warnings about .eslintignore', async () => {
      // Test that ESLint doesn't warn about deprecated .eslintignore
      const eslint = new ESLint({
        cwd: PROJECT_ROOT,
      });

      // Lint a test file - this would produce warnings if .eslintignore exists
      const results = await eslint.lintFiles(['package.json']);

      // Check that no warnings about .eslintignore are present
      const warningMessages = results.flatMap((result) =>
        result.messages.filter((msg) => msg.severity === 1)
      );

      const eslintIgnoreWarnings = warningMessages.filter((msg) =>
        msg.message.includes('.eslintignore')
      );

      expect(eslintIgnoreWarnings).toHaveLength(0);
    });
  });

  describe('Ignore Patterns', () => {
    it('should have ignores property in configuration', async () => {
      // Dynamically import the config to check its structure
      const configModule = await import(ESLINT_CONFIG_PATH);
      const config = configModule.default as ESLintFlatConfig;

      expect(Array.isArray(config)).toBe(true);

      // Find the ignores configuration object
      const ignoresConfig = config.find((cfg: ESLintConfigObject) => cfg.ignores);

      expect(ignoresConfig).toBeDefined();
      expect(Array.isArray(ignoresConfig?.ignores)).toBe(true);
    });

    it('should include all required ignore patterns', async () => {
      // Dynamically import the config
      const configModule = await import(ESLINT_CONFIG_PATH);
      const config = configModule.default as ESLintFlatConfig;

      // Find the ignores configuration object
      const ignoresConfig = config.find((cfg: ESLintConfigObject) => cfg.ignores);
      const ignores = ignoresConfig?.ignores || [];

      // Required patterns that should be present (migrated from .eslintignore)
      const requiredPatterns = [
        // Directories (can match with or without glob patterns)
        'node_modules',
        '_site',
        'dist',
        'build',
        'output',
        'coverage',
        'logs',
        '.nyc_output',
        'playwright-report',
        'test-results',
        '.cache',
        '.github',

        // File patterns (need glob syntax)
        '**/*.tsbuildinfo',
        '**/*.log',
        '**/*.tmp',
        '**/*.config.js',
        '**/*.config.ts',

        // Specific files
        'history.csv',
        '_data/health.json',
        '_data/services.json',
      ];

      for (const pattern of requiredPatterns) {
        // Check if the pattern or a variant exists
        const exists = ignores.some((ignore: string) => {
          // Exact match
          if (ignore === pattern) return true;

          // For directory patterns, check without trailing slash
          if (pattern.endsWith('/')) {
            return ignore === pattern.slice(0, -1);
          }

          // For non-glob patterns, check if they're included with glob syntax
          if (!pattern.startsWith('**/') && !pattern.includes('*')) {
            return ignore === pattern || ignore === `**/${pattern}` || ignore === `${pattern}/**`;
          }

          return false;
        });

        expect(exists).toBe(true);
      }
    });

    it('should correctly ignore test artifacts', async () => {
      const eslint = new ESLint({
        cwd: PROJECT_ROOT,
      });

      // Test that files in ignored directories are not linted
      const testFiles = [
        'node_modules/some-package/index.js',
        '_site/index.html',
        'coverage/lcov-report/index.html',
        'playwright-report/index.html',
      ];

      for (const testFile of testFiles) {
        const isIgnored = await eslint.isPathIgnored(join(PROJECT_ROOT, testFile));
        expect(isIgnored).toBe(true);
      }
    });

    it('should correctly ignore generated files', async () => {
      const eslint = new ESLint({
        cwd: PROJECT_ROOT,
      });

      // Test that generated files are ignored
      const generatedFiles = [
        'history.csv',
        '_data/health.json',
        '_data/services.json',
        'tsconfig.tsbuildinfo',
        'debug.log',
        'temp.tmp',
      ];

      for (const file of generatedFiles) {
        const isIgnored = await eslint.isPathIgnored(join(PROJECT_ROOT, file));
        expect(isIgnored).toBe(true);
      }
    });

    it('should not ignore source files', async () => {
      const eslint = new ESLint({
        cwd: PROJECT_ROOT,
      });

      // Test that actual source files are NOT ignored
      const sourceFiles = [
        'src/index.ts',
        'src/config/loader.ts',
        'tests/unit/config/loader.test.ts',
      ];

      for (const file of sourceFiles) {
        const fullPath = join(PROJECT_ROOT, file);
        if (existsSync(fullPath)) {
          const isIgnored = await eslint.isPathIgnored(fullPath);
          expect(isIgnored).toBe(false);
        }
      }
    });
  });

  describe('Configuration Structure', () => {
    it('should have separate ignores configuration object', async () => {
      // Dynamically import the config
      const configModule = await import(ESLINT_CONFIG_PATH);
      const config = configModule.default as ESLintFlatConfig;

      // Find the ignores-only configuration object
      const ignoresConfig = config.find((cfg: ESLintConfigObject) => {
        // Should have ignores property
        if (!cfg.ignores) return false;

        // Should not have other properties (per ESLint flat config best practices)
        const keys = Object.keys(cfg);
        return keys.length === 1 && keys[0] === 'ignores';
      });

      expect(ignoresConfig).toBeDefined();
    });
  });
});
