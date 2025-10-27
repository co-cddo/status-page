#!/usr/bin/env tsx
/**
 * Merge Emergency Services Discovery Sources - Task T069
 *
 * Merges 7 JSON files from emergency services discovery phase into a single consolidated file.
 *
 * Input: 7 JSON files in specs/002-add-9500-public-services/research-data/discovered/
 * Output: emergency-services-all.json with all services consolidated
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Service {
  url: string;
  name: string;
  discovery_source?: string;
  source_department?: string;
  [key: string]: unknown;
}

const baseDir = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/discovered';

const SOURCE_FILES: string[] = [
  'police-services.json',
  'fire-services.json',
  'ambulance-services.json',
  'coast-guard-services.json',
  'police-force-specific.json',
  'fire-rescue-specific.json',
];

function loadJsonFile(filepath: string): Service[] {
  const content = readFileSync(filepath, 'utf-8');
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : data.services || [];
}

function main() {
  console.log('=== Merge Emergency Services Discovery Sources (T069) ===\n');

  const allServices: Service[] = [];
  const servicesByCategory: Record<string, number> = {};

  // Load and process each source file
  for (const filename of SOURCE_FILES) {
    const filepath = join(baseDir, filename);

    console.log(`Loading ${filename}...`);
    try {
      const services = loadJsonFile(filepath);

      allServices.push(...services);

      const category = filename.replace('.json', '').replace(/-/g, ' ');
      servicesByCategory[category] = (servicesByCategory[category] || 0) + services.length;

      console.log(`  ✓ Extracted ${services.length} services`);
    } catch (error) {
      console.error(`  ✗ Error loading ${filename}:`, error);
      process.exit(1);
    }
  }

  // Create merged output
  const mergedOutput = {
    merge_date: new Date().toISOString(),
    source_files: SOURCE_FILES,
    total_services: allServices.length,
    services_by_category: servicesByCategory,
    services: allServices,
  };

  // Write output file
  const outputPath = join(baseDir, 'emergency-services-all.json');
  console.log(`\nWriting merged output to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify(mergedOutput, null, 2), 'utf-8');
  console.log('  ✓ Merge complete!\n');

  // Summary report
  console.log('=== Merge Summary ===');
  console.log(`Total services: ${allServices.length}`);
  console.log(`\nServices by category:`);
  for (const [category, count] of Object.entries(servicesByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(35)} ${count}`);
  }
  console.log(`\nOutput file: ${outputPath}`);
}

main();
