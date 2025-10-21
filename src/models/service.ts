/**
 * Service model with runtime state properties
 * Based on data-model.md specifications
 */

import type { ServiceDefinition } from './configuration.js';

export type ServiceStatus = 'PENDING' | 'PASS' | 'DEGRADED' | 'FAIL';

/**
 * Runtime service state (extends ServiceDefinition with runtime properties)
 */
export interface Service extends ServiceDefinition {
  currentStatus: ServiceStatus;
  lastCheckTime: Date | null;
  lastLatency: number | null; // milliseconds
  consecutiveFailures: number; // For implementing 2-failure threshold (FR-015a)
  lastHttpStatusCode: number | null;
  lastFailureReason: string | null;
}

/**
 * Create a new service with initial PENDING state
 */
export function createService(definition: ServiceDefinition): Service {
  return {
    ...definition,
    currentStatus: 'PENDING',
    lastCheckTime: null,
    lastLatency: null,
    consecutiveFailures: 0,
    lastHttpStatusCode: null,
    lastFailureReason: null,
  };
}

/**
 * Determine if service should be displayed as DOWN on HTML
 * Per FR-015a: Requires 2 consecutive check cycle failures
 */
export function shouldDisplayAsDown(service: Service): boolean {
  return service.currentStatus === 'FAIL' && service.consecutiveFailures >= 2;
}

/**
 * Sort services by status priority: FAIL → DEGRADED → PASS → PENDING
 */
export function sortServicesByStatus(services: Service[]): Service[] {
  const statusPriority: Record<ServiceStatus, number> = {
    FAIL: 0,
    DEGRADED: 1,
    PASS: 2,
    PENDING: 3,
  };

  return [...services].sort((a, b) => {
    return statusPriority[a.currentStatus] - statusPriority[b.currentStatus];
  });
}

/**
 * Separate services into tagged and untagged groups
 * Per FR-024a: Services without tags appear in "Untagged Services" section
 */
export function separateByTags(services: Service[]): {
  tagged: Service[];
  untagged: Service[];
} {
  const tagged: Service[] = [];
  const untagged: Service[] = [];

  for (const service of services) {
    if (service.tags && service.tags.length > 0) {
      tagged.push(service);
    } else {
      untagged.push(service);
    }
  }

  return { tagged, untagged };
}
