#!/usr/bin/env tsx
/**
 * Local Council Website Discovery Script
 * Phase 6: T080-T084 - Discover 200+ UK local government services
 *
 * Systematically constructs and validates council website URLs
 */

import { createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';
import * as https from 'https';
import * as http from 'http';

interface CouncilService {
  name: string;
  region: string;
  type: string;
  website: string;
  validated: boolean;
  statusCode?: number;
  redirectUrl?: string;
  welshName?: string;
}

// English Local Councils - 317 total
const ENGLISH_COUNCILS = {
  // Metropolitan Districts (36)
  metropolitan: [
    'Barnsley', 'Birmingham', 'Bolton', 'Bradford', 'Bury', 'Calderdale',
    'Coventry', 'Doncaster', 'Dudley', 'Gateshead', 'Kirklees', 'Knowsley',
    'Leeds', 'Liverpool', 'Manchester', 'Newcastle', 'North Tyneside',
    'Oldham', 'Rochdale', 'Rotherham', 'Salford', 'Sandwell', 'Sefton',
    'Sheffield', 'Solihull', 'South Tyneside', 'St Helens', 'Stockport',
    'Sunderland', 'Tameside', 'Trafford', 'Wakefield', 'Walsall',
    'Wigan', 'Wirral', 'Wolverhampton'
  ],

  // County Councils (21)
  county: [
    'Cambridgeshire', 'Derbyshire', 'Devon', 'East Sussex', 'Essex',
    'Gloucestershire', 'Hampshire', 'Hertfordshire', 'Kent', 'Lancashire',
    'Leicestershire', 'Lincolnshire', 'Norfolk', 'Nottinghamshire',
    'Oxfordshire', 'Staffordshire', 'Suffolk', 'Surrey', 'Warwickshire',
    'West Sussex', 'Worcestershire'
  ],

  // Unitary Authorities (62)
  unitary: [
    'Bath and North East Somerset', 'Bedford', 'Blackburn with Darwen',
    'Blackpool', 'Bournemouth Christchurch and Poole', 'Bracknell Forest',
    'Brighton and Hove', 'Bristol', 'Buckinghamshire', 'Central Bedfordshire',
    'Cheshire East', 'Cheshire West and Chester', 'Cornwall', 'Cumberland',
    'Darlington', 'Derby', 'Dorset', 'Durham', 'East Riding of Yorkshire',
    'Halton', 'Hartlepool', 'Herefordshire', 'Isle of Wight', 'Kingston upon Hull',
    'Leicester', 'Luton', 'Medway', 'Middlesbrough', 'Milton Keynes',
    'North East Lincolnshire', 'North Lincolnshire', 'North Northamptonshire',
    'North Somerset', 'North Yorkshire', 'Northumberland', 'Nottingham',
    'Peterborough', 'Plymouth', 'Portsmouth', 'Reading', 'Redcar and Cleveland',
    'Rutland', 'Shropshire', 'Slough', 'Somerset', 'South Gloucestershire',
    'Southampton', 'Southend-on-Sea', 'Stockton-on-Tees', 'Stoke-on-Trent',
    'Swindon', 'Telford and Wrekin', 'Thurrock', 'Torbay', 'Warrington',
    'West Berkshire', 'West Northamptonshire', 'Westmorland and Furness',
    'Wiltshire', 'Windsor and Maidenhead', 'Wokingham', 'York'
  ],

  // London Boroughs (32)
  london: [
    'Barking and Dagenham', 'Barnet', 'Bexley', 'Brent', 'Bromley',
    'Camden', 'Croydon', 'Ealing', 'Enfield', 'Greenwich', 'Hackney',
    'Hammersmith and Fulham', 'Haringey', 'Harrow', 'Havering',
    'Hillingdon', 'Hounslow', 'Islington', 'Kensington and Chelsea',
    'Kingston upon Thames', 'Lambeth', 'Lewisham', 'Merton', 'Newham',
    'Redbridge', 'Richmond upon Thames', 'Southwark', 'Sutton',
    'Tower Hamlets', 'Waltham Forest', 'Wandsworth', 'Westminster'
  ]
};

// Scottish Councils (32)
const SCOTTISH_COUNCILS = [
  'Aberdeen City', 'Aberdeenshire', 'Angus', 'Argyll and Bute',
  'Clackmannanshire', 'Dumfries and Galloway', 'Dundee City',
  'East Ayrshire', 'East Dunbartonshire', 'East Lothian',
  'East Renfrewshire', 'Edinburgh', 'Falkirk', 'Fife',
  'Glasgow City', 'Highland', 'Inverclyde', 'Midlothian',
  'Moray', 'North Ayrshire', 'North Lanarkshire', 'Orkney Islands',
  'Perth and Kinross', 'Renfrewshire', 'Scottish Borders',
  'Shetland Islands', 'South Ayrshire', 'South Lanarkshire',
  'Stirling', 'West Dunbartonshire', 'West Lothian',
  'Western Isles' // Comhairle nan Eilean Siar
];

// Welsh Councils (22)
const WELSH_COUNCILS = [
  { name: 'Blaenau Gwent', welsh: 'Blaenau Gwent' },
  { name: 'Bridgend', welsh: 'Pen-y-bont ar Ogwr' },
  { name: 'Caerphilly', welsh: 'Caerffili' },
  { name: 'Cardiff', welsh: 'Caerdydd' },
  { name: 'Carmarthenshire', welsh: 'Sir Gaerfyrddin' },
  { name: 'Ceredigion', welsh: 'Ceredigion' },
  { name: 'Conwy', welsh: 'Conwy' },
  { name: 'Denbighshire', welsh: 'Sir Ddinbych' },
  { name: 'Flintshire', welsh: 'Sir y Fflint' },
  { name: 'Gwynedd', welsh: 'Gwynedd' },
  { name: 'Isle of Anglesey', welsh: 'Ynys Môn' },
  { name: 'Merthyr Tydfil', welsh: 'Merthyr Tudful' },
  { name: 'Monmouthshire', welsh: 'Sir Fynwy' },
  { name: 'Neath Port Talbot', welsh: 'Castell-nedd Port Talbot' },
  { name: 'Newport', welsh: 'Casnewydd' },
  { name: 'Pembrokeshire', welsh: 'Sir Benfro' },
  { name: 'Powys', welsh: 'Powys' },
  { name: 'Rhondda Cynon Taf', welsh: 'Rhondda Cynon Taf' },
  { name: 'Swansea', welsh: 'Abertawe' },
  { name: 'Torfaen', welsh: 'Torfaen' },
  { name: 'Vale of Glamorgan', welsh: 'Bro Morgannwg' },
  { name: 'Wrexham', welsh: 'Wrecsam' }
];

// Northern Ireland Councils (11)
const NI_COUNCILS = [
  'Antrim and Newtownabbey',
  'Ards and North Down',
  'Armagh City Banbridge and Craigavon',
  'Belfast',
  'Causeway Coast and Glens',
  'Derry City and Strabane',
  'Fermanagh and Omagh',
  'Lisburn and Castlereagh',
  'Mid and East Antrim',
  'Mid Ulster',
  'Newry Mourne and Down'
];

/**
 * Generate potential website URL patterns for a council
 */
function generateUrlPatterns(name: string, region: 'england' | 'scotland' | 'wales' | 'ni'): string[] {
  const normalized = name.toLowerCase()
    .replace(/\s+and\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/,/g, '')
    .replace(/'/g, '');

  const patterns: string[] = [];

  switch (region) {
    case 'england':
      // Standard patterns for English councils
      patterns.push(`https://www.${normalized}.gov.uk`);
      patterns.push(`https://${normalized}.gov.uk`);

      // Special cases for city councils
      if (name.includes('City') || ['Bristol', 'Birmingham', 'Leeds', 'Sheffield', 'Liverpool', 'Manchester'].includes(name)) {
        patterns.push(`https://www.${normalized}city.gov.uk`);
      }

      // Council suffix variations
      patterns.push(`https://www.${normalized}council.gov.uk`);
      break;

    case 'scotland':
      // Scottish councils use .gov.uk domain
      patterns.push(`https://www.${normalized}.gov.uk`);

      // Special case for city councils
      if (name.includes('City')) {
        patterns.push(`https://www.${normalized.replace('-city', 'city')}.gov.uk`);
      }

      // Special cases
      if (name === 'Western Isles') {
        patterns.push('https://www.cne-siar.gov.uk');
      }
      break;

    case 'wales':
      // Welsh councils use .gov.uk or .gov.wales
      patterns.push(`https://www.${normalized}.gov.uk`);
      patterns.push(`https://www.${normalized}.gov.wales`);
      patterns.push(`https://${normalized}.gov.wales`);
      break;

    case 'ni':
      // NI councils typically use own domains
      patterns.push(`https://www.${normalized}council.org`);
      patterns.push(`https://www.${normalized}.gov.uk`);

      // Special cases
      if (name === 'Belfast') {
        patterns.push('https://www.belfastcity.gov.uk');
      }
      break;
  }

  return patterns;
}

/**
 * Validate URL by making HEAD request
 */
async function validateUrl(url: string): Promise<{ valid: boolean; statusCode?: number; redirectUrl?: string }> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(url, {
        method: 'HEAD',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UKGovStatusMonitor/1.0; +https://github.com/cddo/status)'
        }
      }, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle redirects
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          resolve({
            valid: true,
            statusCode,
            redirectUrl: res.headers.location
          });
        } else if (statusCode >= 200 && statusCode < 300) {
          resolve({ valid: true, statusCode });
        } else {
          resolve({ valid: false, statusCode });
        }
      });

      req.on('error', () => {
        resolve({ valid: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ valid: false });
      });

      req.end();
    } catch (error) {
      resolve({ valid: false });
    }
  });
}

