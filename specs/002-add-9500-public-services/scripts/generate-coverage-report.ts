#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const inputFile = 'specs/002-add-9500-public-services/research-data/government-service-entries.json';
const outputFile = 'specs/002-add-9500-public-services/research-data/reports/government-services-coverage.md';

const services = JSON.parse(readFileSync(inputFile, 'utf-8'));

// Count by department
const deptCounts = new Map<string, number>();
const deptUrls = new Map<string, string[]>();

for (const service of services) {
  const tags = service.tags || [];

  // Find department tag
  const deptTags = ['hmrc', 'dvla', 'dwp', 'nhs', 'home-office', 'moj', 'dfe', 'defra', 'companies-house', 'ipo', 'policing', 'gds', 'other-government'];
  const dept = tags.find((t: string) => deptTags.includes(t)) || 'unknown';

  deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);

  if (!deptUrls.has(dept)) {
    deptUrls.set(dept, []);
  }
  deptUrls.get(dept)!.push(service.resource);
}

// Sort by count
const sorted = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);

// Generate markdown
const lines = [
  '# Government Services Coverage Report',
  '',
  `**Generated**: ${new Date().toISOString()}`,
  '',
  `**Total Services**: ${services.length}`,
  '',
  '## Department Coverage',
  '',
  '| Department | Service Count | Status |',
  '|------------|---------------|--------|',
];

const majorDepts = ['hmrc', 'dvla', 'dwp', 'home-office'];

for (const [dept, count] of sorted) {
  const status = majorDepts.includes(dept) && count >= 50 ? '✓ PASS' :
                 majorDepts.includes(dept) ? '✗ FAIL (< 50)' :
                 '-';
  lines.push(`| ${dept} | ${count} | ${status} |`);
}

lines.push('');
lines.push('## Major Department Requirements');
lines.push('');
lines.push('Target: Minimum 50 services per major department (HMRC, DVLA, DWP, Home Office)');
lines.push('');

for (const dept of majorDepts) {
  const count = deptCounts.get(dept) || 0;
  const status = count >= 50 ? '✓ PASS' : '✗ FAIL';
  lines.push(`- **${dept.toUpperCase()}**: ${count} services ${status}`);
}

lines.push('');
lines.push('## Criticality Distribution');
lines.push('');

const critCounts = new Map<string, number>();
for (const service of services) {
  const interval = service.interval || 900;
  const crit = interval === 60 ? 'Critical (60s)' :
               interval === 300 ? 'High-volume (300s)' :
               'Standard (900s)';
  critCounts.set(crit, (critCounts.get(crit) || 0) + 1);
}

lines.push('| Tier | Count | Percentage |');
lines.push('|------|-------|------------|');

for (const [tier, count] of Array.from(critCounts.entries()).sort()) {
  const pct = ((count / services.length) * 100).toFixed(1);
  lines.push(`| ${tier} | ${count} | ${pct}% |`);
}

const output = lines.join('\n');

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, output);

console.log('Coverage report generated successfully');
console.log(`Total services: ${services.length}`);
console.log(`Major departments:`);
for (const dept of majorDepts) {
  const count = deptCounts.get(dept) || 0;
  console.log(`  ${dept}: ${count} ${count >= 50 ? '✓' : '✗'}`);
}
