#!/usr/bin/env tsx
/**
 * JavaScript Build Script
 *
 * Compiles TypeScript assets to JavaScript for browser consumption.
 * Uses esbuild for fast compilation with ESM output.
 *
 * Requirements:
 * - Issue #30: Client-side JavaScript for timestamp localization
 * - Self-contained HTML (output will be inlined by post-build script)
 */

import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { createLogger } from '../src/logging/logger.ts';

const logger = createLogger({ serviceName: 'build-js' });

async function buildJavaScript(): Promise<void> {
  try {
    logger.info('Starting JavaScript build');

    // Ensure output directory exists
    await mkdir('_site/assets/js', { recursive: true });

    // Build timestamp localization module
    await build({
      entryPoints: ['assets/js/timestamp-localization.ts'],
      bundle: true,
      outfile: '_site/assets/js/timestamp-localization.js',
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      minify: true,
      sourcemap: false,
      treeShaking: true,
      logLevel: 'info',
    });

    logger.info('JavaScript build completed successfully');
    console.log('✓ JavaScript compiled: _site/assets/js/timestamp-localization.js');
  } catch (error) {
    logger.error({ error }, 'JavaScript build failed');
    console.error('❌ JavaScript build failed:', error);
    process.exit(1);
  }
}

buildJavaScript();
