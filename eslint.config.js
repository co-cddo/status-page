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

      // Code style (handled by Prettier, but keep some rules)
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
  {
    ignores: [
      'node_modules',
      '_site',
      'dist',
      'output',
      'build',
      'coverage',
      '*.config.js',
      '.github',
    ],
  },
];
