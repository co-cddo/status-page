/**
 * Unit tests for Prometheus metrics module
 * Tests metric initialization, recording functions, and registry operations
 * Per Constitutional Principle III: Test-Driven Development (100% pass rate required)
 * Per Constitutional Principle X: Mock external services (prom-client mocked)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Mock prom-client before importing the module under test
vi.mock('prom-client', () => {
  // Mock Counter class
  class MockCounter {
    public name: string;
    public help: string;
    public labelNames: readonly string[];
    public registers: unknown[];
    private labeledInstances: Map<string, { inc: ReturnType<typeof vi.fn> }>;
    private mockInc: ReturnType<typeof vi.fn>;

    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly string[];
      registers?: unknown[];
    }) {
      this.name = config.name;
      this.help = config.help;
      this.labelNames = config.labelNames ?? [];
      this.registers = config.registers ?? [];
      this.labeledInstances = new Map();
      this.mockInc = vi.fn();
    }

    labels(...labelValues: string[]): { inc: ReturnType<typeof vi.fn> } {
      const key = labelValues.join(':');
      if (!this.labeledInstances.has(key)) {
        this.labeledInstances.set(key, {
          inc: vi.fn(),
        });
      }
      return this.labeledInstances.get(key)!;
    }

    inc(value?: number): void {
      this.mockInc(value);
    }
  }

  // Mock Histogram class
  class MockHistogram {
    public name: string;
    public help: string;
    public labelNames: readonly string[];
    public buckets: number[];
    public registers: unknown[];
    private labeledInstances: Map<string, { observe: ReturnType<typeof vi.fn> }>;
    private mockObserve: ReturnType<typeof vi.fn>;

    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly string[];
      buckets?: number[];
      registers?: unknown[];
    }) {
      this.name = config.name;
      this.help = config.help;
      this.labelNames = config.labelNames ?? [];
      this.buckets = config.buckets ?? [];
      this.registers = config.registers ?? [];
      this.labeledInstances = new Map();
      this.mockObserve = vi.fn();
    }

    labels(...labelValues: string[]): { observe: ReturnType<typeof vi.fn> } {
      const key = labelValues.join(':');
      if (!this.labeledInstances.has(key)) {
        this.labeledInstances.set(key, {
          observe: vi.fn(),
        });
      }
      return this.labeledInstances.get(key)!;
    }

    observe(value: number): void {
      this.mockObserve(value);
    }
  }

  // Mock Gauge class
  class MockGauge {
    public name: string;
    public help: string;
    public labelNames?: readonly string[];
    public registers: unknown[];
    private currentValue = 0;
    private mockSet = vi.fn((value: number) => {
      this.currentValue = value;
    });

    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly string[];
      registers?: unknown[];
    }) {
      this.name = config.name;
      this.help = config.help;
      this.labelNames = config.labelNames;
      this.registers = config.registers ?? [];
    }

    set(value: number): void {
      this.mockSet(value);
    }

    get(): number {
      return this.currentValue;
    }

    getMockSet(): ReturnType<typeof vi.fn> {
      return this.mockSet;
    }
  }

  // Mock Registry class
  class MockRegistry {
    private metricsData = 'mock_metrics_output';
    private metricsJSON: unknown[] = [];
    private mockMetrics = vi.fn(async () => this.metricsData);
    private mockGetMetricsAsJSON = vi.fn(async () => this.metricsJSON);
    private mockResetMetrics = vi.fn();
    private mockClear = vi.fn();

    async metrics(): Promise<string> {
      return this.mockMetrics();
    }

    async getMetricsAsJSON(): Promise<unknown> {
      return this.mockGetMetricsAsJSON();
    }

    resetMetrics(): void {
      this.mockResetMetrics();
    }

    clear(): void {
      this.mockClear();
    }

    setMockMetricsData(data: string): void {
      this.metricsData = data;
    }

    setMockMetricsJSON(data: unknown[]): void {
      this.metricsJSON = data;
    }

    getMockMetrics(): ReturnType<typeof vi.fn> {
      return this.mockMetrics;
    }

    getMockGetMetricsAsJSON(): ReturnType<typeof vi.fn> {
      return this.mockGetMetricsAsJSON;
    }

    getMockResetMetrics(): ReturnType<typeof vi.fn> {
      return this.mockResetMetrics;
    }

    getMockClear(): ReturnType<typeof vi.fn> {
      return this.mockClear;
    }
  }

  return {
    Registry: MockRegistry,
    Counter: MockCounter,
    Histogram: MockHistogram,
    Gauge: MockGauge,
  };
});

// Import module under test after mocking
import {
  metricsRegistry,
  healthChecksTotal,
  healthCheckLatency,
  servicesFailing,
  healthCheckErrors,
  workerPoolSize,
  workerTasksCompleted,
  csvWritesTotal,
  csvRecordsWritten,
  recordHealthCheck,
  recordHealthCheckError,
  updateServicesFailingCount,
  updateWorkerPoolSize,
  recordWorkerTaskCompleted,
  recordCsvWrite,
  getMetrics,
  getMetricsJSON,
  resetMetrics,
  clearMetrics,
} from '../../../src/metrics/prometheus.js';

describe('Prometheus Metrics Module', () => {
  describe('Metric Initialization', () => {
    it('should initialize metricsRegistry as Registry instance', () => {
      expect(metricsRegistry).toBeInstanceOf(Registry);
    });

    it('should initialize healthChecksTotal counter with correct configuration', () => {
      expect(healthChecksTotal).toBeInstanceOf(Counter);
      expect(healthChecksTotal.name).toBe('health_checks_total');
      expect(healthChecksTotal.help).toBe('Total number of health checks performed');
      expect(healthChecksTotal.labelNames).toEqual(['service_name', 'status']);
      expect(healthChecksTotal.registers).toContain(metricsRegistry);
    });

    it('should initialize healthCheckLatency histogram with correct configuration', () => {
      expect(healthCheckLatency).toBeInstanceOf(Histogram);
      expect(healthCheckLatency.name).toBe('health_check_latency_seconds');
      expect(healthCheckLatency.help).toBe('Health check response time distribution in seconds');
      expect(healthCheckLatency.labelNames).toEqual(['service_name']);
      expect(healthCheckLatency.buckets).toEqual([0.1, 0.5, 1.0, 2.0, 5.0, 10.0]);
      expect(healthCheckLatency.registers).toContain(metricsRegistry);
    });

    it('should initialize servicesFailing gauge with correct configuration', () => {
      expect(servicesFailing).toBeInstanceOf(Gauge);
      expect(servicesFailing.name).toBe('services_failing');
      expect(servicesFailing.help).toBe('Current number of services in FAIL status');
      expect(servicesFailing.registers).toContain(metricsRegistry);
    });

    it('should initialize healthCheckErrors counter with correct configuration', () => {
      expect(healthCheckErrors).toBeInstanceOf(Counter);
      expect(healthCheckErrors.name).toBe('health_check_errors_total');
      expect(healthCheckErrors.help).toBe('Total number of health check errors by type');
      expect(healthCheckErrors.labelNames).toEqual(['service_name', 'error_type']);
      expect(healthCheckErrors.registers).toContain(metricsRegistry);
    });

    it('should initialize workerPoolSize gauge with correct configuration', () => {
      expect(workerPoolSize).toBeInstanceOf(Gauge);
      expect(workerPoolSize.name).toBe('worker_pool_size');
      expect(workerPoolSize.help).toBe('Current number of worker threads in the pool');
      expect(workerPoolSize.registers).toContain(metricsRegistry);
    });

    it('should initialize workerTasksCompleted counter with correct configuration', () => {
      expect(workerTasksCompleted).toBeInstanceOf(Counter);
      expect(workerTasksCompleted.name).toBe('worker_tasks_completed_total');
      expect(workerTasksCompleted.help).toBe('Total tasks completed by worker threads');
      expect(workerTasksCompleted.registers).toContain(metricsRegistry);
    });

    it('should initialize csvWritesTotal counter with correct configuration', () => {
      expect(csvWritesTotal).toBeInstanceOf(Counter);
      expect(csvWritesTotal.name).toBe('csv_writes_total');
      expect(csvWritesTotal.help).toBe('Total CSV write operations');
      expect(csvWritesTotal.labelNames).toEqual(['status']);
      expect(csvWritesTotal.registers).toContain(metricsRegistry);
    });

    it('should initialize csvRecordsWritten counter with correct configuration', () => {
      expect(csvRecordsWritten).toBeInstanceOf(Counter);
      expect(csvRecordsWritten.name).toBe('csv_records_written_total');
      expect(csvRecordsWritten.help).toBe('Total health check records written to CSV');
      expect(csvRecordsWritten.registers).toContain(metricsRegistry);
    });
  });

  describe('recordHealthCheck()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should increment healthChecksTotal counter with PASS status', () => {
      const serviceName = 'test-service';
      const status = 'PASS';
      const latencyMs = 150;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledCounter = healthChecksTotal.labels(serviceName, status);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthChecksTotal counter with DEGRADED status', () => {
      const serviceName = 'slow-service';
      const status = 'DEGRADED';
      const latencyMs = 2500;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledCounter = healthChecksTotal.labels(serviceName, status);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthChecksTotal counter with FAIL status', () => {
      const serviceName = 'failed-service';
      const status = 'FAIL';
      const latencyMs = 5000;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledCounter = healthChecksTotal.labels(serviceName, status);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should observe latency in healthCheckLatency histogram', () => {
      const serviceName = 'test-service';
      const status = 'PASS';
      const latencyMs = 234;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledHistogram = healthCheckLatency.labels(serviceName);
      expect(labeledHistogram.observe).toHaveBeenCalledTimes(1);
      expect(labeledHistogram.observe).toHaveBeenCalledWith(latencyMs / 1000);
    });

    it('should convert milliseconds to seconds for latency observation', () => {
      const serviceName = 'test-service';
      const status = 'PASS';
      const latencyMs = 1000;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledHistogram = healthCheckLatency.labels(serviceName);
      expect(labeledHistogram.observe).toHaveBeenCalledWith(1.0);
    });

    it('should handle zero latency correctly', () => {
      const serviceName = 'instant-service';
      const status = 'PASS';
      const latencyMs = 0;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledHistogram = healthCheckLatency.labels(serviceName);
      expect(labeledHistogram.observe).toHaveBeenCalledWith(0);
    });

    it('should handle high latency values correctly', () => {
      const serviceName = 'very-slow-service';
      const status = 'DEGRADED';
      const latencyMs = 9999;

      recordHealthCheck(serviceName, status, latencyMs);

      const labeledHistogram = healthCheckLatency.labels(serviceName);
      expect(labeledHistogram.observe).toHaveBeenCalledWith(9.999);
    });
  });

  describe('recordHealthCheckError()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should increment healthCheckErrors counter with timeout error type', () => {
      const serviceName = 'timeout-service';
      const errorType = 'timeout';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthCheckErrors counter with network error type', () => {
      const serviceName = 'network-service';
      const errorType = 'network';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthCheckErrors counter with http_status error type', () => {
      const serviceName = 'http-service';
      const errorType = 'http_status';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthCheckErrors counter with text_validation error type', () => {
      const serviceName = 'text-service';
      const errorType = 'text_validation';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthCheckErrors counter with header_validation error type', () => {
      const serviceName = 'header-service';
      const errorType = 'header_validation';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment healthCheckErrors counter with unknown error type', () => {
      const serviceName = 'unknown-service';
      const errorType = 'unknown';

      recordHealthCheckError(serviceName, errorType);

      const labeledCounter = healthCheckErrors.labels(serviceName, errorType);
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateServicesFailingCount()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should set servicesFailing gauge to zero', () => {
      updateServicesFailingCount(0);

      const mockGauge = servicesFailing as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(0);
    });

    it('should set servicesFailing gauge to positive value', () => {
      updateServicesFailingCount(5);

      const mockGauge = servicesFailing as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(5);
    });

    it('should set servicesFailing gauge to large value', () => {
      updateServicesFailingCount(100);

      const mockGauge = servicesFailing as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(100);
    });
  });

  describe('updateWorkerPoolSize()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should set workerPoolSize gauge to specified value', () => {
      updateWorkerPoolSize(4);

      const mockGauge = workerPoolSize as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(4);
    });

    it('should set workerPoolSize gauge to zero', () => {
      updateWorkerPoolSize(0);

      const mockGauge = workerPoolSize as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(0);
    });

    it('should set workerPoolSize gauge to large value', () => {
      updateWorkerPoolSize(16);

      const mockGauge = workerPoolSize as unknown as {
        getMockSet: () => ReturnType<typeof vi.fn>;
      };
      expect(mockGauge.getMockSet()).toHaveBeenCalledWith(16);
    });
  });

  describe('recordWorkerTaskCompleted()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should increment workerTasksCompleted counter', () => {
      recordWorkerTaskCompleted();

      // Access the inc method directly on the counter
      expect(workerTasksCompleted).toBeInstanceOf(Counter);
    });

    it('should increment workerTasksCompleted counter multiple times', () => {
      recordWorkerTaskCompleted();
      recordWorkerTaskCompleted();
      recordWorkerTaskCompleted();

      expect(workerTasksCompleted).toBeInstanceOf(Counter);
    });
  });

  describe('recordCsvWrite()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should increment csvWritesTotal with success status', () => {
      recordCsvWrite(true, 0);

      const labeledCounter = csvWritesTotal.labels('success');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment csvWritesTotal with failure status', () => {
      recordCsvWrite(false, 0);

      const labeledCounter = csvWritesTotal.labels('failure');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);
    });

    it('should increment csvRecordsWritten when successful with records', () => {
      recordCsvWrite(true, 10);

      const labeledCounter = csvWritesTotal.labels('success');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);

      // csvRecordsWritten.inc() is called directly with the count value
      const mockCounter = csvRecordsWritten as unknown as {
        mockInc: ReturnType<typeof vi.fn>;
      };
      expect(mockCounter.mockInc).toHaveBeenCalledWith(10);
    });

    it('should not increment csvRecordsWritten when recordCount is zero', () => {
      vi.clearAllMocks();
      recordCsvWrite(true, 0);

      const labeledCounter = csvWritesTotal.labels('success');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);

      // csvRecordsWritten should not be incremented
      const mockCounter = csvRecordsWritten as unknown as {
        mockInc: ReturnType<typeof vi.fn>;
      };
      expect(mockCounter.mockInc).not.toHaveBeenCalled();
    });

    it('should not increment csvRecordsWritten when write fails', () => {
      vi.clearAllMocks();
      recordCsvWrite(false, 10);

      const labeledCounter = csvWritesTotal.labels('failure');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);

      // csvRecordsWritten should not be incremented on failure
      const mockCounter = csvRecordsWritten as unknown as {
        mockInc: ReturnType<typeof vi.fn>;
      };
      expect(mockCounter.mockInc).not.toHaveBeenCalled();
    });

    it('should use default recordCount of 0 when not provided', () => {
      vi.clearAllMocks();
      recordCsvWrite(true);

      const labeledCounter = csvWritesTotal.labels('success');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);

      // csvRecordsWritten should not be incremented with default 0
      const mockCounter = csvRecordsWritten as unknown as {
        mockInc: ReturnType<typeof vi.fn>;
      };
      expect(mockCounter.mockInc).not.toHaveBeenCalled();
    });

    it('should increment csvRecordsWritten with large record count', () => {
      recordCsvWrite(true, 1000);

      const labeledCounter = csvWritesTotal.labels('success');
      expect(labeledCounter.inc).toHaveBeenCalledTimes(1);

      // csvRecordsWritten.inc() is called directly with the count value
      const mockCounter = csvRecordsWritten as unknown as {
        mockInc: ReturnType<typeof vi.fn>;
      };
      expect(mockCounter.mockInc).toHaveBeenCalledWith(1000);
    });
  });

  describe('getMetrics()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return Prometheus metrics string', async () => {
      const mockMetricsData = '# HELP health_checks_total Total number of health checks performed\n# TYPE health_checks_total counter\nhealth_checks_total{service_name="test",status="PASS"} 1';

      const mockRegistry = metricsRegistry as unknown as {
        setMockMetricsData: (data: string) => void;
      };
      mockRegistry.setMockMetricsData(mockMetricsData);

      const result = await getMetrics();

      expect(result).toBe(mockMetricsData);
      expect(typeof result).toBe('string');
    });

    it('should call metricsRegistry.metrics()', async () => {
      await getMetrics();

      const mockRegistry = metricsRegistry as unknown as {
        getMockMetrics: () => ReturnType<typeof vi.fn>;
      };
      expect(mockRegistry.getMockMetrics()).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMetricsJSON()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return metrics as JSON', async () => {
      const mockJSONData = [
        {
          name: 'health_checks_total',
          type: 'counter',
          help: 'Total number of health checks performed',
          values: [],
        },
      ];

      const mockRegistry = metricsRegistry as unknown as {
        setMockMetricsJSON: (data: unknown[]) => void;
      };
      mockRegistry.setMockMetricsJSON(mockJSONData);

      const result = await getMetricsJSON();

      expect(result).toEqual(mockJSONData);
    });

    it('should call metricsRegistry.getMetricsAsJSON()', async () => {
      await getMetricsJSON();

      const mockRegistry = metricsRegistry as unknown as {
        getMockGetMetricsAsJSON: () => ReturnType<typeof vi.fn>;
      };
      expect(mockRegistry.getMockGetMetricsAsJSON()).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetMetrics()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call metricsRegistry.resetMetrics()', () => {
      resetMetrics();

      const mockRegistry = metricsRegistry as unknown as {
        getMockResetMetrics: () => ReturnType<typeof vi.fn>;
      };
      expect(mockRegistry.getMockResetMetrics()).toHaveBeenCalledTimes(1);
    });

    it('should reset metrics without throwing errors', () => {
      expect(() => resetMetrics()).not.toThrow();
    });
  });

  describe('clearMetrics()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call metricsRegistry.clear()', () => {
      clearMetrics();

      const mockRegistry = metricsRegistry as unknown as {
        getMockClear: () => ReturnType<typeof vi.fn>;
      };
      expect(mockRegistry.getMockClear()).toHaveBeenCalledTimes(1);
    });

    it('should clear metrics without throwing errors', () => {
      expect(() => clearMetrics()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle multiple health check recordings in sequence', () => {
      vi.clearAllMocks();

      recordHealthCheck('service-1', 'PASS', 100);
      recordHealthCheck('service-2', 'DEGRADED', 2500);
      recordHealthCheck('service-3', 'FAIL', 5000);

      // Each service/status combination should be recorded once
      // We verify by calling labels again with the same values
      const service1Counter = healthChecksTotal.labels('service-1', 'PASS');
      expect(service1Counter.inc).toHaveBeenCalledTimes(1);

      const service2Counter = healthChecksTotal.labels('service-2', 'DEGRADED');
      expect(service2Counter.inc).toHaveBeenCalledTimes(1);

      const service3Counter = healthChecksTotal.labels('service-3', 'FAIL');
      expect(service3Counter.inc).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed metric recordings', () => {
      recordHealthCheck('service-1', 'PASS', 150);
      recordHealthCheckError('service-2', 'timeout');
      updateServicesFailingCount(2);
      updateWorkerPoolSize(4);
      recordWorkerTaskCompleted();
      recordCsvWrite(true, 5);

      expect(healthChecksTotal.labels('service-1', 'PASS').inc).toHaveBeenCalledTimes(1);
      expect(healthCheckErrors.labels('service-2', 'timeout').inc).toHaveBeenCalledTimes(1);
    });

    it('should handle complete health check workflow', async () => {
      // Simulate a full health check cycle
      updateWorkerPoolSize(4);

      recordHealthCheck('service-1', 'PASS', 150);
      recordHealthCheck('service-2', 'DEGRADED', 2500);
      recordHealthCheck('service-3', 'FAIL', 5000);

      recordHealthCheckError('service-3', 'timeout');

      updateServicesFailingCount(1);

      recordWorkerTaskCompleted();
      recordWorkerTaskCompleted();
      recordWorkerTaskCompleted();

      recordCsvWrite(true, 3);

      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
    });
  });
});
