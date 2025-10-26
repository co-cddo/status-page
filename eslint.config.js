// ESLint v9+ flat config format
import js from '@eslint/js';
import typescript from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // General code quality
      'no-console': 'off', // Allow console for CLI app
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],

      // Code style (disable rules handled by Prettier)
      semi: 'off', // Handled by Prettier
      quotes: 'off', // Handled by Prettier
      'comma-dangle': 'off', // Handled by Prettier
    },
  },
  {
    // Browser environment for front-end JavaScript (Issue #30)
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    ignores: [
      // Dependencies
      'node_modules',

      // Build outputs
      '_site',
      'dist',
      'output',
      'build',
      '**/*.tsbuildinfo',

      // Logs
      '**/*.log',
      'logs',

      // Test coverage
      'coverage',
      '.nyc_output',
      'playwright-report',
      'test-results',

      // Generated data files
      'history.csv',
      '_data/health.json',
      '_data/services.json',

      // Temporary files
      '**/*.tmp',
      '.cache',

      // Config files (already linted differently)
      '**/*.config.js',
      '**/*.config.ts',

      // CI/CD
      '.github',
    ],
  },
];
