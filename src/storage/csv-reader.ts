/**
 * CSV reader implementation
 * T031: Implement CSV reader for historical health check data
 *
 * Requirements:
 * - Read history.csv
 * - Validate format (headers present, parse sample rows)
 * - Derive consecutive failure count from consecutive FAIL statuses per service
 * - Handle corrupted CSV (log error, emit alert, return validation errors)
 * - Verify fallback to next tier on corruption
 * - Handle empty CSV file
 */

import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { HistoricalRecord } from '../types/health-check.js';
import { parseCsvLine, isValidStatus, CSV_HEADERS } from '../utils/csv.js';

export interface ConsecutiveFailures {
  [serviceName: string]: number;
}

export interface CsvValidationResult {
  valid: boolean;
  hasHeaders: boolean;
  corrupted?: boolean;
  fallbackSuggested?: boolean;
  empty?: boolean;
  sampleRowsParsed?: boolean;
  alertEmitted?: boolean;
  suggestedAction?: string;
  errors?: string[];
}

const EXPECTED_HEADERS = CSV_HEADERS;

export class CsvReader {
  constructor(private filePath: string) {}

  /**
   * Reads and parses the CSV file
   * Returns array of HistoricalRecord objects
   */
  async readAll(): Promise<HistoricalRecord[]> {
    try {
      // Check if file exists
      const exists = await this.fileExists();
      if (!exists) {
        throw new Error(`CSV file not found: ${this.filePath}`);
      }

      // Read file content
      const content = await readFile(this.filePath, 'utf-8');

      // Handle empty file
      if (content.trim() === '') {
        return [];
      }

      // Parse CSV using RFC 4180-compliant line splitting
      const lines = this.splitCsvLines(content);

      if (lines.length === 0) {
        return [];
      }

      // Validate and skip header row
      const headerLine = lines[0];
      if (!headerLine) {
        console.error('CSV file has no header row');
        return [];
      }
      const headers = headerLine.split(',').map(h => h.trim());
      if (!this.validateHeaders(headers)) {
        console.error(`CSV headers invalid. Expected: ${EXPECTED_HEADERS.join(',')}`);
        return [];
      }

      // Parse data rows
      const records: HistoricalRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const line = lines[i];
          if (!line) continue;
          const record = this.parseRow(line);
          if (record) {
            records.push(record);
          }
        } catch (error) {
          console.error(`Error parsing CSV row ${i + 1}: ${error}`);
          // Continue parsing other rows
        }
      }

