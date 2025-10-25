const fs = require('fs');
const yaml = require('js-yaml');

// Load current config and validated services
const currentConfig = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
const validatedServices = JSON.parse(fs.readFileSync('/tmp/all_validated_services.json', 'utf8'));

// Create URL to validation map
const validationMap = {};
validatedServices.forEach(svc => {
  const normalizedUrl = svc.url.toLowerCase().replace(/\/$/, '');
  validationMap[normalizedUrl] = svc;
});

console.log(`Loaded ${validatedServices.length} validated services`);
console.log(`Search services: ${validatedServices.filter(s => s.is_search_service).length}`);

// Update existing pings with text validation
let updatedCount = 0;
let searchServicesAdded = [];

currentConfig.pings.forEach(ping => {
  const normalizedUrl = ping.resource.toLowerCase().replace(/\/$/, '');
  const validation = validationMap[normalizedUrl];

  if (validation && validation.reliable_text) {
    ping.expected.text = validation.reliable_text;
    updatedCount++;

    // If it's a search service, add POST variant
    if (validation.is_search_service && validation.search_payload) {
      searchServicesAdded.push({
        name: ping.name + ' - Search',
        protocol: ping.protocol,
        method: 'POST',
        resource: ping.resource,
        payload: validation.search_payload,
        tags: [...ping.tags, 'search'],
        expected: {
          status: 200,
          text: validation.reliable_text
        },
        interval: ping.interval || currentConfig.settings.check_interval
      });
    }
  }
});

// Add search POST variants at the end
currentConfig.pings.push(...searchServicesAdded);

console.log(`✓ Updated ${updatedCount} services with text validation`);
console.log(`✓ Added ${searchServicesAdded.length} POST search variants`);
console.log(`✓ Total services: ${currentConfig.pings.length}`);

// Write enhanced config
const yamlStr = yaml.dump(currentConfig, {
  lineWidth: -1,
  noRefs: true,
  quotingType: '"',
  forceQuotes: false
});

fs.writeFileSync('config_enhanced.yaml', yamlStr);
console.log('✓ Enhanced config saved');
