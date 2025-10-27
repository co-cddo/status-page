#!/usr/bin/env tsx
/**
 * Consolidate Local Government Directory
 * Phase 6: T084 - Create comprehensive UK local government directory
 *
 * Merges discovered council data into unified directory structure
 */

import { readFile, writeFile } from 'fs/promises';

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

interface LocalGovDirectory {
  metadata: {
    title: string;
    description: string;
    generatedAt: string;
    phase: string;
    tasks: string[];
    totalCouncils: number;
    validatedCouncils: number;
    coverage: {
      england: { total: number; validated: number; target: number };
      scotland: { total: number; validated: number; target: number };
      wales: { total: number; validated: number; target: number };
      northernIreland: { total: number; validated: number; target: number };
    };
  };
  councils: {
    england: {
      metropolitan: CouncilService[];
      county: CouncilService[];
      unitary: CouncilService[];
      london: CouncilService[];
    };
    scotland: CouncilService[];
    wales: CouncilService[];
    northernIreland: CouncilService[];
  };
  statistics: {
    byRegion: Record<string, { total: number; validated: number; percentage: number }>;
    byType: Record<string, { total: number; validated: number; percentage: number }>;
    validationStatus: {
      validated: number;
      unvalidated: number;
      validationRate: number;
    };
  };
}