/**
 * Discover and validate council website
 */
async function discoverCouncilWebsite(
  name: string,
  region: 'england' | 'scotland' | 'wales' | 'ni',
  type: string
): Promise<CouncilService | null> {
  const patterns = generateUrlPatterns(name, region);

  for (const url of patterns) {
    const result = await validateUrl(url);

    if (result.valid) {
      return {
        name,
        region,
        type,
        website: result.redirectUrl || url,
        validated: true,
        statusCode: result.statusCode,
        redirectUrl: result.redirectUrl
      };
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // If no URL validated, return unvalidated entry
  return {
    name,
    region,
    type,
    website: patterns[0], // Best guess
    validated: false
  };
}

/**
 * Main discovery function
 */
async function discoverLocalCouncils() {
  console.log('Starting local council discovery...\n');

  const allServices: CouncilService[] = [];

  // T080: English Councils
  console.log('T080: Discovering English local councils...');

  for (const [type, councils] of Object.entries(ENGLISH_COUNCILS)) {
    console.log(`  Processing ${type} councils (${councils.length})...`);

    for (const name of councils) {
      const service = await discoverCouncilWebsite(name, 'england', type);
      if (service) {
        allServices.push(service);
        if (service.validated) {
          console.log(`    ✓ ${name}: ${service.website}`);
        } else {
          console.log(`    ✗ ${name}: Unable to validate`);
        }
      }
    }
  }

  const englishServices = allServices.filter(s => s.region === 'england');
  console.log(`T080 Complete: ${englishServices.length} English councils discovered (${englishServices.filter(s => s.validated).length} validated)\n`);

  // T081: Scottish Councils
  console.log('T081: Discovering Scottish local authorities...');

  for (const name of SCOTTISH_COUNCILS) {
    const service = await discoverCouncilWebsite(name, 'scotland', 'unitary');
    if (service) {
      allServices.push(service);
      if (service.validated) {
        console.log(`  ✓ ${name}: ${service.website}`);
      } else {
        console.log(`  ✗ ${name}: Unable to validate`);
      }
    }
  }

  const scottishServices = allServices.filter(s => s.region === 'scotland');
  console.log(`T081 Complete: ${scottishServices.length} Scottish councils discovered (${scottishServices.filter(s => s.validated).length} validated)\n`);

  // T082: Welsh Councils
  console.log('T082: Discovering Welsh local councils...');

  for (const council of WELSH_COUNCILS) {
    const service = await discoverCouncilWebsite(council.name, 'wales', 'unitary');
    if (service) {
      service.welshName = council.welsh;
      allServices.push(service);
      if (service.validated) {
        console.log(`  ✓ ${council.name} (${council.welsh}): ${service.website}`);
      } else {
        console.log(`  ✗ ${council.name}: Unable to validate`);
      }
    }
  }

  const welshServices = allServices.filter(s => s.region === 'wales');
  console.log(`T082 Complete: ${welshServices.length} Welsh councils discovered (${welshServices.filter(s => s.validated).length} validated)\n`);

  // T083: Northern Ireland Councils
  console.log('T083: Discovering Northern Ireland councils...');

  for (const name of NI_COUNCILS) {
    const service = await discoverCouncilWebsite(name, 'ni', 'district');
    if (service) {
      allServices.push(service);
      if (service.validated) {
        console.log(`  ✓ ${name}: ${service.website}`);
      } else {
        console.log(`  ✗ ${name}: Unable to validate`);
      }
    }
  }

  const niServices = allServices.filter(s => s.region === 'ni');
  console.log(`T083 Complete: ${niServices.length} NI councils discovered (${niServices.filter(s => s.validated).length} validated)\n`);

  // Write outputs
  const baseDir = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/discovered';

  await writeFile(
    `${baseDir}/english-councils.json`,
    JSON.stringify(englishServices, null, 2)
  );

  await writeFile(
    `${baseDir}/scottish-councils.json`,
    JSON.stringify(scottishServices, null, 2)
  );

  await writeFile(
    `${baseDir}/welsh-councils.json`,
    JSON.stringify(welshServices, null, 2)
  );

  await writeFile(
    `${baseDir}/ni-councils.json`,
    JSON.stringify(niServices, null, 2)
  );

  // Summary
  console.log('\n=== DISCOVERY SUMMARY ===');
  console.log(`Total councils discovered: ${allServices.length}`);
  console.log(`  English: ${englishServices.length} (target: 100+)`);
  console.log(`  Scottish: ${scottishServices.length} (target: 50+)`);
  console.log(`  Welsh: ${welshServices.length} (target: 30+)`);
  console.log(`  Northern Ireland: ${niServices.length} (target: 20+)`);
  console.log(`\nValidated: ${allServices.filter(s => s.validated).length} / ${allServices.length}`);
  console.log(`\nFiles written to: ${baseDir}/`);
}

// Execute
discoverLocalCouncils().catch(console.error);
