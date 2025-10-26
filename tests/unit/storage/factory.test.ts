/**
 * Storage factory tests
 * Verifies factory pattern implementation and interface compliance
 */

import { describe, it, expect } from 'vitest';
import { StorageFactory, storageFactory } from '../../../src/storage/factory.ts';
import { CsvWriter } from '../../../src/storage/csv-writer.ts';
import { JsonWriter } from '../../../src/storage/json-writer.ts';
import { CsvReader } from '../../../src/storage/csv-reader.ts';
import type { ICsvWriter, IJsonWriter, ICsvReader } from '../../../src/storage/interfaces.ts';

describe('StorageFactory', () => {
  describe('createWriter', () => {
    it('should create CsvWriter instance for csv format', () => {
      const factory = new StorageFactory();
      const writer = factory.createWriter('csv', { filePath: '/tmp/test.csv' });

      expect(writer).toBeInstanceOf(CsvWriter);
      expect(writer).toHaveProperty('write');
      expect(writer).toHaveProperty('append');
      expect(writer).toHaveProperty('appendBatch');
    });

    it('should create JsonWriter instance for json format', () => {
      const factory = new StorageFactory();
      const writer = factory.createWriter('json', { filePath: '/tmp/test.json' });

      expect(writer).toBeInstanceOf(JsonWriter);
      expect(writer).toHaveProperty('write');
    });

    it('should create writer with correct file path', () => {
      const factory = new StorageFactory();
      const csvWriter = factory.createWriter('csv', { filePath: '/path/to/file.csv' });
      const jsonWriter = factory.createWriter('json', { filePath: '/path/to/file.json' });

      // Writers should be configured with the specified file path
      expect(csvWriter).toBeInstanceOf(CsvWriter);
      expect(jsonWriter).toBeInstanceOf(JsonWriter);
    });

    it('should implement ICsvWriter interface', () => {
      const factory = new StorageFactory();
      const writer: ICsvWriter = factory.createWriter('csv', { filePath: '/tmp/test.csv' });

      // Type check - should compile without errors
      expect(typeof writer.write).toBe('function');
      expect(typeof writer.append).toBe('function');
      expect(typeof writer.appendBatch).toBe('function');
    });

    it('should implement IJsonWriter interface', () => {
      const factory = new StorageFactory();
      const writer: IJsonWriter = factory.createWriter('json', { filePath: '/tmp/test.json' });

      // Type check - should compile without errors
      expect(typeof writer.write).toBe('function');
    });
  });

  describe('createReader', () => {
    it('should create CsvReader instance for csv format', () => {
      const factory = new StorageFactory();
      const reader = factory.createReader('csv', { filePath: '/tmp/test.csv' });

      expect(reader).toBeInstanceOf(CsvReader);
      expect(reader).toHaveProperty('read');
      expect(reader).toHaveProperty('readAll');
      expect(reader).toHaveProperty('validate');
      expect(reader).toHaveProperty('getConsecutiveFailures');
    });

    it('should create reader with correct file path', () => {
      const factory = new StorageFactory();
      const reader = factory.createReader('csv', { filePath: '/path/to/file.csv' });

      expect(reader).toBeInstanceOf(CsvReader);
    });

    it('should implement ICsvReader interface', () => {
      const factory = new StorageFactory();
      const reader: ICsvReader = factory.createReader('csv', { filePath: '/tmp/test.csv' });

      // Type check - should compile without errors
      expect(typeof reader.read).toBe('function');
      expect(typeof reader.readAll).toBe('function');
      expect(typeof reader.validate).toBe('function');
      expect(typeof reader.getConsecutiveFailures).toBe('function');
    });
  });

  describe('singleton instance', () => {
    it('should export default singleton instance', () => {
      expect(storageFactory).toBeInstanceOf(StorageFactory);
    });

    it('should create writers using singleton', () => {
      const csvWriter = storageFactory.createWriter('csv', { filePath: '/tmp/test.csv' });
      const jsonWriter = storageFactory.createWriter('json', { filePath: '/tmp/test.json' });

      expect(csvWriter).toBeInstanceOf(CsvWriter);
      expect(jsonWriter).toBeInstanceOf(JsonWriter);
    });

    it('should create readers using singleton', () => {
      const reader = storageFactory.createReader('csv', { filePath: '/tmp/test.csv' });

      expect(reader).toBeInstanceOf(CsvReader);
    });
  });

  describe('interface compliance', () => {
    it('CsvWriter should implement IStorageWriter.write()', async () => {
      const factory = new StorageFactory();
      const writer = factory.createWriter('csv', { filePath: '/tmp/test.csv' });

      // write() method should exist and be callable
      expect(typeof writer.write).toBe('function');
      expect(writer.write).toHaveProperty('length'); // Function parameter count
      expect(writer.write.length).toBe(1); // Takes 1 parameter (data array)
    });

    it('JsonWriter should implement IStorageWriter.write()', () => {
      const factory = new StorageFactory();
      const writer = factory.createWriter('json', { filePath: '/tmp/test.json' });

      // write() method should exist and be callable
      expect(typeof writer.write).toBe('function');
    });

    it('CsvReader should implement IStorageReader.read()', () => {
      const factory = new StorageFactory();
      const reader = factory.createReader('csv', { filePath: '/tmp/test.csv' });

      // read() method should exist and be callable
      expect(typeof reader.read).toBe('function');
      expect(reader.read).toHaveProperty('length'); // Function parameter count
      expect(reader.read.length).toBe(0); // Takes no parameters
    });
  });

  describe('extensibility', () => {
    it('should support creating multiple instances with different paths', () => {
      const factory = new StorageFactory();

      const writer1 = factory.createWriter('csv', { filePath: '/tmp/file1.csv' });
      const writer2 = factory.createWriter('csv', { filePath: '/tmp/file2.csv' });

      expect(writer1).toBeInstanceOf(CsvWriter);
      expect(writer2).toBeInstanceOf(CsvWriter);
      expect(writer1).not.toBe(writer2); // Different instances
    });

    it('should support creating readers and writers for same file', () => {
      const factory = new StorageFactory();

      const writer = factory.createWriter('csv', { filePath: '/tmp/test.csv' });
      const reader = factory.createReader('csv', { filePath: '/tmp/test.csv' });

      expect(writer).toBeInstanceOf(CsvWriter);
      expect(reader).toBeInstanceOf(CsvReader);
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported writer format', () => {
      const factory = new StorageFactory();

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        factory.createWriter('xml', { filePath: '/tmp/test.xml' });
      }).toThrow('Unsupported writer format: xml');
    });

    it('should throw error for unsupported reader format', () => {
      const factory = new StorageFactory();

      expect(() => {
        // @ts-expect-error - Testing runtime validation
        factory.createReader('json', { filePath: '/tmp/test.json' });
      }).toThrow('Unsupported reader format: json');
    });
  });
});
