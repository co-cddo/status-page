#!/usr/bin/env tsx
/**
 * Service Entry Transformation Script (T014)
 *
 * Converts tagged discovered services to Service Entry format for config.yaml:
 * - Extracts protocol from URL
 * - Generates human-readable service names
 * - Sets appropriate check intervals by criticality
 * - Configures expected validation criteria
 *
 * Usage: tsx scripts/transform-to-entries.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';

interface TaggedService {
  canonical_url: string;
  department: string;
  service_type: string;
  criticality: string;
  geography: string[];
  tags: string[];
  http_status: number;
  validation_passed: boolean;
}

interface ServiceEntry {
  name: string;
  protocol: 'HTTP' | 'HTTPS';
  method: 'GET' | 'HEAD' | 'POST';
  resource: string;
  tags?: string[];
  expected: {
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

function generateServiceName(url: string, department: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const path = urlObj.pathname;

    // Extract meaningful parts
    const hostParts = hostname.split('.').filter(p => !['www', 'gov', 'uk', 'nhs', 'service'].includes(p));
    const pathParts = path.split('/').filter(p => p && !['api', 'v1', 'v2'].includes(p));

    // Department name mapping
    const deptNames: Record<string, string> = {
      'hmrc': 'HMRC',
      'dvla': 'DVLA',
      'dwp': 'DWP',
      'nhs': 'NHS',
      'home-office': 'Home Office',
      'moj': 'MOJ',
      'dfe': 'DfE',
      'defra': 'DEFRA',
      'companies-house': 'Companies House',
      'ipo': 'IPO',
      'policing': 'Police',
      'gds': 'GOV.UK',
    };

    const deptPrefix = deptNames[department] || department.toUpperCase();

    // Build name from path if meaningful
    if (pathParts.length > 0) {
      const mainPart = pathParts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${deptPrefix} ${mainPart}`;
    }

    // Build name from subdomain
    if (hostParts.length > 0) {
      const mainPart = hostParts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return `${deptPrefix} ${mainPart}`;
    }

    // Fallback
    return `${deptPrefix} Service`;
  } catch {
    return 'GOV.UK Service';
  }
}

function getCheckInterval(criticality: string): number {
  switch (criticality) {
    case 'critical':
      return 60; // 1 minute
    case 'high-volume':
      return 300; // 5 minutes
    case 'standard':
    default:
      return 900; // 15 minutes
  }
}

function getWarningThreshold(criticality: string): number {
  switch (criticality) {
    case 'critical':
      return 2; // 2 seconds
    case 'high-volume':
      return 3; // 3 seconds
    case 'standard':
    default:
      return 5; // 5 seconds
  }
}

function getTimeout(criticality: string): number {
  switch (criticality) {
    case 'critical':
      return 5; // 5 seconds
    case 'high-volume':
      return 10; // 10 seconds
    case 'standard':
    default:
      return 15; // 15 seconds
  }
}

function transformToEntries(services: TaggedService[]): ServiceEntry[] {
  const entries: ServiceEntry[] = [];
  const nameSet = new Set<string>();

  for (const service of services) {
    if (!service.validation_passed) {
      continue; // Skip failed services
    }

    const url = new URL(service.canonical_url);
    const protocol = url.protocol === 'https:' ? 'HTTPS' : 'HTTP';

    // Generate unique name
    let name = generateServiceName(service.canonical_url, service.department);
    let nameCounter = 1;
    while (nameSet.has(name)) {
      nameCounter++;
      name = `${generateServiceName(service.canonical_url, service.department)} (${nameCounter})`;
    }
    nameSet.add(name);

    const entry: ServiceEntry = {
      name,
      protocol,
      method: 'GET',
      resource: service.canonical_url,
      tags: service.tags,
      expected: {
        status: service.http_status,
      },
      interval: getCheckInterval(service.criticality),
      warning_threshold: getWarningThreshold(service.criticality),
      timeout: getTimeout(service.criticality),
    };

    entries.push(entry);
  }

  return entries;
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/transform-to-entries.ts --input <file> --output <file>');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];

  console.log(`Reading tagged services from: ${inputFile}`);
  const services = JSON.parse(readFileSync(inputFile, 'utf-8'));

  console.log(`Transforming ${services.length} services to Service Entry format...`);
  const entries = transformToEntries(services);

  // Statistics
  const critCounts = new Map<string, number>();
  for (const entry of entries) {
    const interval = entry.interval || 900;
    const crit = interval === 60 ? 'critical' : interval === 300 ? 'high-volume' : 'standard';
    critCounts.set(crit, (critCounts.get(crit) || 0) + 1);
  }

  console.log(`\nTransformation complete:`);
  console.log(`  Total entries created: ${entries.length}`);
  console.log(`  Critical (60s interval): ${critCounts.get('critical') || 0}`);
  console.log(`  High-volume (300s interval): ${critCounts.get('high-volume') || 0}`);
  console.log(`  Standard (900s interval): ${critCounts.get('standard') || 0}`);

  console.log(`\nWriting results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(entries, null, 2));

  console.log('✓ Service entry transformation complete');
}

main();
