// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

console.log('Consolidating all service.gov.uk discovery sources...');
console.log('='.repeat(60));

// Load all sources
const registryDomains = fs.readFileSync('research-data/discovered/service-gov-uk-registry-domains.txt', 'utf8')
  .split('\n').filter(line => line.trim());

const certDomains = fs.readFileSync('research-data/discovered/service-gov-uk-domains-certs.txt', 'utf8')
  .split('\n').filter(line => line.trim());

console.log(`\nSource 1: Community Registry - ${registryDomains.length} domains`);
console.log(`Source 2: Certificate Transparency - ${certDomains.length} domains`);

// Merge and deduplicate
const allDomains = new Set();
registryDomains.forEach(d => allDomains.add(d));
certDomains.forEach(d => allDomains.add(d));

const uniqueDomains = Array.from(allDomains).sort();

console.log(`\nTotal unique service.gov.uk domains: ${uniqueDomains.length}`);

// Save merged list
fs.writeFileSync(
  'research-data/discovered/service-gov-uk-all-domains.txt',
  uniqueDomains.join('\n')
);

// Generate URLs (HTTPS by default)
const urls = uniqueDomains.map(domain => {
  // Skip if already a URL
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `https://${domain}`;
});

fs.writeFileSync(
  'research-data/discovered/service-gov-uk-all-urls.txt',
  urls.join('\n')
);

console.log(`Saved ${uniqueDomains.length} unique domains to service-gov-uk-all-domains.txt`);
console.log(`Saved ${urls.length} URLs to service-gov-uk-all-urls.txt`);

// Statistics
const registrySet = new Set(registryDomains);
const certsSet = new Set(certDomains);

const onlyRegistry = registryDomains.filter(d => !certsSet.has(d)).length;
const onlyCerts = certDomains.filter(d => !registrySet.has(d)).length;
const both = registryDomains.filter(d => certsSet.has(d)).length;

console.log(`\nSource breakdown:`);
console.log(`  Registry only: ${onlyRegistry}`);
console.log(`  Certs only: ${onlyCerts}`);
console.log(`  Both sources: ${both}`);

// Show samples from different categories
console.log(`\nSample domains (first 40):`);
uniqueDomains.slice(0, 40).forEach(d => console.log(`  ${d}`));

if (uniqueDomains.length > 40) {
  console.log(`\n... and ${uniqueDomains.length - 40} more`);
}

// Save summary report
const summary = {
  task: 'T112-T115: service.gov.uk Domain Discovery',
  timestamp: new Date().toISOString(),
  sources: {
    'Community Registry (govuk-digital-services.herokuapp.com)': registryDomains.length,
    'Certificate Transparency (crt.sh)': certDomains.length
  },
  statistics: {
    totalUniqueDomains: uniqueDomains.length,
    totalUniqueUrls: urls.length,
    breakdown: {
      registryOnly: onlyRegistry,
      certsOnly: onlyCerts,
      bothSources: both
    }
  },
  outputFiles: {
    allDomains: 'research-data/discovered/service-gov-uk-all-domains.txt',
    allUrls: 'research-data/discovered/service-gov-uk-all-urls.txt',
    registryDomains: 'research-data/discovered/service-gov-uk-registry-domains.txt',
    certDomains: 'research-data/discovered/service-gov-uk-domains-certs.txt',
    certData: 'research-data/discovered/service-gov-uk-all-certs.json'
  }
};

fs.writeFileSync(
  'research-data/discovered/service-gov-uk-discovery-summary.json',
  JSON.stringify(summary, null, 2)
);

console.log(`\nSummary saved to service-gov-uk-discovery-summary.json`);
