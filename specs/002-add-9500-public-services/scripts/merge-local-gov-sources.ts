#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

const BASE_DIR = '/Users/cns/httpdocs/cddo/status';
const SPEC_DIR = path.join(BASE_DIR, 'specs/002-add-9500-public-services/research-data/discovered');
const OUT_DIR = path.join(BASE_DIR, 'research-data');

async function main() {
  console.log('T085: Merging local government discovery sources and deduplicating...');

  const urls: string[] = [];

  // Load local government directory
  const directoryPath = path.join(SPEC_DIR, 'local-gov-directory.json');
  const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf-8'));

  // Load shared services
  const sharedServicesPath = path.join(BASE_DIR, 'research-data/discovered/shared-services.json');
  const sharedServices = JSON.parse(fs.readFileSync(sharedServicesPath, 'utf-8'));

  // Extract shared service URLs
  let sharedCount = 0;
  for (const service of sharedServices.services) {
    if (service.url) {
      urls.push(service.url);
      sharedCount++;
    }
    if (service.gov_url) {
      urls.push(service.gov_url);
      sharedCount++;
    }
  }

  // Extract council URLs from the directory
  interface Council {
    website?: string;
    name?: string;
    validated?: boolean;
  }

  function extractCouncilUrls(councils: Council[]) {
    for (const council of councils) {
      if (council.website && council.website.startsWith('http')) {
        urls.push(council.website);
      }
    }
  }

  // Extract from England
  if (directory.councils?.england) {
    for (const typeArray of Object.values(directory.councils.england)) {
      if (Array.isArray(typeArray)) {
        extractCouncilUrls(typeArray);
      }
    }
  }

  // Extract from Scotland, Wales, Northern Ireland
  for (const region of ['scotland', 'wales', 'northernIreland']) {
    if (directory.councils?.[region]) {
      extractCouncilUrls(directory.councils[region]);
    }
  }

  // Create output directory if needed
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Write deduplicated URLs to file
  const uniqueUrls = Array.from(new Set(urls));
  const outputPath = path.join(OUT_DIR, 'local-gov-services-all.txt');
  fs.writeFileSync(outputPath, uniqueUrls.join('\n'));

  console.log(`Total URLs extracted: ${urls.length}`);
  console.log(`Unique URLs after deduplication: ${uniqueUrls.length}`);
  console.log(`Shared service URLs: ${sharedCount}`);
  console.log(`Council URLs: ${uniqueUrls.length - sharedCount}`);
  console.log(`Output written to: ${outputPath}`);
}

main().catch(console.error);
