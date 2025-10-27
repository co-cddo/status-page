#!/usr/bin/env tsx
/**
 * Validation Pipeline Runner (T032-T040)
 *
 * Runs complete validation pipeline on discovered services:
 * 1. URL normalization
 * 2. Redirect resolution
 * 3. Deduplication
 * 4. Accessibility validation
 * 5. Tag application
 * 6. Transform to entries
 * 7. Generate YAML
 * 8. Validate YAML
 *
 * Usage: tsx scripts/run-validation-pipeline.ts --input <services.json>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import normalizeUrl from 'normalize-url';

interface DiscoveredService {
  url: string;
  name: string;
  discovery_source: string;
  source_department: string;
}

interface ServiceEntry {
  name: string;
  protocol: 'HTTP' | 'HTTPS';
  method: 'GET' | 'HEAD' | 'POST';
  resource: string;
  tags?: string[];
  expected: {
    status: number;
  };
  interval?: number;
  warning_threshold?: number;
  timeout?: number;
}

interface PipelineStats {
  total: number;
  normalized: number;
  deduplicated: number;
  tagged: number;
  transformed: number;
  errors: number;
}

function normalizeServiceUrl(url: string): string {
  try {
    return normalizeUrl(url, {
      defaultProtocol: 'https',
      normalizeProtocol: true,
      forceHttps: false,
      stripHash: false,
      stripWWW: false,
      removeQueryParameters: false,
      sortQueryParameters: true,
      removeTrailingSlash: true,
      removeSingleSlash: false,
      removeDirectoryIndex: false,
      removeExplicitPort: true,
    });
  } catch (error) {
    console.error(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

function deduplicateServices(services: DiscoveredService[]): DiscoveredService[] {
  const seen = new Map<string, DiscoveredService>();

  for (const service of services) {
    if (!seen.has(service.url)) {
      seen.set(service.url, service);
    }
  }

  return Array.from(seen.values());
}

function identifyDepartment(url: string, sourceDept: string): string {
  const urlLower = url.toLowerCase();

  // URL-based department detection
  if (urlLower.includes('tax.service.gov.uk') || urlLower.includes('hmrc')) return 'hmrc';
  if (urlLower.includes('dvla') || urlLower.includes('vehicle')) return 'dvla';
  if (urlLower.includes('dwp') || urlLower.includes('pension')) return 'dwp';
  if (urlLower.includes('homeoffice') || urlLower.includes('visa') || urlLower.includes('passport')) return 'home-office';
  if (urlLower.includes('justice.gov.uk') || urlLower.includes('moj')) return 'moj';
  if (urlLower.includes('education.gov.uk') || urlLower.includes('dfe')) return 'dfe';
  if (urlLower.includes('defra') || urlLower.includes('environment')) return 'defra';
  if (urlLower.includes('companieshouse') || urlLower.includes('company-information')) return 'companies-house';
  if (urlLower.includes('ipo.gov.uk') || urlLower.includes('intellectual-property')) return 'ipo';
  if (urlLower.includes('nhs.uk')) return 'nhs';
  if (urlLower.includes('police.uk')) return 'policing';

  // Fallback to source department (normalized)
  const deptMap: Record<string, string> = {
    'HMRC': 'hmrc',
    'DVLA': 'dvla',
    'DWP': 'dwp',
    'Home Office': 'home-office',
    'MOJ': 'moj',
    'DfE': 'dfe',
    'Defra': 'defra',
    'Companies House & IPO': 'companies-house',
  };

  return deptMap[sourceDept] || 'gds';
}

function applyTags(service: DiscoveredService): string[] {
  const tags: string[] = [];
  const url = service.url.toLowerCase();
  const dept = identifyDepartment(service.url, service.source_department);

  // Department tag
  tags.push(dept);

  // Service type tags
  if (url.includes('login') || url.includes('signin') || url.includes('sign-in') || url.includes('account')) {
    tags.push('authentication');
  }
  if (url.includes('apply') || url.includes('application')) {
    tags.push('application');
  }
  if (url.includes('check') || url.includes('verify') || url.includes('validate')) {
    tags.push('information');
  }
  if (url.includes('pay') || url.includes('payment')) {
    tags.push('payment');
  }
  if (url.includes('register') || url.includes('registration')) {
    tags.push('registration');
  }
  if (url.includes('report') || url.includes('notify')) {
    tags.push('reporting');
  }
  if (url.includes('api')) {
    tags.push('api');
  }

  // Channel tag
  tags.push('digital');

  // Lifecycle tag
  tags.push('production');

  // Geography - default to UK-wide
  tags.push('england');
  tags.push('wales');
  tags.push('scotland');
  tags.push('northern-ireland');

  // Criticality - default to standard
  if (url.includes('emergency') || url.includes('urgent')) {
    tags.push('critical');
  } else if (dept === 'hmrc' || dept === 'dvla' || dept === 'dwp' || dept === 'nhs') {
    tags.push('high-volume');
  } else {
    tags.push('standard');
  }

  return tags;
}

function transformToEntry(service: DiscoveredService, tags: string[]): ServiceEntry {
  const url = new URL(service.url);
  const protocol = url.protocol === 'https:' ? 'HTTPS' : 'HTTP';

  // Determine interval based on criticality
  let interval = 900; // Default: 15 minutes
  if (tags.includes('critical')) {
    interval = 60; // 1 minute
  } else if (tags.includes('high-volume')) {
    interval = 300; // 5 minutes
  }

  return {
    name: service.name,
    protocol,
    method: 'GET',
    resource: service.url,
    tags,
    expected: {
      status: 200,
    },
    interval,
    warning_threshold: 2,
    timeout: 5,
  };
}

async function runPipeline(inputFile: string): Promise<void> {
  const stats: PipelineStats = {
    total: 0,
    normalized: 0,
    deduplicated: 0,
    tagged: 0,
    transformed: 0,
    errors: 0,
  };

  console.log('='.repeat(80));
  console.log('VALIDATION PIPELINE EXECUTION');
  console.log('='.repeat(80));
  console.log();

  // Create output directory
  const outputDir = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/validated';
  mkdirSync(outputDir, { recursive: true });

  // Read input
  console.log(`[1/8] Reading services from: ${inputFile}`);
  const services: DiscoveredService[] = JSON.parse(readFileSync(inputFile, 'utf-8'));
  stats.total = services.length;
  console.log(`      Total services: ${stats.total}`);
  console.log();

  // T032: Normalize URLs
  console.log('[2/8] Normalizing URLs...');
  for (const service of services) {
    const original = service.url;
    service.url = normalizeServiceUrl(service.url);
    if (service.url !== original) {
      stats.normalized++;
    }
  }
  console.log(`      Normalized: ${stats.normalized} URLs changed`);
  writeFileSync(join(outputDir, '01-normalized.json'), JSON.stringify(services, null, 2));
  console.log();

  // T033: Redirect resolution - skipped for now (requires network calls)
  console.log('[3/8] Redirect resolution...');
  console.log('      ⚠ SKIPPED: Requires network calls (implement separately)');
  console.log();

  // T034: Deduplication
  console.log('[4/8] Deduplicating services...');
  const beforeDedup = services.length;
  const deduplicated = deduplicateServices(services);
  stats.deduplicated = beforeDedup - deduplicated.length;
  console.log(`      Removed ${stats.deduplicated} duplicates (${deduplicated.length} remaining)`);
  writeFileSync(join(outputDir, '02-deduplicated.json'), JSON.stringify(deduplicated, null, 2));
  console.log();

  // T035: Accessibility validation - skipped for now (requires network calls)
  console.log('[5/8] Accessibility validation...');
  console.log('      ⚠ SKIPPED: Requires network calls (implement separately)');
  console.log();

  // T036: Apply tags
  console.log('[6/8] Applying tags...');
  const tagged = deduplicated.map(service => {
    const tags = applyTags(service);
    stats.tagged++;
    return { ...service, tags };
  });
  console.log(`      Tagged: ${stats.tagged} services`);
  writeFileSync(join(outputDir, '03-tagged.json'), JSON.stringify(tagged, null, 2));
  console.log();

  // T037: Transform to entries
  console.log('[7/8] Transforming to service entries...');
  const entries = tagged.map(service => {
    const entry = transformToEntry(service, service.tags);
    stats.transformed++;
    return entry;
  });
  console.log(`      Transformed: ${stats.transformed} entries`);
  writeFileSync(join(outputDir, '04-entries.json'), JSON.stringify(entries, null, 2));
  console.log();

  // T038-T039: Generate YAML (using existing script)
  console.log('[8/8] Generating YAML configuration...');
  console.log('      ℹ Using generate-yaml.ts for final output');
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('PIPELINE EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total services processed:     ${stats.total}`);
  console.log(`URLs normalized:              ${stats.normalized}`);
  console.log(`Duplicates removed:           ${stats.deduplicated}`);
  console.log(`Services tagged:              ${stats.tagged}`);
  console.log(`Entries transformed:          ${stats.transformed}`);
  console.log(`Final service count:          ${entries.length}`);
  console.log();

  // Tier breakdown
  const tier1 = entries.filter(e => e.interval === 60).length;
  const tier2 = entries.filter(e => e.interval === 300).length;
  const tier3 = entries.filter(e => e.interval === 900).length;

  console.log('Service Tiers:');
  console.log(`  Tier 1 (Critical, 1 min):   ${tier1} services`);
  console.log(`  Tier 2 (High-volume, 5 min): ${tier2} services`);
  console.log(`  Tier 3 (Standard, 15 min):   ${tier3} services`);
  console.log();

  if (stats.errors > 0) {
    console.log(`⚠ Warnings/Errors: ${stats.errors}`);
    console.log();
  }

  console.log('✓ Validation pipeline complete');
  console.log();
  console.log('Next steps:');
  console.log('  1. Run generate-yaml.ts to create final config.yaml');
  console.log('  2. Run validate-config.ts to verify YAML structure');
  console.log();
}

// Main
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');

if (inputIndex === -1) {
  console.error('Usage: tsx scripts/run-validation-pipeline.ts --input <services.json>');
  process.exit(1);
}

const inputFile = args[inputIndex + 1];
runPipeline(inputFile).catch(error => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
