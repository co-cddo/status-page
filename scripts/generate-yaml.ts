#!/usr/bin/env tsx
/**
 * YAML Generation Script (T016)
 *
 * Generates formatted config.yaml with inline comments and section headers:
 * - Groups services by category and criticality tier
 * - Adds section headers with comments
 * - Sorts services alphabetically within categories
 * - Preserves YAML formatting with proper indentation
 *
 * Usage: tsx scripts/generate-yaml.ts --input <file> --categories <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';

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

interface Category {
  category_name: string;
  tag_pattern: string;
  display_order: number;
  description: string;
  tier: number;
  check_interval: number;
}

interface Categories {
  version: string;
  categories: Category[];
}

function serviceMatchesCategory(service: ServiceEntry, category: Category): boolean {
  const tags = service.tags || [];
  const patterns = category.tag_pattern.split('|').map(p => p.trim());

  for (const pattern of patterns) {
    // Handle "tag1 + tag2" (AND)
    if (pattern.includes('+')) {
      const requiredTags = pattern.split('+').map(t => t.trim());
      if (requiredTags.every(tag => tags.includes(tag))) {
        return true;
      }
    } else {
      // Simple tag match
      if (tags.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

function groupByCategory(
  services: ServiceEntry[],
  categories: Categories,
): Map<string, ServiceEntry[]> {
  const grouped = new Map<string, ServiceEntry[]>();

  // Initialize all categories
  for (const category of categories.categories) {
    grouped.set(category.category_name, []);
  }

  // Assign services to categories (first match wins)
  for (const service of services) {
    let assigned = false;

    for (const category of categories.categories.sort((a, b) => a.display_order - b.display_order)) {
      if (serviceMatchesCategory(service, category)) {
        grouped.get(category.category_name)!.push(service);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Fallback to "Other Government Services"
      const fallback = grouped.get('Other Government Services');
      if (fallback) {
        fallback.push(service);
      }
    }
  }

  return grouped;
}

function generateYaml(
  services: ServiceEntry[],
  categories: Categories,
): string {
  const lines: string[] = [];

  // Group services by category
  const grouped = groupByCategory(services, categories);

  // Sort categories by display order
  const sortedCategories = categories.categories.sort((a, b) => a.display_order - b.display_order);

  let currentTier = 0;

  for (const category of sortedCategories) {
    const categoryServices = grouped.get(category.category_name) || [];

    if (categoryServices.length === 0) {
      continue; // Skip empty categories
    }

    // Add tier header if tier changed
    if (category.tier !== currentTier) {
      currentTier = category.tier;
      lines.push('');
      lines.push('  # ' + '='.repeat(76));
      const tierNames = {
        1: 'CRITICAL SERVICES (60-second check interval)',
        2: 'HIGH-VOLUME SERVICES (300-second check interval)',
        3: 'STANDARD SERVICES (900-second check interval)',
      };
      lines.push(`  # ${tierNames[category.tier as keyof typeof tierNames] || `TIER ${category.tier}`}`);
      lines.push('  # ' + '='.repeat(76));
      lines.push('');
    }

    // Add category header
    lines.push(`  # ${category.category_name}`);
    if (category.description) {
      lines.push(`  # ${category.description}`);
    }

    // Sort services alphabetically by name
    const sortedServices = categoryServices.sort((a, b) => a.name.localeCompare(b.name));

    // Add services
    for (const service of sortedServices) {
      const serviceYaml = yaml.dump([service], {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });

      // Extract just the service entry (remove array wrapper and indent)
      const lines_ = serviceYaml.split('\n');
      for (let i = 1; i < lines_.length; i++) {
        if (lines_[i].trim()) {
          lines.push('  ' + lines_[i]);
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const categoriesIndex = args.indexOf('--categories');
  const outputIndex = args.indexOf('--output');

  if (inputIndex === -1 || categoriesIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/generate-yaml.ts --input <file> --categories <file> --output <file>');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const categoriesFile = args[categoriesIndex + 1];
  const outputFile = args[outputIndex + 1];

  console.log(`Reading service entries from: ${inputFile}`);
  const services = JSON.parse(readFileSync(inputFile, 'utf-8'));

  console.log(`Reading categories from: ${categoriesFile}`);
  const categories = JSON.parse(readFileSync(categoriesFile, 'utf-8'));

  console.log(`Generating YAML for ${services.length} services...`);

  // Generate pings section
  const pingsYaml = generateYaml(services, categories);

  // Create full config structure
  const fullYaml = `# GOV.UK Public Services Status Monitor - Configuration
# Auto-generated from discovered services

settings:
  check_interval: 60
  warning_threshold: 2
  timeout: 5
  page_refresh: 60
  max_retries: 3
  worker_pool_size: 0

pings:
${pingsYaml}
`;

  console.log(`\nWriting YAML to: ${outputFile}`);
  writeFileSync(outputFile, fullYaml);

  // Statistics
  const critCounts = new Map<number, number>();
  for (const service of services) {
    const interval = service.interval || 900;
    const tier = interval === 60 ? 1 : interval === 300 ? 2 : 3;
    critCounts.set(tier, (critCounts.get(tier) || 0) + 1);
  }

  console.log(`\nYAML generation complete:`);
  console.log(`  Total services: ${services.length}`);
  console.log(`  Tier 1 (Critical): ${critCounts.get(1) || 0}`);
  console.log(`  Tier 2 (High-volume): ${critCounts.get(2) || 0}`);
  console.log(`  Tier 3 (Standard): ${critCounts.get(3) || 0}`);
  console.log(`  File size: ${(fullYaml.length / 1024).toFixed(2)} KB`);

  console.log('✓ YAML generation complete');
}

main();
