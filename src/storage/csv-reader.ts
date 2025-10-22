/**
 * CSV reader implementation (stub for TDD)
 * TODO: Implement actual CSV reading logic per T031
 */

import type { HistoricalRecord } from '../types/health-check.js';

export interface ConsecutiveFailures {
  [serviceName: string]: number;
}

export interface CsvValidationResult {
  valid: boolean;
  hasHeaders: boolean;
  corrupted?: boolean;
  fallbackSuggested?: boolean;
  empty?: boolean;
  sampleRowsParsed?: number;
  alertEmitted?: boolean;
  suggestedAction?: string;
  errors?: Array<{ row: number; message: string }>;
}

export class CsvReader {
  constructor(private filePath: string) {}

  async read(): Promise<HistoricalRecord[]> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  async readAll(): Promise<HistoricalRecord[]> {
    // Stub implementation - tests should fail (alias for read)
    throw new Error('Not implemented yet - TDD stub');
  }

  async getConsecutiveFailures(): Promise<ConsecutiveFailures> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  async validate(): Promise<CsvValidationResult> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }

  async getRecordsForService(serviceName: string, limit?: number): Promise<HistoricalRecord[]> {
    // Stub implementation - tests should fail
    throw new Error('Not implemented yet - TDD stub');
  }
}
