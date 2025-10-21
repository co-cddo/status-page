/**
 * FileWriter Service - Generates _data/services.json for Eleventy
 * Per FR-028: JSON generation failures exit with non-zero code
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Service, ServiceStatus } from '../models/service.js';
import { sortServicesByStatus } from '../models/service.js';
import { logger } from '../lib/logger.js';

/**
 * Service status API format (for JSON output)
 * Matches OpenAPI specification in contracts/status-api.openapi.yaml
 */
export interface ServiceStatusAPI {
  name: string;
  status: ServiceStatus;
  latency_ms: number | null;
  last_check_time: string | null; // ISO 8601
  tags: string[];
  http_status_code: number | null;
  failure_reason: string;
}

/**
 * Convert Service runtime state to API format
 */
function serviceToApiFormat(service: Service): ServiceStatusAPI {
  return {
    name: service.name,
    status: service.currentStatus,
    latency_ms: service.lastLatency,
    last_check_time: service.lastCheckTime ? service.lastCheckTime.toISOString() : null,
    tags: service.tags || [],
    http_status_code: service.lastHttpStatusCode,
    failure_reason: service.lastFailureReason || '',
  };
}

/**
 * Write services data to JSON files
 * Generates both _data/services.json (for Eleventy) and _site/api/status.json (for API)
 */
export async function writeServicesData(
  services: Service[],
  dataFilePath: string,
  apiFilePath: string
): Promise<void> {
  try {
    // Sort services by status: FAIL → DEGRADED → PASS → PENDING
    const sortedServices = sortServicesByStatus(services);

    // Convert to API format
    const apiData = sortedServices.map(serviceToApiFormat);

    // Ensure directories exist
    await mkdir(dirname(dataFilePath), { recursive: true });
    await mkdir(dirname(apiFilePath), { recursive: true });

    // Write _data/services.json (for Eleventy templates)
    await writeFile(dataFilePath, JSON.stringify(apiData, null, 2), 'utf-8');

    logger.info(
      {
        filePath: dataFilePath,
        serviceCount: services.length,
      },
      'Wrote Eleventy data file'
    );

    // Write _site/api/status.json (for JSON API)
    await writeFile(apiFilePath, JSON.stringify(apiData, null, 2), 'utf-8');

    logger.info(
      {
        filePath: apiFilePath,
        serviceCount: services.length,
      },
      'Wrote JSON API file'
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        dataFilePath,
        apiFilePath,
      },
      'Failed to write services data'
    );

    // Per FR-028a: JSON generation failures exit with non-zero code
    process.exit(1);
  }
}

/**
 * Generate metadata about the status update
 */
export interface StatusMetadata {
  generatedAt: string; // ISO 8601
  totalServices: number;
  passCount: number;
  degradedCount: number;
  failCount: number;
  pendingCount: number;
}

/**
 * Generate status metadata
 */
export function generateStatusMetadata(services: Service[]): StatusMetadata {
  return {
    generatedAt: new Date().toISOString(),
    totalServices: services.length,
    passCount: services.filter((s) => s.currentStatus === 'PASS').length,
    degradedCount: services.filter((s) => s.currentStatus === 'DEGRADED').length,
    failCount: services.filter((s) => s.currentStatus === 'FAIL').length,
    pendingCount: services.filter((s) => s.currentStatus === 'PENDING').length,
  };
}
