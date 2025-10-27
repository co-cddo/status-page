#!/usr/bin/env tsx
/**
 * Merge Discovery Sources - Task T031
 *
 * Merges 8 JSON files from the discovery phase into a single consolidated file.
 * Adds source_department field to each service and creates metadata.
 *
 * Input: 8 JSON files in specs/002-add-9500-public-services/research-data/discovered/
 * Output: government-services-all.json with all services consolidated
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Service {
  url: string;
  name: string;
  discovery_source?: string;
  department?: string;
  description?: string;
  service_type?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface SourceFile {
  source?: string;
  department?: string;
  services?: Service[];
  [key: string]: unknown;
}

interface MergedOutput {
  merge_date: string;
  source_files: string[];
  total_services: number;
  services_by_department: Record<string, number>;
  duplicate_urls: Array<{ url: string; departments: string[] }>;
  services: Array<Service & { source_department: string }>;
}

const baseDir = 'specs/002-add-9500-public-services/research-data/discovered';

const SOURCE_FILES: Array<{ filename: string; department: string }> = [
  { filename: 'hmrc-services.json', department: 'HMRC' },
  { filename: 'dvla-services.json', department: 'DVLA' },
  { filename: 'dwp-services.json', department: 'DWP' },
  { filename: 'home-office-services.json', department: 'Home Office' },
  { filename: 'moj-services.json', department: 'MOJ' },
  { filename: 'dfe-services.json', department: 'DfE' },
  { filename: 'defra-services.json', department: 'Defra' },
  { filename: 'companies-house-ipo-services.json', department: 'Companies House & IPO' },
];

function loadJsonFile(filepath: string): SourceFile {
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

function extractServices(data: SourceFile, department: string): Array<Service & { source_department: string }> {
  let services: Service[] = [];

  // Handle different JSON structures
  if (Array.isArray(data)) {
    // MOJ, DfE, Defra, Companies House format (direct array)
    services = data as Service[];
  } else if (data.services && Array.isArray(data.services)) {
    // HMRC, DVLA, DWP, Home Office format (object with services array)
    services = data.services;
  } else {
    console.warn(`Warning: Unexpected data structure for ${department}`);
    return [];
  }

  // Add source_department to each service
  return services.map(service => ({
    ...service,
    source_department: department,
  }));
}

function detectDuplicates(services: Array<Service & { source_department: string }>): Array<{ url: string; departments: string[] }> {
  const urlMap = new Map<string, string[]>();

  for (const service of services) {
    const url = service.url;
    if (!urlMap.has(url)) {
      urlMap.set(url, []);
    }
    urlMap.get(url)!.push(service.source_department);
  }

  const duplicates: Array<{ url: string; departments: string[] }> = [];
  for (const [url, departments] of urlMap.entries()) {
    if (departments.length > 1) {
      duplicates.push({ url, departments: [...new Set(departments)] });
    }
  }

  return duplicates;
}

function main() {
  console.log('=== Merge Discovery Sources (T031) ===\n');

  const allServices: Array<Service & { source_department: string }> = [];
  const servicesByDepartment: Record<string, number> = {};

  // Load and process each source file
  for (const { filename, department } of SOURCE_FILES) {
    const filepath = join(baseDir, filename);

    console.log(`Loading ${filename}...`);
    try {
      const data = loadJsonFile(filepath);
      const services = extractServices(data, department);

      allServices.push(...services);
      servicesByDepartment[department] = services.length;

      console.log(`  ✓ Extracted ${services.length} services from ${department}`);
    } catch (error) {
      console.error(`  ✗ Error loading ${filename}:`, error);
      process.exit(1);
    }
  }

  // Detect duplicates
  console.log('\nDetecting duplicate URLs...');
  const duplicates = detectDuplicates(allServices);
  console.log(`  Found ${duplicates.length} duplicate URLs`);

  if (duplicates.length > 0) {
    console.log('\n  Sample duplicate URLs:');
    for (const dup of duplicates.slice(0, 10)) {
      console.log(`    - ${dup.url}`);
      console.log(`      Departments: ${dup.departments.join(', ')}`);
    }
    if (duplicates.length > 10) {
      console.log(`    ... and ${duplicates.length - 10} more`);
    }
  }

  // Create merged output
  const mergedOutput: MergedOutput = {
    merge_date: new Date().toISOString(),
    source_files: SOURCE_FILES.map(f => f.filename),
    total_services: allServices.length,
    services_by_department: servicesByDepartment,
    duplicate_urls: duplicates,
    services: allServices,
  };

  // Write output file
  const outputPath = join(baseDir, 'government-services-all.json');
  console.log(`\nWriting merged output to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify(mergedOutput, null, 2), 'utf-8');
  console.log('  ✓ Merge complete!\n');

  // Summary report
  console.log('=== Merge Summary ===');
  console.log(`Total services: ${allServices.length}`);
  console.log(`Expected services: 614`);
  console.log(`Difference: ${allServices.length - 614}`);
  console.log(`\nServices by department:`);
  for (const [dept, count] of Object.entries(servicesByDepartment).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${dept.padEnd(25)} ${count}`);
  }
  console.log(`\nDuplicate URLs: ${duplicates.length}`);
  console.log(`\nOutput file: ${outputPath}`);
}

main();
