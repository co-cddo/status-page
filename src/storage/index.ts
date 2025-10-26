/**
 * Storage module exports
 * Provides unified access to storage abstractions, implementations, and factory
 */

// Interfaces
export type {
  IStorageWriter,
  IStorageReader,
  ICsvWriter,
  IJsonWriter,
  ICsvReader,
  IStorageFactory,
  StorageFormat,
  CsvWriterOptions,
  JsonWriterOptions,
  CsvReaderOptions,
} from './interfaces.ts';

// Implementations
export { CsvWriter } from './csv-writer.ts';
export { JsonWriter } from './json-writer.ts';
export { CsvReader } from './csv-reader.ts';
export type { ConsecutiveFailures, CsvValidationResult } from './csv-reader.ts';

// Factory
export { StorageFactory, storageFactory } from './factory.ts';
