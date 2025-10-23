/**
 * Eleventy data transformer for health.json
 *
 * The orchestrator writes _data/health.json as a plain array per OpenAPI spec,
 * but templates expect a wrapper object with generatedAt and services.
 * This data file transforms the array into the expected structure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function () {
  try {
    // Read the plain array from health.json
    const healthJsonPath = join(__dirname, 'health.json');
    const servicesArray = JSON.parse(readFileSync(healthJsonPath, 'utf-8'));

    // Transform into template-expected format
    return {
      generatedAt: new Date().toISOString(),
      services: Array.isArray(servicesArray) ? servicesArray : [],
    };
  } catch (error) {
    // If health.json doesn't exist yet (e.g., on first build), return empty state
    console.warn('health.json not found or invalid, using empty state');
    return {
      generatedAt: new Date().toISOString(),
      services: [],
    };
  }
}
