import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jestPlugin from 'eslint-plugin-jest';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/',
      '_site/',
      'dist/',
      'build/',
      'coverage/',
      '*.min.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        node: true,
        es2024: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      jest: jestPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{js,ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      globals: {
        jest: true,
      },
    },
  },
];
