/**
 * CSV writer wrapper using fast-csv
 * Based on research.md specifications
 */

import { format } from '@fast-csv/format';
import { createWriteStream, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import type { HistoricalRecord } from '../models/historical-record.js';

export interface CsvWriterOptions {
  filePath: string;
  headers: readonly string[];
}

/**
 * CSV Writer class for appending historical records
 * Per FR-020a: CSV write failures cause process exit with non-zero code
 */
export class CsvWriter {
  private readonly filePath: string;
  private readonly headers: readonly string[];

  constructor(options: CsvWriterOptions) {
    this.filePath = options.filePath;
    this.headers = options.headers;
  }

  /**
   * Initialize CSV file with headers if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.filePath)) {
      // Create file with headers only
      const headerRow = this.headers.join(',') + '\n';
      await writeFile(this.filePath, headerRow, 'utf-8');
    }
  }

  /**
   * Append a single record to the CSV file
   * Per FR-020a: Failures cause process exit
   */
  async appendRecord(record: HistoricalRecord): Promise<void> {
    return this.appendRecords([record]);
  }

  /**
   * Append multiple records to the CSV file
   * Per FR-020a: Failures cause process exit
   */
  async appendRecords(records: HistoricalRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileStream = createWriteStream(this.filePath, { flags: 'a' });

      // Create CSV formatter with headers but don't write them (append mode)
      const csvStream = format({
        headers: [...this.headers] as unknown as boolean | string[],
        writeHeaders: false,
        includeEndRowDelimiter: true,
      });

      csvStream.pipe(fileStream);

      csvStream.on('error', (error: Error) => {
        fileStream.destroy();
        reject(error);
      });

      fileStream.on('error', (error: Error) => {
        csvStream.destroy();
        reject(error);
      });

      fileStream.on('finish', () => {
        resolve();
      });

      // Write all records
      for (const record of records) {
        csvStream.write(record);
      }

      csvStream.end();
    });
  }

  /**
   * Check if CSV file exists
   */
  fileExists(): boolean {
    return existsSync(this.filePath);
  }
}

/**
 * Create a CSV writer for historical records
 */
export function createHistoricalCsvWriter(filePath: string): CsvWriter {
  // Import CSV_HEADERS constant
  const CSV_HEADERS = [
    'timestamp',
    'service_name',
    'status',
    'latency_ms',
    'http_status_code',
    'failure_reason',
    'correlation_id',
  ] as const;

  return new CsvWriter({
    filePath,
    headers: CSV_HEADERS,
  });
}
