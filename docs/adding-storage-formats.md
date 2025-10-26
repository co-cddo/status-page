# Adding New Storage Formats

This guide explains how to add support for new storage formats (e.g., Parquet, SQLite, PostgreSQL)
to the GOV.UK Public Services Status Monitor.

## Overview

The storage abstraction layer uses the **Factory + Strategy** design patterns to enable easy
extensibility. All storage implementations conform to common interfaces, making it straightforward
to add new formats without modifying existing code.

## Architecture

```
src/storage/
├── interfaces.ts       # Interface definitions
├── factory.ts          # Factory for creating instances
├── csv-writer.ts       # CSV writer implementation
├── json-writer.ts      # JSON writer implementation
├── csv-reader.ts       # CSV reader implementation
└── index.ts            # Public exports
```

## Step 1: Define Your Implementation

Create a new file in `src/storage/` for your format (e.g., `parquet-writer.ts`).

### Writer Implementation

Implement the `IStorageWriter` interface:

```typescript
import type { HealthCheckResult } from '../types/health-check.ts';
import type { IStorageWriter } from './interfaces.ts';

export class ParquetWriter implements IStorageWriter {
  constructor(private filePath: string) {}

  /**
   * Write multiple health check results (required)
   * This is the primary method for batch operations
   */
  async write(data: HealthCheckResult[]): Promise<void> {
    // Your implementation here
    // - Open/create Parquet file
    // - Write schema
    // - Write records
    // - Handle errors appropriately
  }

  /**
   * Append a single health check result (optional)
   * Provide this if your format supports efficient single-record appends
   */
  async append(data: HealthCheckResult): Promise<void> {
    // Optional: Provide optimized single-record append
    // Or delegate to write(): return this.write([data]);
  }
}
```

### Reader Implementation

Implement the `IStorageReader<TRecord>` interface:

```typescript
import type { HistoricalRecord } from '../types/health-check.ts';
import type { IStorageReader } from './interfaces.ts';

export class ParquetReader implements IStorageReader<HistoricalRecord> {
  constructor(private filePath: string) {}

  /**
   * Read all records from storage (required)
   */
  async read(): Promise<HistoricalRecord[]> {
    // Your implementation here
    // - Open Parquet file
    // - Read schema
    // - Parse all records
    // - Return as HistoricalRecord array
  }

  /**
   * Read latest N records (optional)
   * Provide this if your format supports efficient limited reads
   */
  async readLatest(count: number): Promise<HistoricalRecord[]> {
    // Optional: Provide optimized limited read
    // Or delegate to read(): return (await this.read()).slice(-count);
  }
}
```

## Step 2: Extend the Interface (Optional)

If your format has format-specific methods, extend the base interface:

```typescript
// In src/storage/interfaces.ts

export interface IParquetWriter extends IStorageWriter {
  write(data: HealthCheckResult[], options?: ParquetWriteOptions): Promise<void>;
  append(data: HealthCheckResult): Promise<void>;
  getSchema(): ParquetSchema; // Format-specific method
}

export interface IParquetReader extends IStorageReader<HistoricalRecord> {
  read(): Promise<HistoricalRecord[]>;
  readLatest(count: number): Promise<HistoricalRecord[]>;
  getMetadata(): ParquetMetadata; // Format-specific method
}
```

## Step 3: Update the Factory

Add support for your format in `src/storage/factory.ts`:

```typescript
import { ParquetWriter } from './parquet-writer.ts';
import { ParquetReader } from './parquet-reader.ts';

export class StorageFactory implements IStorageFactory {
  createWriter(format: 'csv', options: CsvWriterOptions): ICsvWriter;
  createWriter(format: 'json', options: JsonWriterOptions): IJsonWriter;
  createWriter(format: 'parquet', options: ParquetWriterOptions): IParquetWriter; // Add this
  createWriter(
    format: 'csv' | 'json' | 'parquet', // Add 'parquet'
    options: CsvWriterOptions | JsonWriterOptions | ParquetWriterOptions
  ): ICsvWriter | IJsonWriter | IParquetWriter {
    switch (format) {
      case 'csv':
        return new CsvWriter((options as CsvWriterOptions).filePath);
      case 'json':
        return new JsonWriter((options as JsonWriterOptions).filePath);
      case 'parquet': // Add this case
        return new ParquetWriter((options as ParquetWriterOptions).filePath);
      default:
        throw new Error(`Unsupported writer format: ${format}`);
    }
  }

  createReader(format: 'csv', options: CsvReaderOptions): ICsvReader;
  createReader(format: 'parquet', options: ParquetReaderOptions): IParquetReader; // Add this
  createReader(
    format: 'csv' | 'parquet', // Add 'parquet'
    options: CsvReaderOptions | ParquetReaderOptions
  ): ICsvReader | IParquetReader {
    switch (format) {
      case 'csv':
        return new CsvReader(options.filePath);
      case 'parquet': // Add this case
        return new ParquetReader(options.filePath);
      default:
        throw new Error(`Unsupported reader format: ${format}`);
    }
  }
}
```

