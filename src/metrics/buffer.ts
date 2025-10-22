/**
 * Metrics buffer for queuing metrics when Prometheus is unavailable
 * Per FR-035a, FR-035b: In-memory buffer with configurable size, drop oldest when full
 */

import { logger } from '../logging/logger.js';

/**
 * Buffered metric entry
 */
export interface BufferedMetric {
  /** Metric type */
  type: 'counter' | 'histogram' | 'gauge';

  /** Metric name */
  name: string;

  /** Metric labels */
  labels: Record<string, string>;

  /** Metric value */
  value: number;

  /** Timestamp when metric was recorded */
  timestamp: Date;

  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * Metrics buffer configuration
 */
export interface MetricsBufferConfig {
  /** Maximum number of metrics to buffer (default: 1000, or METRICS_BUFFER_SIZE env var) */
  maxSize?: number;

  /** Whether to log when buffer is full and metrics are dropped (default: true) */
  logDropped?: boolean;

  /** Auto-flush interval in milliseconds (0 = disabled) */
  autoFlushInterval?: number;
}

/**
 * Metrics buffer for storing metrics when Prometheus is unavailable
 *
 * This provides resilience when the Prometheus server is temporarily unavailable
 * or when metrics are being recorded faster than they can be scraped.
 *
 * Per FR-035a: "If Prometheus telemetry endpoint is unavailable, queue metrics in memory (max METRICS_BUFFER_SIZE, default 1000)"
 * Per FR-035b: "When buffer exceeds capacity, drop oldest metrics and log warning"
 */
export class MetricsBuffer {
  private buffer: BufferedMetric[] = [];
  private readonly maxSize: number;
  private readonly logDropped: boolean;
  private droppedCount: number = 0;
  private autoFlushTimer: NodeJS.Timeout | null = null;

  constructor(config: MetricsBufferConfig = {}) {
    this.maxSize = config.maxSize ?? parseInt(process.env.METRICS_BUFFER_SIZE ?? '1000', 10);
    this.logDropped = config.logDropped ?? true;

    // Setup auto-flush if configured
    if (config.autoFlushInterval && config.autoFlushInterval > 0) {
      this.autoFlushTimer = setInterval(() => {
        this.flush();
      }, config.autoFlushInterval);
    }

    logger.debug({ maxSize: this.maxSize }, 'Metrics buffer initialized');
  }

  /**
   * Add a metric to the buffer
   *
   * If buffer is full, the oldest metric is dropped per FR-035b
   *
   * @param metric - Metric to buffer
   */
  public push(metric: BufferedMetric): void {
    // Check if buffer is full
    if (this.buffer.length >= this.maxSize) {
      // Drop oldest metric
      const dropped = this.buffer.shift();
      this.droppedCount++;

      if (this.logDropped) {
        logger.warn(
          {
            droppedMetric: dropped?.name,
            droppedTimestamp: dropped?.timestamp,
            bufferSize: this.buffer.length,
            totalDropped: this.droppedCount,
          },
          'Metrics buffer full, dropped oldest metric'
        );
      }
    }

    // Add new metric
    this.buffer.push(metric);

    logger.trace(
      {
        metric: metric.name,
        bufferSize: this.buffer.length,
        maxSize: this.maxSize,
      },
      'Metric added to buffer'
    );
  }

  /**
   * Get all buffered metrics
   *
   * @returns Array of buffered metrics
   */
  public getAll(): readonly BufferedMetric[] {
    return [...this.buffer];
  }

  /**
   * Flush the buffer and return all metrics
   *
   * This clears the buffer and returns all metrics for processing
   *
   * @returns Array of buffered metrics
   */
  public flush(): BufferedMetric[] {
    const metrics = [...this.buffer];
    this.buffer = [];

    if (metrics.length > 0) {
      logger.debug({ count: metrics.length }, 'Metrics buffer flushed');
    }

    return metrics;
  }

  /**
   * Clear the buffer without returning metrics
   */
  public clear(): void {
    const count = this.buffer.length;
    this.buffer = [];

    if (count > 0) {
      logger.debug({ count }, 'Metrics buffer cleared');
    }
  }

  /**
   * Get buffer statistics
   *
   * @returns Buffer statistics
   */
  public getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
    droppedCount: number;
  } {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      utilization: (this.buffer.length / this.maxSize) * 100,
      droppedCount: this.droppedCount,
    };
  }

  /**
   * Check if buffer is full
   *
   * @returns True if buffer is at capacity
   */
  public isFull(): boolean {
    return this.buffer.length >= this.maxSize;
  }

  /**
   * Check if buffer is empty
   *
   * @returns True if buffer has no metrics
   */
  public isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Get buffer size
   *
   * @returns Number of metrics currently buffered
   */
  public size(): number {
    return this.buffer.length;
  }

  /**
   * Get total number of dropped metrics
   *
   * @returns Total dropped count since buffer creation
   */
  public getDroppedCount(): number {
    return this.droppedCount;
  }

  /**
   * Reset dropped count
   */
  public resetDroppedCount(): void {
    this.droppedCount = 0;
  }

  /**
   * Stop auto-flush timer
   */
  public stopAutoFlush(): void {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = null;
      logger.debug('Metrics buffer auto-flush stopped');
    }
  }

  /**
   * Destroy the buffer and clean up resources
   */
  public destroy(): void {
    this.stopAutoFlush();
    this.clear();
    logger.debug('Metrics buffer destroyed');
  }
}

/**
 * Global metrics buffer instance
 */
export const metricsBuffer = new MetricsBuffer();

/**
 * Helper function to buffer a counter metric
 *
 * @param name - Metric name
 * @param labels - Metric labels
 * @param value - Counter increment value (default: 1)
 * @param correlationId - Optional correlation ID
 */
export function bufferCounter(
  name: string,
  labels: Record<string, string>,
  value: number = 1,
  correlationId?: string
): void {
  metricsBuffer.push({
    type: 'counter',
    name,
    labels,
    value,
    timestamp: new Date(),
    ...(correlationId !== undefined && { correlationId }),
  });
}

/**
 * Helper function to buffer a histogram metric
 *
 * @param name - Metric name
 * @param labels - Metric labels
 * @param value - Observation value
 * @param correlationId - Optional correlation ID
 */
export function bufferHistogram(
  name: string,
  labels: Record<string, string>,
  value: number,
  correlationId?: string
): void {
  metricsBuffer.push({
    type: 'histogram',
    name,
    labels,
    value,
    timestamp: new Date(),
    ...(correlationId !== undefined && { correlationId }),
  });
}

/**
 * Helper function to buffer a gauge metric
 *
 * @param name - Metric name
 * @param labels - Metric labels
 * @param value - Gauge value
 * @param correlationId - Optional correlation ID
 */
export function bufferGauge(
  name: string,
  labels: Record<string, string>,
  value: number,
  correlationId?: string
): void {
  metricsBuffer.push({
    type: 'gauge',
    name,
    labels,
    value,
    timestamp: new Date(),
    ...(correlationId !== undefined && { correlationId }),
  });
}
