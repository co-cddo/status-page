#!/usr/bin/env tsx
/**
 * Script to validate government-services.yaml and check for duplicates
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

interface Ping {
  name: string;
  protocol: string;
  method: string;
  resource: string;
  tags?: string[];
}

interface ConfigDocument {
  settings: Record<string, unknown>;
  pings: Ping[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = resolve(
  __dirname,
  '../specs/002-add-9500-public-services/research-data/government-services.yaml'
);

try {
  const content = readFileSync(filePath, 'utf-8');
  const doc = yaml.load(content) as ConfigDocument;

  console.log('✓ YAML is valid');
  console.log(`✓ Total services: ${doc.pings.length}`);

  const names = doc.pings.map((p: Ping) => p.name);
  const uniqueNames = new Set(names);

  console.log(`✓ Unique names: ${uniqueNames.size}`);

  if (names.length !== uniqueNames.size) {
    console.error('✗ DUPLICATES FOUND!');
    const duplicates = names.filter(
      (name: string, index: number) => names.indexOf(name) !== index
    );
    console.error('Duplicate names:', [...new Set(duplicates)]);
    process.exit(1);
  } else {
    console.log('✓ All names are unique!');
  }
} catch (e: unknown) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.error('✗ YAML parsing error:', errorMessage);
  process.exit(1);
}
