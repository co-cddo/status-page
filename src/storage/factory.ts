/**
 * Storage factory implementation
 * Implements Factory pattern for creating storage instances
 *
 * Benefits:
 * - Runtime format selection based on configuration
 * - Centralized creation logic
 * - Easy to extend with new formats
 * - Facilitates dependency injection and testing
 */

import type {
  IStorageFactory,
  ICsvWriter,
  IJsonWriter,
  ICsvReader,
  CsvWriterOptions,
  JsonWriterOptions,
  CsvReaderOptions,
} from './interfaces.ts';
import { CsvWriter } from './csv-writer.ts';
import { JsonWriter } from './json-writer.ts';
import { CsvReader } from './csv-reader.ts';

/**
 * Storage factory class
 * Creates storage reader/writer instances based on format
 */
export class StorageFactory implements IStorageFactory {
  /**
   * Create a writer instance for the specified format
   */
  createWriter(format: 'csv', options: CsvWriterOptions): ICsvWriter;
  createWriter(format: 'json', options: JsonWriterOptions): IJsonWriter;
  createWriter(
    format: 'csv' | 'json',
    options: CsvWriterOptions | JsonWriterOptions
  ): ICsvWriter | IJsonWriter {
    switch (format) {
      case 'csv':
        return new CsvWriter((options as CsvWriterOptions).filePath);
      case 'json':
        return new JsonWriter((options as JsonWriterOptions).filePath);
      default:
        // TypeScript should prevent this, but runtime check for safety
        throw new Error(`Unsupported writer format: ${format}`);
    }
  }

  /**
   * Create a reader instance for the specified format
   */
  createReader(format: 'csv', options: CsvReaderOptions): ICsvReader;
  createReader(format: 'csv', options: CsvReaderOptions): ICsvReader {
    switch (format) {
      case 'csv':
        return new CsvReader(options.filePath);
      default:
        // TypeScript should prevent this, but runtime check for safety
        throw new Error(`Unsupported reader format: ${format}`);
    }
  }
}

/**
 * Default singleton instance for convenience
 * Can be imported and used directly: `storageFactory.createWriter('csv', { filePath: '...' })`
 */
export const storageFactory = new StorageFactory();
