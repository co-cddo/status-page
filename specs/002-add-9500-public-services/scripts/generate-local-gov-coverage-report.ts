#!/usr/bin/env tsx

import * as fs from 'fs';
import * as yaml from 'js-yaml';

interface Service {
  name: string;
  resource: string;
  tags?: string[];
  interval?: number;
}

interface Config {
  pings: Service[];
}

const yamlPath = '/Users/cns/httpdocs/cddo/status/research-data/local-gov-services.yaml';
const config = yaml.load(fs.readFileSync(yamlPath, 'utf-8')) as Config;

const services = config.pings || [];
const totalServices = services.length;

// Count by tags
const tagCounts = new Map<string, number>();
for (const service of services) {
  const tags = service.tags || [];
  for (const tag of tags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
}

// Count shared platforms vs individual councils
let sharedPlatforms = 0;
let individualCouncils = 0;

for (const service of services) {
  const url = service.resource.toLowerCase();
  // Shared platforms
  if (url.includes('sbs.co.uk') || url.includes('sscl.com') ||
      url.includes('notifications.service.gov.uk') ||
      url.includes('payments.service.gov.uk') ||
      url.includes('forms.service.gov.uk') ||
      url.includes('digitalmarketplace.service.gov.uk') ||
      url.includes('contractsfinder.service.gov.uk')) {
    sharedPlatforms++;
  } else if (url.match(/[a-z-]+\.gov\.uk/)) {
    individualCouncils++;
  } else {
    individualCouncils++;
  }
}

const targetMet = totalServices >= 200;
const shortfall = targetMet ? 0 : 200 - totalServices;

const report = `# Phase 6: Local Government Services Coverage Report

Generated: ${new Date().toISOString()}

## Summary Statistics

- **Total Local Government Endpoints**: ${totalServices}
- **Shared Platforms**: ${sharedPlatforms}
- **Individual Council Services**: ${individualCouncils}
- **200+ Endpoints Target**: ${targetMet ? '✗ NOT MET' : '✗ NOT MET (need ' + shortfall + ' more)'}

## Service Breakdown

### By Check Interval
- Critical (60s): ${services.filter(s => s.interval === 60).length}
- High-Volume (300s): ${services.filter(s => s.interval === 300).length}
- Standard (900s): ${services.filter(s => s.interval === 900 || !s.interval).length}

### Top Tags
${Array.from(tagCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([tag, count]) => `- ${tag}: ${count}`)
  .join('\n')}

## Validation Results

From T089 (Accessibility Validation):
- Services validated: 146
- Passed: 143 (97.95%)
- Failed: 3 (2.05%)

## Coverage Analysis

### Regions Represented

Based on discovery data (local-gov-directory.json):
- England: 151 councils (105 validated = 70%)
- Scotland: 32 councils (15 validated = 47%)
- Wales: 22 councils (16 validated = 73%)
- Northern Ireland: 11 councils (1 validated = 9%)

**Total councils in directory**: 216
**Total validated in directory**: 137

### Gap Analysis

**Current Status**: ${totalServices} local government service endpoints

${targetMet ?
  `✓ SUCCESS: Met the minimum 200 local government service endpoint requirement.

The target of 200+ local government endpoints has been achieved with ${totalServices} services.
` :
  `✗ SHORTFALL: ${shortfall} additional endpoints needed to meet the 200 minimum.

**Recommendations to close gap**:
1. Add more individual council service endpoints from the 137 validated councils
2. Each of the 137 validated councils could provide 1-3 service endpoints:
   - Council homepage (already included for many)
   - Council tax payment portal
   - Planning applications portal
   - Waste/recycling booking system
3. Discover additional shared platform services
4. Include specific service types per council

**Feasibility**: With 137 validated councils, we need ${Math.ceil(shortfall / 137)} additional endpoints per council on average.
`}

## Next Steps

1. ${targetMet ? 'Proceed to Phase 7 (Third-Party Services)' : 'Discover additional local government endpoints to meet 200 minimum'}
2. Document representative councils represented in IMPLEMENTATION_STATUS.md
3. Update tasks.md to mark T085-T095 as complete

## Files Generated

- \`research-data/local-gov-services-all.txt\` (214 URLs)
- \`research-data/local-gov-services-normalized.json\` (214 services, 3 changed)
- \`research-data/local-gov-services-canonical.json\` (146 successful, 68 errors)
- \`research-data/local-gov-services-unique.json\` (214 unique)
- \`research-data/local-gov-services-validated.json\` (143 passed)
- \`research-data/local-gov-services-tagged.json\` (143 tagged)
- \`research-data/local-gov-service-entries.json\` (143 entries)
- \`research-data/local-gov-services-categorized.json\` (143 categorized)
- \`research-data/local-gov-services.yaml\` (143 services, 47.17 KB)

---

**Phase 6 Status**: ${targetMet ? 'COMPLETE ✓' : 'INCOMPLETE - Need ' + shortfall + ' more endpoints'}
`;

fs.writeFileSync('/Users/cns/httpdocs/cddo/status/research-data/reports/local-gov-coverage.md', report);
console.log(report);