## Step 4: Update Exports

Export your new classes in `src/storage/index.ts`:

```typescript
// Interfaces
export type {
  IParquetWriter,
  IParquetReader,
  ParquetWriterOptions,
  ParquetReaderOptions,
} from './interfaces.ts';

// Implementations
export { ParquetWriter } from './parquet-writer.ts';
export { ParquetReader } from './parquet-reader.ts';
```

## Step 5: Write Comprehensive Tests

Create test files following the TDD approach:

### Unit Tests

```typescript
// tests/unit/storage/parquet-writer.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParquetWriter } from '../../../src/storage/parquet-writer.ts';
import type { HealthCheckResult } from '../../../src/types/health-check.ts';

describe('ParquetWriter', () => {
  describe('write()', () => {
    it('should write health check results to Parquet file', async () => {
      // Test implementation
    });

    it('should handle empty arrays', async () => {
      // Test implementation
    });

    it('should preserve all fields', async () => {
      // Test implementation
    });
  });

  describe('append()', () => {
    it('should append single health check result', async () => {
      // Test implementation
    });
  });
});
```

### Factory Tests

```typescript
// tests/unit/storage/factory.test.ts

describe('StorageFactory', () => {
  it('should create ParquetWriter instance for parquet format', () => {
    const factory = new StorageFactory();
    const writer = factory.createWriter('parquet', { filePath: '/tmp/test.parquet' });

    expect(writer).toBeInstanceOf(ParquetWriter);
    expect(writer).toHaveProperty('write');
    expect(writer).toHaveProperty('append');
  });

  it('should create ParquetReader instance for parquet format', () => {
    const factory = new StorageFactory();
    const reader = factory.createReader('parquet', { filePath: '/tmp/test.parquet' });

    expect(reader).toBeInstanceOf(ParquetReader);
    expect(reader).toHaveProperty('read');
  });
});
```

## Step 6: Update Configuration (if needed)

If your format requires configuration options, update `config.yaml` schema:

```yaml
settings:
  storage_format: 'csv' # Add 'parquet' as an option
  storage_options:
    compression: 'gzip' # Parquet-specific options
    row_group_size: 1000
```

## Step 7: Update Documentation

Update relevant documentation:

- `CLAUDE.md`: Add format to supported formats list
- `quickstart.md`: Add installation instructions for format-specific dependencies
- `README.md`: Add format to features list

## Example: SQLite Storage

Here's a complete example for SQLite storage:

```typescript
// src/storage/sqlite-writer.ts

import Database from 'better-sqlite3';
import type { HealthCheckResult } from '../types/health-check.ts';
import type { IStorageWriter } from './interfaces.ts';

export class SqliteWriter implements IStorageWriter {
  private db: Database.Database;

  constructor(private filePath: string) {
    this.db = new Database(filePath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS health_checks (
        timestamp TEXT NOT NULL,
        service_name TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        http_status_code INTEGER NOT NULL,
        failure_reason TEXT,
        correlation_id TEXT NOT NULL,
        PRIMARY KEY (timestamp, service_name)
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_service ON health_checks(service_name)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_timestamp ON health_checks(timestamp DESC)`);
  }

  async write(data: HealthCheckResult[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO health_checks
      (timestamp, service_name, status, latency_ms, http_status_code, failure_reason, correlation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((records: HealthCheckResult[]) => {
      for (const record of records) {
        insert.run(
          record.timestamp.toISOString(),
          record.serviceName,
          record.status === 'PENDING' ? 'FAIL' : record.status,
          record.latency_ms,
          record.http_status_code,
          record.failure_reason || '',
          record.correlation_id
        );
      }
    });

    insertMany(data);
  }

  async append(data: HealthCheckResult): Promise<void> {
    return this.write([data]);
  }

  close(): void {
    this.db.close();
  }
}
```

## Best Practices

1. **Error Handling**: Always handle errors appropriately and provide clear error messages
2. **Type Safety**: Use TypeScript interfaces to ensure type safety
3. **Testing**: Achieve 80%+ code coverage with unit and integration tests
4. **Performance**: Consider performance implications for large datasets
5. **Backward Compatibility**: Ensure changes don't break existing code
6. **Documentation**: Document format-specific behavior and limitations
7. **Schema Validation**: Validate data conforms to expected schema
8. **Resource Cleanup**: Properly close connections and file handles

## Benefits of the Abstraction Layer

- **Consistency**: All formats follow the same interface
- **Testability**: Easy to create mock implementations
- **Flexibility**: Swap implementations at runtime
- **Extensibility**: Add new formats without modifying existing code
- **Type Safety**: TypeScript enforces interface compliance

## Support

For questions or issues:

- Review existing implementations in `src/storage/`
- Consult the test files in `tests/unit/storage/`
- See the architecture documentation in `CLAUDE.md`
