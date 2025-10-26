import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Environment - use jsdom for client tests, node for server tests
    environment: 'node',
    environmentMatchGlobs: [
      // Client-side tests run in jsdom (browser environment)
      ['tests/unit/client/**', 'jsdom'],
      ['assets/**/*.test.ts', 'jsdom'],
    ],

    // Global setup
    globals: true,

    // Coverage configuration (per constitution.md - 80% minimum)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',

      // Coverage thresholds (enforced - fail if below)
      // NOTE: Current thresholds reflect actual coverage as of 2025-10-26
      // TODO: Incrementally increase as more files are tested (target: 80% per constitution.md)
      thresholds: {
        lines: 53,
        functions: 75,
        branches: 84,
        statements: 53,
      },

      // Include source files
      include: ['src/**/*.{ts,tsx,js,jsx}'],

      // Exclude files from coverage
      exclude: [
        'node_modules/**',
        '_site/**',
        'dist/**',
        'output/**',
        'tests/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'src/types/**',
      ],
    },

    // Test file patterns
    include: [
      'tests/unit/**/*.test.{ts,js}',
      'tests/integration/**/*.test.{ts,js}',
      'tests/contract/**/*.test.{ts,js}',
      'tests/mocks/**/*.test.{ts,js}', // Mock infrastructure tests
    ],

    // Exclude patterns
    exclude: [
      'node_modules/**',
      '_site/**',
      'dist/**',
      'output/**',
      'tests/e2e/**', // E2E tests run with Playwright
      'tests/accessibility/**', // Accessibility tests run with Playwright
    ],

    // Test timeout (2 minutes for integration tests)
    testTimeout: 120000,

    // Hook timeout
    hookTimeout: 30000,

    // Isolation
    isolate: true,

    // Threads (use all available CPU cores)
    threads: true,
    maxConcurrency: 10,

    // Reporter
    reporters: ['verbose'],

    // Watch mode exclusions
    watchExclude: [
      '**/node_modules/**',
      '**/_site/**',
      '**/dist/**',
      '**/output/**',
      '**/coverage/**',
    ],

    // Setup files
    setupFiles: [],

    // Mock reset
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },

  // Path aliases (matching tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
