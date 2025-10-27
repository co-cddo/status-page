#!/usr/bin/env tsx
/**
 * Research Progress Reporting Script (T019)
 *
 * Generates statistics and reports for service discovery:
 * - Total discovered, validated, failed
 * - Coverage by department and service type
 * - Tag usage statistics
 * - Discovery method breakdown
 *
 * Usage: tsx scripts/generate-report.ts --input <file> --output <file>
 */

import { readFileSync, writeFileSync } from 'fs';

interface ValidationResult {
  url: string;
  canonical_url: string;
  is_accessible: boolean;
  http_status: number;
  validation_passed: boolean;
  failure_reason: string;
}

interface DiscoveredService {
  canonical_url: string;
  department?: string;
  service_type?: string;
  tags?: string[];
  criticality?: string;
  discovery_source?: {
    discovery_method: string;
  };
}

function generateReport(
  validationResults: ValidationResult[],
  discoveredServices?: DiscoveredService[],
): string {
  const report: string[] = [];
  report.push('# Service Discovery Report');
  report.push('');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');

  // Validation statistics
  report.push('## Validation Summary');
  report.push('');
  const total = validationResults.length;
  const passed = validationResults.filter(r => r.validation_passed).length;
  const failed = total - passed;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';

  report.push(`- Total services validated: **${total}**`);
  report.push(`- Validation passed: **${passed}** (${passRate}%)`);
  report.push(`- Validation failed: **${failed}** (${(100 - parseFloat(passRate)).toFixed(2)}%)`);
  report.push('');

  // HTTP status code distribution
  report.push('## HTTP Status Code Distribution');
  report.push('');
  const statusCounts = new Map<number, number>();
  for (const result of validationResults) {
    statusCounts.set(result.http_status, (statusCounts.get(result.http_status) || 0) + 1);
  }

  const sortedStatuses = Array.from(statusCounts.entries()).sort((a, b) => b[1] - a[1]);
  report.push('| Status Code | Count | Percentage |');
  report.push('|-------------|-------|------------|');
  for (const [status, count] of sortedStatuses) {
    const pct = ((count / total) * 100).toFixed(2);
    report.push(`| ${status || 'Error'} | ${count} | ${pct}% |`);
  }
  report.push('');

  // Failure reasons
  if (failed > 0) {
    report.push('## Top Failure Reasons');
    report.push('');
    const failureReasons = new Map<string, number>();
    for (const result of validationResults.filter(r => !r.validation_passed)) {
      const reason = result.failure_reason || 'Unknown';
      failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
    }

    const sortedReasons = Array.from(failureReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    report.push('| Reason | Count |');
    report.push('|--------|-------|');
    for (const [reason, count] of sortedReasons) {
      report.push(`| ${reason} | ${count} |`);
    }
    report.push('');
  }

  // Department coverage (if discovered services provided)
  if (discoveredServices && discoveredServices.length > 0) {
    report.push('## Coverage by Department');
    report.push('');
    const deptCounts = new Map<string, number>();
    for (const service of discoveredServices) {
      if (service.department) {
        deptCounts.set(service.department, (deptCounts.get(service.department) || 0) + 1);
      }
    }

    const sortedDepts = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);
    report.push('| Department | Services | Percentage |');
    report.push('|------------|----------|------------|');
    for (const [dept, count] of sortedDepts) {
      const pct = ((count / discoveredServices.length) * 100).toFixed(2);
      report.push(`| ${dept} | ${count} | ${pct}% |`);
    }
    report.push('');

    // Service type coverage
    report.push('## Coverage by Service Type');
    report.push('');
    const typeCounts = new Map<string, number>();
    for (const service of discoveredServices) {
      if (service.service_type) {
        typeCounts.set(service.service_type, (typeCounts.get(service.service_type) || 0) + 1);
      }
    }

    const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
    report.push('| Service Type | Services | Percentage |');
    report.push('|-------------|----------|------------|');
    for (const [type, count] of sortedTypes) {
      const pct = ((count / discoveredServices.length) * 100).toFixed(2);
      report.push(`| ${type} | ${count} | ${pct}% |`);
    }
    report.push('');

    // Tag usage
    report.push('## Top 20 Tags');
    report.push('');
    const tagCounts = new Map<string, number>();
    for (const service of discoveredServices) {
      if (service.tags) {
        for (const tag of service.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    report.push('| Tag | Usage Count |');
    report.push('|-----|-------------|');
    for (const [tag, count] of sortedTags) {
      report.push(`| ${tag} | ${count} |`);
    }
    report.push('');

    // Criticality distribution
    report.push('## Criticality Distribution');
    report.push('');
    const critCounts = new Map<string, number>();
    for (const service of discoveredServices) {
      if (service.criticality) {
        critCounts.set(service.criticality, (critCounts.get(service.criticality) || 0) + 1);
      }
    }

    report.push('| Criticality | Services | Percentage |');
    report.push('|-------------|----------|------------|');
    for (const [crit, count] of Array.from(critCounts.entries()).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / discoveredServices.length) * 100).toFixed(2);
      report.push(`| ${crit} | ${count} | ${pct}% |`);
    }
    report.push('');

    // Discovery method statistics
    report.push('## Discovery Method Breakdown');
    report.push('');
    const methodCounts = new Map<string, number>();
    for (const service of discoveredServices) {
      if (service.discovery_source?.discovery_method) {
        const method = service.discovery_source.discovery_method;
        methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
      }
    }

    report.push('| Discovery Method | Services | Percentage |');
    report.push('|-----------------|----------|------------|');
    for (const [method, count] of Array.from(methodCounts.entries()).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / discoveredServices.length) * 100).toFixed(2);
      report.push(`| ${method} | ${count} | ${pct}% |`);
    }
    report.push('');
  }

  return report.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  const discoveredIndex = args.indexOf('--discovered');

  if (inputIndex === -1 || outputIndex === -1) {
    console.error('Usage: tsx scripts/generate-report.ts --input <validation-file> --output <report-file> [--discovered <services-file>]');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const outputFile = args[outputIndex + 1];
  const discoveredFile = discoveredIndex !== -1 ? args[discoveredIndex + 1] : undefined;

  console.log(`Reading validation results from: ${inputFile}`);
  const validationResults = JSON.parse(readFileSync(inputFile, 'utf-8'));

  let discoveredServices: DiscoveredService[] | undefined;
  if (discoveredFile) {
    console.log(`Reading discovered services from: ${discoveredFile}`);
    discoveredServices = JSON.parse(readFileSync(discoveredFile, 'utf-8'));
  }

  console.log('Generating report...');
  const report = generateReport(validationResults, discoveredServices);

  console.log(`Writing report to: ${outputFile}`);
  writeFileSync(outputFile, report);

  console.log('✓ Report generation complete');
}

main();