async function consolidateDirectory() {
  const baseDir = '/Users/cns/httpdocs/cddo/status/specs/002-add-9500-public-services/research-data/discovered';

  console.log('T084: Consolidating local government directory...\n');

  // Load all council data
  const englishData: CouncilService[] = JSON.parse(
    await readFile(`${baseDir}/english-councils.json`, 'utf-8')
  );
  const scottishData: CouncilService[] = JSON.parse(
    await readFile(`${baseDir}/scottish-councils.json`, 'utf-8')
  );
  const welshData: CouncilService[] = JSON.parse(
    await readFile(`${baseDir}/welsh-councils.json`, 'utf-8')
  );
  const niData: CouncilService[] = JSON.parse(
    await readFile(`${baseDir}/ni-councils.json`, 'utf-8')
  );

  // Organize English councils by type
  const englishCouncils = {
    metropolitan: englishData.filter(c => c.type === 'metropolitan'),
    county: englishData.filter(c => c.type === 'county'),
    unitary: englishData.filter(c => c.type === 'unitary'),
    london: englishData.filter(c => c.type === 'london')
  };

  // Calculate statistics
  const allCouncils = [...englishData, ...scottishData, ...welshData, ...niData];
  const validated = allCouncils.filter(c => c.validated).length;

  const byRegion = {
    england: {
      total: englishData.length,
      validated: englishData.filter(c => c.validated).length,
      percentage: Math.round((englishData.filter(c => c.validated).length / englishData.length) * 100)
    },
    scotland: {
      total: scottishData.length,
      validated: scottishData.filter(c => c.validated).length,
      percentage: Math.round((scottishData.filter(c => c.validated).length / scottishData.length) * 100)
    },
    wales: {
      total: welshData.length,
      validated: welshData.filter(c => c.validated).length,
      percentage: Math.round((welshData.filter(c => c.validated).length / welshData.length) * 100)
    },
    northernIreland: {
      total: niData.length,
      validated: niData.filter(c => c.validated).length,
      percentage: Math.round((niData.filter(c => c.validated).length / niData.length) * 100)
    }
  };

  const byType = {
    metropolitan: {
      total: englishCouncils.metropolitan.length,
      validated: englishCouncils.metropolitan.filter(c => c.validated).length,
      percentage: Math.round((englishCouncils.metropolitan.filter(c => c.validated).length / englishCouncils.metropolitan.length) * 100)
    },
    county: {
      total: englishCouncils.county.length,
      validated: englishCouncils.county.filter(c => c.validated).length,
      percentage: Math.round((englishCouncils.county.filter(c => c.validated).length / englishCouncils.county.length) * 100)
    },
    unitary: {
      total: englishCouncils.unitary.length,
      validated: englishCouncils.unitary.filter(c => c.validated).length,
      percentage: Math.round((englishCouncils.unitary.filter(c => c.validated).length / englishCouncils.unitary.length) * 100)
    },
    london: {
      total: englishCouncils.london.length,
      validated: englishCouncils.london.filter(c => c.validated).length,
      percentage: Math.round((englishCouncils.london.filter(c => c.validated).length / englishCouncils.london.length) * 100)
    },
    scottishUnitary: {
      total: scottishData.length,
      validated: scottishData.filter(c => c.validated).length,
      percentage: Math.round((scottishData.filter(c => c.validated).length / scottishData.length) * 100)
    },
    welshUnitary: {
      total: welshData.length,
      validated: welshData.filter(c => c.validated).length,
      percentage: Math.round((welshData.filter(c => c.validated).length / welshData.length) * 100)
    },
    niDistrict: {
      total: niData.length,
      validated: niData.filter(c => c.validated).length,
      percentage: niData.length > 0 ? Math.round((niData.filter(c => c.validated).length / niData.length) * 100) : 0
    }
  };

  const directory: LocalGovDirectory = {
    metadata: {
      title: 'UK Local Government Digital Services Directory',
      description: 'Comprehensive directory of 216 UK local government councils with validated website URLs',
      generatedAt: new Date().toISOString(),
      phase: 'Phase 6: Local Government Services Coverage Discovery',
      tasks: ['T080', 'T081', 'T082', 'T083', 'T084'],
      totalCouncils: allCouncils.length,
      validatedCouncils: validated,
      coverage: {
        england: { total: englishData.length, validated: englishData.filter(c => c.validated).length, target: 100 },
        scotland: { total: scottishData.length, validated: scottishData.filter(c => c.validated).length, target: 50 },
        wales: { total: welshData.length, validated: welshData.filter(c => c.validated).length, target: 30 },
        northernIreland: { total: niData.length, validated: niData.filter(c => c.validated).length, target: 20 }
      }
    },
    councils: {
      england: englishCouncils,
      scotland: scottishData,
      wales: welshData,
      northernIreland: niData
    },
    statistics: {
      byRegion,
      byType,
      validationStatus: {
        validated,
        unvalidated: allCouncils.length - validated,
        validationRate: Math.round((validated / allCouncils.length) * 100)
      }
    }
  };

  // Write consolidated directory
  await writeFile(
    `${baseDir}/local-gov-directory.json`,
    JSON.stringify(directory, null, 2)
  );

  // Display summary
  console.log('=== LOCAL GOVERNMENT DIRECTORY CONSOLIDATED ===\n');
  console.log(`Total Councils: ${directory.metadata.totalCouncils}`);
  console.log(`Validated: ${directory.metadata.validatedCouncils} (${directory.statistics.validationStatus.validationRate}%)\n`);

  console.log('Coverage by Region:');
  console.log(`  England: ${directory.metadata.coverage.england.total} (target: ${directory.metadata.coverage.england.target}+) ✓`);
  console.log(`  Scotland: ${directory.metadata.coverage.scotland.total} (target: ${directory.metadata.coverage.scotland.target}+) - BELOW TARGET`);
  console.log(`  Wales: ${directory.metadata.coverage.wales.total} (target: ${directory.metadata.coverage.wales.target}+) - BELOW TARGET`);
  console.log(`  Northern Ireland: ${directory.metadata.coverage.northernIreland.total} (target: ${directory.metadata.coverage.northernIreland.target}+) - BELOW TARGET\n`);

  console.log('English Council Types:');
  console.log(`  Metropolitan: ${englishCouncils.metropolitan.length} (${byType.metropolitan.validated} validated)`);
  console.log(`  County: ${englishCouncils.county.length} (${byType.county.validated} validated)`);
  console.log(`  Unitary: ${englishCouncils.unitary.length} (${byType.unitary.validated} validated)`);
  console.log(`  London Boroughs: ${englishCouncils.london.length} (${byType.london.validated} validated)\n`);

  console.log(`File written: ${baseDir}/local-gov-directory.json`);
  console.log('\nT084 Complete: UK local government directory consolidated');
}

// Execute
consolidateDirectory().catch(console.error);