      return records;

    } catch (error) {
      // Re-throw errors instead of suppressing them
      // This ensures missing file errors and other critical errors are not silently ignored
      throw error;
    }
  }

  /**
   * Validates CSV file format
   * Returns validation result with details
   */
  async validate(): Promise<CsvValidationResult> {
    try {
      // Check if file exists
      const exists = await this.fileExists();
      if (!exists) {
        return {
          valid: false,
          hasHeaders: false,
          empty: true,
          suggestedAction: 'Create new CSV file',
        };
      }

      // Read file content
      const content = await readFile(this.filePath, 'utf-8');

      // Handle empty file
      if (content.trim() === '') {
        return {
          valid: false,
          hasHeaders: false,
          empty: true,
        };
      }

      // Parse CSV using RFC 4180-compliant line splitting
      const lines = this.splitCsvLines(content);

      if (lines.length === 0) {
        return {
          valid: false,
          hasHeaders: false,
          empty: true,
        };
      }

      // Validate headers
      const headerLine = lines[0];
      if (!headerLine) {
        return {
          valid: false,
          hasHeaders: false,
          empty: true,
        };
      }
      const headers = headerLine.split(',').map(h => h.trim());
      const hasValidHeaders = this.validateHeaders(headers);

      if (!hasValidHeaders) {
        // Check if headers exist but in wrong order
        const hasAllHeaders = EXPECTED_HEADERS.every(expected => headers.includes(expected));
        const errorMessage = hasAllHeaders && headers.length === EXPECTED_HEADERS.length
          ? `Invalid header order: expected ${EXPECTED_HEADERS.join(',')}, got ${headers.join(',')}`
          : `Invalid headers: expected ${EXPECTED_HEADERS.join(',')}, got ${headers.join(',')}`;

        return {
          valid: false,
          hasHeaders: false,
          corrupted: true,
          fallbackSuggested: true,
          alertEmitted: true,
          suggestedAction: 'Headers invalid - fallback to next tier',
          errors: [errorMessage],
        };
      }

      // Parse sample rows (first 10 or all if less)
      const sampleSize = Math.min(10, lines.length - 1);
      let sampleRowsParsed = 0;
      const errors: string[] = [];

      for (let i = 1; i <= sampleSize; i++) {
        try {
          const line = lines[i];
          if (!line) continue;

          const record = this.parseRow(line);
          if (record) {
            sampleRowsParsed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          // Check if error indicates malformed data
          if (errorMessage.includes('Invalid') || errorMessage.includes('column')) {
            errors.push(`Row ${i + 1}: malformed - ${errorMessage}`);
          } else {
            errors.push(`Row ${i + 1}: ${errorMessage}`);
          }
        }
      }

      // If all sample rows failed to parse, CSV is corrupted
      if (sampleRowsParsed === 0 && sampleSize > 0) {
        return {
          valid: false,
          hasHeaders: true,
          corrupted: true,
          fallbackSuggested: true,
          alertEmitted: true,
          sampleRowsParsed: false,
          errors,
          suggestedAction: 'CSV corrupted - fallback to next tier',
        };
      }

      // If ANY errors occurred during validation, mark as invalid
      if (errors.length > 0) {
        return {
          valid: false,
          hasHeaders: true,
          corrupted: true,
          fallbackSuggested: true,
          alertEmitted: true,
          sampleRowsParsed: false,
          errors,
          suggestedAction: 'CSV contains malformed rows - fallback to next tier',
        };
      }

      return {
        valid: true,
        hasHeaders: true,
        empty: false,
        sampleRowsParsed: true,
      };

    } catch (error) {
      return {
        valid: false,
        hasHeaders: false,
        corrupted: true,
        fallbackSuggested: true,
        suggestedAction: `Read error: ${error}`,
      };
    }
  }

  /**
   * Derives consecutive failure count for each service
   * Counts consecutive FAIL statuses from most recent records
   */
  async getConsecutiveFailures(): Promise<ConsecutiveFailures> {
    const records = await this.readAll();
    const failures: ConsecutiveFailures = {};

    // Group records by service
    const byService: { [key: string]: HistoricalRecord[] } = {};

    for (const record of records) {
      const serviceName = record.service_name;
      if (!byService[serviceName]) {
        byService[serviceName] = [];
      }
      // TypeScript now knows this exists due to check above
      byService[serviceName]!.push(record);
    }

    // For each service, count consecutive failures from most recent
    for (const [serviceName, serviceRecords] of Object.entries(byService)) {
      // Sort by timestamp descending (most recent first)
      serviceRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Count consecutive failures from the start
      let consecutiveCount = 0;
      for (const record of serviceRecords) {
        if (record.status === 'FAIL') {
          consecutiveCount++;
        } else {
          break; // Stop at first non-failure
        }
      }

      failures[serviceName] = consecutiveCount;
    }

    return failures;
  }

  /**
   * Splits CSV content into lines respecting RFC 4180 quoted fields
   * Newlines inside quoted fields are preserved as part of the field value
   */
  private splitCsvLines(content: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];
      const next = content[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          // Double quote - add both quotes to line
          currentLine += '""';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          currentLine += char;
          i++;
        }
      } else if (char === '\n' && !inQuotes) {
        // End of line (outside quotes)
        if (currentLine.trim() !== '') {
          lines.push(currentLine);
        }
        currentLine = '';
        i++;
      } else if (char === '\r' && next === '\n' && !inQuotes) {
        // Windows line ending (outside quotes)
        if (currentLine.trim() !== '') {
          lines.push(currentLine);
        }
        currentLine = '';
        i += 2;
      } else if (char === '\r' && !inQuotes) {
        // Mac line ending (outside quotes)
        if (currentLine.trim() !== '') {
          lines.push(currentLine);
        }
        currentLine = '';
        i++;
      } else {
        currentLine += char;
        i++;
      }
    }

    // Add final line if not empty
    if (currentLine.trim() !== '') {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Checks if file exists
   */
  private async fileExists(): Promise<boolean> {
    try {
      await access(this.filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates CSV headers match expected format
   */
  private validateHeaders(headers: string[]): boolean {
    if (headers.length !== EXPECTED_HEADERS.length) {
      return false;
    }

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const expectedHeader = EXPECTED_HEADERS[i];
      if (!header || !expectedHeader || header !== expectedHeader) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parses a single CSV row into HistoricalRecord
   * Handles RFC 4180 quoted values
   */
  private parseRow(line: string): HistoricalRecord | null {
    const values = parseCsvLine(line);

    if (values.length !== 7) {
      throw new Error(`Invalid number of columns: expected 7, got ${values.length}`);
    }

    // Destructure with type safety checks
    const timestamp = values[0];
    const service_name = values[1];
    const status = values[2];
    const latency_ms = values[3];
    const http_status_code = values[4];
    const failure_reason = values[5];
    const correlation_id = values[6];

    // Validate all required fields are present (failure_reason can be empty string)
    if (!timestamp || !service_name || !status || !latency_ms || !http_status_code || failure_reason === undefined || !correlation_id) {
      throw new Error('Missing required field');
    }

    // Validate status using type guard from utils
    if (!isValidStatus(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Parse numbers
    const latency = parseInt(latency_ms, 10);
    const httpCode = parseInt(http_status_code, 10);

    if (isNaN(latency)) {
      throw new Error(`Invalid latency_ms value: ${latency_ms}`);
    }
    if (isNaN(httpCode)) {
      throw new Error(`Invalid http_status_code value: ${http_status_code}`);
    }

    return {
      timestamp,
      service_name,
      status, // TypeScript now knows this is the correct type thanks to isValidStatus type guard
      latency_ms: latency,
      http_status_code: httpCode,
      failure_reason,
      correlation_id,
    };
  }
}
