/**
 * Storage abstraction layer interfaces
 * Enables polymorphic storage behavior and easy format extensibility
 *
 * Design Pattern: Factory + Strategy
 * Benefits:
 * - Easy to add new formats (Parquet, SQLite, Postgres)
 * - Easy to create mock implementations for testing
 * - Interface enforces consistent API
 * - Swap implementations at runtime based on config
 */

import type { HealthCheckResult, HistoricalRecord } from '../types/health-check.ts';
import type { ConsecutiveFailures, CsvValidationResult } from './csv-reader.ts';

/**
 * Base interface for storage writers
 * Supports batch write and optional single-item append
 */
export interface IStorageWriter {
  /**
   * Write multiple health check results
   * Primary method for batch operations
   */
  write(data: HealthCheckResult[]): Promise<void>;

  /**
   * Append a single health check result (optional)
   * Implementers may provide more efficient single-item append
   */
  append?(data: HealthCheckResult): Promise<void>;
}

/**
 * Base interface for storage readers
 * Supports reading all records and optionally limiting to latest N
 */
export interface IStorageReader<TRecord = HealthCheckResult | HistoricalRecord> {
  /**
   * Read all records from storage
   * Returns array of records (type depends on implementation)
   */
  read(): Promise<TRecord[]>;

  /**
   * Read latest N records (optional)
   * Implementers may provide more efficient limited reads
   */
  readLatest?(count: number): Promise<TRecord[]>;
}

/**
 * Extended interface for CSV writer
 * Maintains existing method signatures for backward compatibility
 */
export interface ICsvWriter extends IStorageWriter {
  append(result: HealthCheckResult): Promise<void>;
  appendBatch(results: HealthCheckResult[]): Promise<void>;
}

/**
 * Extended interface for JSON writer
 * Maintains existing method signature with optional tags and resources parameters
 */
export interface IJsonWriter extends IStorageWriter {
  write(
    results: HealthCheckResult[],
    tags?: Map<string, string[]>,
    resources?: Map<string, string>
  ): Promise<void>;
}

/**
 * Extended interface for CSV reader
 * Maintains existing method signatures and adds domain-specific methods
 */
export interface ICsvReader extends IStorageReader<HistoricalRecord> {
  readAll(): Promise<HistoricalRecord[]>;
  validate(): Promise<CsvValidationResult>;
  getConsecutiveFailures(): Promise<ConsecutiveFailures>;
}

/**
 * Storage format types
 */
export type StorageFormat = 'csv' | 'json';

/**
 * Writer options for different formats
 */
export interface CsvWriterOptions {
  filePath: string;
}

export interface JsonWriterOptions {
  filePath: string;
}

/**
 * Reader options for different formats
 */
export interface CsvReaderOptions {
  filePath: string;
}

/**
 * Factory interface for creating storage instances
 * Enables runtime format selection and dependency injection
 */
export interface IStorageFactory {
  /**
   * Create a writer for the specified format
   * @param format Storage format (csv | json)
   * @param options Format-specific options
   */
  createWriter(format: 'csv', options: CsvWriterOptions): ICsvWriter;
  createWriter(format: 'json', options: JsonWriterOptions): IJsonWriter;

  /**
   * Create a reader for the specified format
   * @param format Storage format (csv | json)
   * @param options Format-specific options
   */
  createReader(format: 'csv', options: CsvReaderOptions): ICsvReader;
}
