#!/usr/bin/env tsx
/**
 * Generate Emergency Services YAML - Tasks T074-T079
 *
 * Applies emergency-specific tagging (critical tier) and generates YAML
 * with 60-second check intervals for all emergency services.
 */

import { readFileSync, writeFileSync } from 'fs';
import YAML from 'yaml';

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

const INPUT_FILE = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/validated/04-entries.json';
const OUTPUT_FILE = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/emergency-services.yaml';

function applyEmergencyTags(entry: ServiceEntry): ServiceEntry {
  const tags = entry.tags || [];

  // Remove standard tag and add critical tag
  const filteredTags = tags.filter(t => t !== 'standard' && t !== 'high-volume');

  if (!filteredTags.includes('critical')) {
    filteredTags.push('critical');
  }

  // Add emergency tag if not present
  if (!filteredTags.includes('emergency')) {
    filteredTags.push('emergency');
  }

  return {
    ...entry,
    tags: filteredTags,
    interval: 60,  // 60-second intervals for emergency services
    warning_threshold: 2,
    timeout: 5,
  };
}

function generateYAML(): void {
  console.log('=== Generate Emergency Services YAML (T074-T079) ===\n');

  // Read entries
  console.log(`Reading service entries from ${INPUT_FILE}...`);
  const entries: ServiceEntry[] = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`  ✓ Loaded ${entries.length} service entries\n`);

  // Apply emergency-specific tags
  console.log('Applying emergency-specific tags (critical tier, 60s interval)...');
  const emergencyEntries = entries.map(applyEmergencyTags);
  console.log(`  ✓ Tagged ${emergencyEntries.length} services as critical/emergency\n`);

  // Group by service type for organized YAML
  const policeServices = emergencyEntries.filter(e =>
    e.tags?.includes('policing') || e.resource.includes('police')
  );
  const fireServices = emergencyEntries.filter(e =>
    e.tags?.some(t => t.includes('fire')) || e.resource.includes('fire')
  );
  const ambulanceServices = emergencyEntries.filter(e =>
    e.resource.includes('ambulance') || e.name.toLowerCase().includes('ambulance')
  );
  const coastGuardServices = emergencyEntries.filter(e =>
    e.resource.includes('coastguard') || e.resource.includes('maritime') ||
    e.resource.includes('rnli') || e.name.toLowerCase().includes('coast')
  );
  const otherEmergency = emergencyEntries.filter(e =>
    !policeServices.includes(e) &&
    !fireServices.includes(e) &&
    !ambulanceServices.includes(e) &&
    !coastGuardServices.includes(e)
  );

  console.log('Service breakdown by category:');
  console.log(`  Police services:          ${policeServices.length}`);
  console.log(`  Fire & Rescue services:   ${fireServices.length}`);
  console.log(`  Ambulance services:       ${ambulanceServices.length}`);
  console.log(`  Coast Guard services:     ${coastGuardServices.length}`);
  console.log(`  Other emergency services: ${otherEmergency.length}\n`);

  // Build YAML with comments and sections
  const yamlDoc = new YAML.Document({
    settings: {
      check_interval: 60,
      warning_threshold: 2,
      timeout: 5,
      page_refresh: 60,
      max_retries: 3,
      worker_pool_size: 0,
    },
    pings: [
      ...policeServices,
      ...fireServices,
      ...ambulanceServices,
      ...coastGuardServices,
      ...otherEmergency,
    ],
  });

  // Add comments to the document
  yamlDoc.commentBefore = ' Emergency Services Configuration\n Generated: ' + new Date().toISOString() + '\n Total services: ' + emergencyEntries.length + '\n Check interval: 60 seconds (critical tier)';

  const yamlString = yamlDoc.toString();

  // Write YAML file
  console.log(`Writing YAML to ${OUTPUT_FILE}...`);
  writeFileSync(OUTPUT_FILE, yamlString, 'utf-8');
  console.log(`  ✓ YAML file generated successfully\n`);

  // Summary
  console.log('=== Generation Summary ===');
  console.log(`Total emergency services:  ${emergencyEntries.length}`);
  console.log(`Check interval:            60 seconds`);
  console.log(`Criticality tier:          Tier 1 (Critical)`);
  console.log(`Output file:               ${OUTPUT_FILE}`);
  console.log(`File size:                 ${(Buffer.byteLength(yamlString) / 1024).toFixed(2)} KB\n`);
}

generateYAML();
