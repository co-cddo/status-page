#!/usr/bin/env tsx
/**
 * Tag Application Script (T013)
 *
 * Applies 74-tag taxonomy to validated services:
 * - Department identification from URL patterns
 * - Service type classification
 * - Geography tagging
 * - Criticality assignment
 * - Channel and lifecycle tagging
 *
 * Usage: tsx scripts/apply-tags.ts --input <file> --taxonomy <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';

interface ValidationResult {
  url: string;
  canonical_url: string;
  validation_passed: boolean;
  http_status: number;
}

interface TagTaxonomy {
  version: string;
  total_tags: number;
  categories: {
    department: Array<{ tag_name: string; description: string; parent_tag?: string }>;
    'service-type': Array<{ tag_name: string; description: string }>;
    geography: Array<{ tag_name: string; description: string }>;
    criticality: Array<{ tag_name: string; description: string }>;
    channel: Array<{ tag_name: string; description: string }>;
    lifecycle: Array<{ tag_name: string; description: string }>;
  };
}

interface TaggedService extends ValidationResult {
  department: string;
  service_type: string;
  criticality: string;
  geography: string[];
  tags: string[];
  discovery_source: {
    discovery_method: string;
    discovery_date: string;
    discovered_by: string;
  };
}

function identifyDepartment(url: string): string {
  const urlLower = url.toLowerCase();

  // HMRC
  if (urlLower.includes('tax.service.gov.uk') || urlLower.includes('hmrc')) {
    return 'hmrc';
  }

  // DVLA
  if (urlLower.includes('vehicle') || urlLower.includes('driving') || urlLower.includes('dvla')) {
    return 'dvla';
  }

  // DWP
  if (urlLower.includes('universal-credit') || urlLower.includes('jobseekers') ||
      urlLower.includes('pension') || urlLower.includes('pip') || urlLower.includes('dwp')) {
    return 'dwp';
  }

  // NHS
  if (urlLower.includes('nhs.uk') || urlLower.includes('111.nhs') || urlLower.includes('nhs-')) {
    return 'nhs';
  }

  // Home Office
  if (urlLower.includes('passport') || urlLower.includes('visa') ||
      urlLower.includes('immigration') || urlLower.includes('border')) {
    return 'home-office';
  }

  // Police
  if (urlLower.includes('police.uk') || urlLower.includes('crime')) {
    return 'policing';
  }

  // Companies House
  if (urlLower.includes('companieshouse') || urlLower.includes('company-information')) {
    return 'companies-house';
  }

  // IPO
  if (urlLower.includes('ipo.gov.uk') || urlLower.includes('intellectualproperty')) {
    return 'ipo';
  }

  // MOJ/HMCTS
  if (urlLower.includes('justice.gov.uk') || urlLower.includes('court') || urlLower.includes('tribunal')) {
    return 'moj';
  }

  // DfE
  if (urlLower.includes('education') || urlLower.includes('student')) {
    return 'dfe';
  }

  // DEFRA
  if (urlLower.includes('environment') || urlLower.includes('rural') || urlLower.includes('agriculture')) {
    return 'defra';
  }

  // GDS
  if (urlLower.includes('pay.service.gov.uk') || urlLower.includes('notify') || urlLower.includes('verify')) {
    return 'gds';
  }

  // Default
  if (urlLower.includes('.gov.uk')) {
    return 'other-government';
  }

  return 'other-government';
}

function identifyServiceType(url: string): string {
  const urlLower = url.toLowerCase();
  const pathParts = new URL(url).pathname.toLowerCase().split('/').filter(p => p);

  // Application/Form
  if (pathParts.some(p => ['apply', 'application', 'register', 'sign-up'].includes(p))) {
    return 'application';
  }

  // Booking
  if (pathParts.some(p => ['book', 'booking', 'appointment'].includes(p))) {
    return 'booking';
  }

  // Payment
  if (pathParts.some(p => ['pay', 'payment'].includes(p)) || urlLower.includes('pay.service')) {
    return 'payment';
  }

  // Search/Lookup
  if (pathParts.some(p => ['search', 'find', 'check', 'lookup'].includes(p))) {
    return 'search';
  }

  // Reporting
  if (pathParts.some(p => ['report', 'submit'].includes(p))) {
    return 'reporting';
  }

  // Login/Auth
  if (pathParts.some(p => ['login', 'signin', 'auth', 'verify'].includes(p))) {
    return 'authentication';
  }

  // Case Management
  if (pathParts.some(p => ['case', 'track', 'status'].includes(p))) {
    return 'case-management';
  }

  // Default to information
  return 'information';
}

function identifyGeography(url: string): string[] {
  const urlLower = url.toLowerCase();
  const geography: string[] = [];

  // NHS specific geographies
  if (urlLower.includes('nhs.scot') || urlLower.includes('scot.nhs')) {
    geography.push('scotland');
  } else if (urlLower.includes('nhs.wales')) {
    geography.push('wales');
  } else if (urlLower.includes('hscni.net')) {
    geography.push('northern-ireland');
  } else if (urlLower.includes('nhs.uk')) {
    geography.push('england');
  }

  // Police force specific
  if (urlLower.includes('scotland') || urlLower.includes('.scot')) {
    if (!geography.includes('scotland')) geography.push('scotland');
  }
  if (urlLower.includes('wales') || urlLower.includes('.cymru')) {
    if (!geography.includes('wales')) geography.push('wales');
  }
  if (urlLower.includes('ni.') || urlLower.includes('northern-ireland')) {
    if (!geography.includes('northern-ireland')) geography.push('northern-ireland');
  }

  // Default to UK-wide if no specific geography
  if (geography.length === 0) {
    geography.push('uk-wide');
  }

  return geography;
}

function identifyCriticality(department: string, serviceType: string, url: string): string {
  const urlLower = url.toLowerCase();

  // Critical: Emergency services
  if (urlLower.includes('111.nhs') || urlLower.includes('emergency') ||
      urlLower.includes('999') || urlLower.includes('urgent')) {
    return 'critical';
  }

  // High-volume: Major departments
  const highVolumeDepts = ['hmrc', 'dvla', 'dwp', 'nhs', 'home-office'];
  if (highVolumeDepts.includes(department)) {
    return 'high-volume';
  }

  // Standard: Everything else
  return 'standard';
}

function identifyChannel(department: string, serviceType: string): string {
  // Emergency services
  if (department === 'policing' || department === 'fire-rescue' || department === 'ambulance') {
    return 'emergency';
  }

  // Business-facing
  if (department === 'companies-house' || department === 'ipo' || serviceType === 'registration') {
    return 'business-facing';
  }

  // Default: Citizen-facing
  return 'citizen-facing';
}

function applyTags(
  services: ValidationResult[],
  taxonomy: TagTaxonomy,
): TaggedService[] {
  const taggedServices: TaggedService[] = [];

  for (const service of services) {
    if (!service.validation_passed) {
      continue; // Skip failed validations
    }

    const department = identifyDepartment(service.canonical_url);
    const serviceType = identifyServiceType(service.canonical_url);
    const criticality = identifyCriticality(department, serviceType, service.canonical_url);
    const geography = identifyGeography(service.canonical_url);
    const channel = identifyChannel(department, serviceType);
    const lifecycle = 'live'; // Default to live

    // Build tags array
    const tags: string[] = [
      department,
      serviceType,
      criticality,
      channel,
      lifecycle,
      ...geography,
    ];

    taggedServices.push({
      ...service,
      department,
      service_type: serviceType,
      criticality,
      geography,
      tags: Array.from(new Set(tags)), // Remove duplicates
      discovery_source: {
        discovery_method: 'manual',
        discovery_date: new Date().toISOString(),
        discovered_by: 'validation-pipeline',
      },
    });
  }

  return taggedServices;
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const taxonomyIndex = args.indexOf('--taxonomy');
  const outputIndex = args.indexOf('--output');

  if (inputIndex === -1 || taxonomyIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/apply-tags.ts --input <file> --taxonomy <file> --output <file>');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const taxonomyFile = args[taxonomyIndex + 1];
  const outputFile = args[outputIndex + 1];

  console.log(`Reading validation results from: ${inputFile}`);
  const services = JSON.parse(readFileSync(inputFile, 'utf-8'));

  console.log(`Reading taxonomy from: ${taxonomyFile}`);
  const taxonomy = JSON.parse(readFileSync(taxonomyFile, 'utf-8'));

  console.log(`Applying tags to ${services.length} services...`);
  const taggedServices = applyTags(services, taxonomy);

  // Statistics
  const deptCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const critCounts = new Map<string, number>();

  for (const service of taggedServices) {
    deptCounts.set(service.department, (deptCounts.get(service.department) || 0) + 1);
    typeCounts.set(service.service_type, (typeCounts.get(service.service_type) || 0) + 1);
    critCounts.set(service.criticality, (critCounts.get(service.criticality) || 0) + 1);
  }

  console.log(`\nTag application complete:`);
  console.log(`  Total services tagged: ${taggedServices.length}`);
  console.log(`  Departments: ${deptCounts.size}`);
  console.log(`  Service types: ${typeCounts.size}`);
  console.log(`  Criticality levels: ${critCounts.size}`);

  console.log(`\nTop departments:`);
  const sortedDepts = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [dept, count] of sortedDepts) {
    console.log(`  ${dept}: ${count}`);
  }

  console.log(`\nWriting results to: ${outputFile}`);
  writeFileSync(outputFile, JSON.stringify(taggedServices, null, 2));

  console.log('✓ Tag application complete');
}

main();
