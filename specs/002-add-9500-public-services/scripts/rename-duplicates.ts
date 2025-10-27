#!/usr/bin/env tsx
/**
 * Script to rename duplicate service names in government-services.yaml
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = resolve(
  __dirname,
  '../specs/002-add-9500-public-services/research-data/government-services.yaml'
);

let content = readFileSync(filePath, 'utf-8');

// Group 1: HMRC Api Documentation (6 duplicates)
const apiDocReplacements = [
  {
    old: 'name: HMRC Api Documentation (2)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation',
    new: 'name: HMRC Api Documentation Authorisation\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation',
  },
  {
    old: 'name: HMRC Api Documentation (3)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/testing',
    new: 'name: HMRC Api Documentation Testing\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/testing',
  },
  {
    old: 'name: HMRC Api Documentation (4)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api',
    new: 'name: HMRC Api Documentation Api\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api',
  },
  {
    old: 'name: HMRC Api Documentation (5)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/individual-tax/1.1',
    new: 'name: HMRC Api Documentation Individual Tax\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/individual-tax/1.1',
  },
  {
    old: 'name: HMRC Api Documentation (6)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api/1.0',
    new: 'name: HMRC Api Documentation Vat Api\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api/1.0',
  },
];

// Group 2: HMRC Guides (4 duplicates)
const guidesReplacements = [
  {
    old: 'name: HMRC Guides (2)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/vat-mtd-end-to-end-service-guide/',
    new: 'name: HMRC Guides Vat Mtd\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/vat-mtd-end-to-end-service-guide/',
  },
  {
    old: 'name: HMRC Guides (3)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/',
    new: 'name: HMRC Guides Customs Declarations\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/',
  },
  {
    old: 'name: HMRC Guides (4)\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/',
    new: 'name: HMRC Guides Income Tax Mtd\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/',
  },
];

// Rename the base "HMRC Guides" to be more specific
const guidesBaseReplacement = {
  old: 'name: HMRC Guides\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/',
  new: 'name: HMRC Guides Fraud Prevention\n    protocol: HTTPS\n    method: GET\n    resource: https://developer.service.hmrc.gov.uk/guides/fraud-prevention/',
};

// Group 3: HMRC Information (3 duplicates)
const informationReplacements = [
  {
    old: 'name: HMRC Information (2)\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/faqs',
    new: 'name: HMRC Information Faqs\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/faqs',
  },
  {
    old: 'name: HMRC Information (3)\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/faqs/corporationTax',
    new: 'name: HMRC Information Faqs Corporation Tax\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/faqs/corporationTax',
  },
];

// Rename the base "HMRC Information" to be more specific
const informationBaseReplacement = {
  old: 'name: HMRC Information\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/help',
  new: 'name: HMRC Information Help\n    protocol: HTTPS\n    method: GET\n    resource: https://www.tax.service.gov.uk/information/help',
};

// Apply all replacements
const allReplacements = [
  ...apiDocReplacements,
  guidesBaseReplacement,
  ...guidesReplacements,
  informationBaseReplacement,
  ...informationReplacements,
];

let replaced = 0;
for (const { old, new: newText } of allReplacements) {
  if (content.includes(old)) {
    content = content.replace(old, newText);
    replaced++;
  } else {
    console.warn(`Warning: Could not find text to replace:\n${old}`);
  }
}

// Write the updated content
writeFileSync(filePath, content, 'utf-8');

console.log(`Successfully replaced ${replaced} duplicate names out of ${allReplacements.length} total replacements`);
console.log('Updated file:', filePath);
