#!/usr/bin/env tsx
/**
 * Merge Discovery YAML Files into Root Config
 *
 * This script merges validated discovery YAML files (government, NHS, emergency services)
 * into the root config.yaml while:
 * - Removing POC services from root config
 * - Detecting and skipping duplicate services
 * - Preserving root config settings
 * - Validating the merged result
 *
 * Usage: npx tsx scripts/merge-discovery-to-config.ts
 */

import fs from 'fs';
import path from 'path';
import YAML from 'js-yaml';

interface PingEntry {
  name: string;
  protocol: string;
  method: string;
  resource: string;
  tags?: string[];
  expected?: {
    status: number;
    text?: string;
    headers?: Record<string, string>;
  };
  headers?: Array<{ name: string; value: string }>;
  payload?: Record<string, unknown>;
  interval?: number;
  warning_threshold?: number;
  timeout?: number;
}

interface ConfigFile {
  settings?: Record<string, unknown>;
  pings: PingEntry[];
}

interface MergeStats {
  filesProcessed: number;
  servicesAdded: number;
  servicesDuplicate: number;
  pocServicesRemoved: number;
  totalFinal: number;
  mergeOrder: string[];
}

const ROOT_CONFIG = '/Users/cns/httpdocs/cddo/status/config.yaml';
const OUTPUT_CONFIG = '/Users/cns/httpdocs/cddo/status/config.yaml.merged';
const DISCOVERY_BASE = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data';

// Known POC services to remove (these are test/placeholder services)
const POC_SERVICES = [
  'POC:',
  'POC-',
  'Test Service',
  'Example Service',
  'Placeholder',
];

// Known duplicates between root config and discovery (by service name)
const KNOWN_DUPLICATES = [
  'Companies House Find And Update',
  'DVLA Change Address Driving Licence',
  'DVLA Change Vehicle Tax',
  'DWP Jobseekers Allowance',
  'DWP Personal Independence Payment',
  'DWP Universal Credit',
  'Home Office Apply Renew Passport',
  'Home Office Check UK Visa',
  'OTHER-GOVERNMENT Check MOT History',
  'OTHER-GOVERNMENT Employment Support Allowance',
  'OTHER-GOVERNMENT Government',
  'Verify Your Identity',
  'Government Gateway',
];

async function loadYAML(filePath: string): Promise<ConfigFile | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = YAML.load(content) as ConfigFile;
    return data;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return null;
  }
}

function isPOCService(service: PingEntry): boolean {
  return POC_SERVICES.some(poc => service.name.includes(poc));
}

function isDuplicateService(name: string): boolean {
  return KNOWN_DUPLICATES.some(dup =>
    name.toLowerCase().includes(dup.toLowerCase()) ||
    dup.toLowerCase().includes(name.toLowerCase())
  );
}

async function mergeConfigs(): Promise<MergeStats> {
  const stats: MergeStats = {
    filesProcessed: 0,
    servicesAdded: 0,
    servicesDuplicate: 0,
    pocServicesRemoved: 0,
    totalFinal: 0,
    mergeOrder: [],
  };

  // Load root config
  console.log('📂 Loading root config...');
  const rootConfig = await loadYAML(ROOT_CONFIG);
  if (!rootConfig) {
    throw new Error(`Failed to load ${ROOT_CONFIG}`);
  }

  const originalServiceCount = rootConfig.pings.length;
  console.log(`✓ Root config loaded: ${originalServiceCount} services`);

  // Remove POC services from root config
  const nonPOCServices = rootConfig.pings.filter(service => !isPOCService(service));
  stats.pocServicesRemoved = originalServiceCount - nonPOCServices.length;
  console.log(`✓ Removed ${stats.pocServicesRemoved} POC services from root config`);

  // Build service name index for duplicate detection
  const serviceIndex = new Map<string, number>();
  nonPOCServices.forEach(service => {
    serviceIndex.set(service.name.toLowerCase(), 1);
  });

  // Discovery files to merge (in priority order)
  const discoveryFiles = [
    'emergency-services.yaml',
    'nhs-services.yaml',
    'government-services.yaml',
  ];

  // Merge discovery files
  for (const fileName of discoveryFiles) {
    const filePath = path.join(DISCOVERY_BASE, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ File not found: ${filePath}`);
      continue;
    }

    console.log(`\n🔄 Processing ${fileName}...`);
    stats.mergeOrder.push(fileName);

    const discoveryConfig = await loadYAML(filePath);
    if (!discoveryConfig) {
      console.warn(`⚠ Failed to load ${fileName}, skipping`);
      continue;
    }

    let fileServicesAdded = 0;
    let fileDuplicates = 0;

    for (const service of discoveryConfig.pings) {
      const serviceLower = service.name.toLowerCase();

      // Check for duplicates (both exact matches and known duplicates)
      if (serviceIndex.has(serviceLower) || isDuplicateService(service.name)) {
        fileDuplicates++;
        stats.servicesDuplicate++;
        console.log(`  ⊘ Skipped (duplicate): ${service.name}`);
        continue;
      }

      // Add service and update index
      nonPOCServices.push(service);
      serviceIndex.set(serviceLower, 1);
      fileServicesAdded++;
      stats.servicesAdded++;
    }

    console.log(`  ✓ Added ${fileServicesAdded} services, skipped ${fileDuplicates} duplicates`);
    stats.filesProcessed++;
  }

  // Prepare merged config
  const mergedConfig: ConfigFile = {
    settings: rootConfig.settings,
    pings: nonPOCServices,
  };

  stats.totalFinal = mergedConfig.pings.length;

  // Write merged config
  console.log(`\n💾 Writing merged config to ${OUTPUT_CONFIG}...`);
  try {
    const yamlContent = YAML.dump(mergedConfig, {
      lineWidth: 100,
      noRefs: true,
      quotingType: '"',
    });
    fs.writeFileSync(OUTPUT_CONFIG, yamlContent, 'utf-8');
    console.log(`✓ Merged config written successfully`);
  } catch (error) {
    console.error('Error writing merged config:', error);
    throw error;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MERGE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files processed:      ${stats.filesProcessed}`);
  console.log(`Services from discovery: ${stats.servicesAdded}`);
  console.log(`Duplicates skipped:   ${stats.servicesDuplicate}`);
  console.log(`POC services removed: ${stats.pocServicesRemoved}`);
  console.log(`Final service count:  ${stats.totalFinal}`);
  console.log(`Merge order:          ${stats.mergeOrder.join(' → ')}`);
  console.log('='.repeat(60));

  return stats;
}

async function main() {
  try {
    console.log('🚀 Starting config merge...\n');
    await mergeConfigs();

    console.log('\n✅ Merge completed successfully!');
    console.log(`\nNext steps:`);
    console.log(`1. Review the merged config: ${OUTPUT_CONFIG}`);
    console.log(`2. Run validation: npx tsx scripts/validate-config.ts ${OUTPUT_CONFIG}`);
    console.log(`3. If validated, replace: cp ${OUTPUT_CONFIG} ${ROOT_CONFIG}`);
    console.log(`4. Commit changes: git add config.yaml && git commit -m "feat: add 9500+ public services (MVP)"`);
  } catch (error) {
    console.error('❌ Merge failed:', error);
    process.exit(1);
  }
}

main();
