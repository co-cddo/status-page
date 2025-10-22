# Prometheus Metrics Cardinality Management

**Status**: Accepted

**Date**: 2025-10-22

**Decision Makers**: Development Team

## Context

The GOV.UK Public Services Status Monitor must emit Prometheus metrics (FR-035) for operational monitoring. The application performs health checks on multiple services, each with tags for categorization. A naive metric design might include all service tags as Prometheus labels, causing **cardinality explosion**.

**Cardinality explosion** occurs when label combinations create too many unique time series, degrading Prometheus performance:
- 50 services × 4 tags per service × 3 statuses = **600 time series** minimum
- Adding more labels (e.g., HTTP method, expected status) multiplies this exponentially
- Prometheus performance degrades significantly beyond 10,000 active time series per scrape target

From FR-035:
> "Expose /metrics endpoint for Prometheus scraping: counters for check results (by service and status), histograms for latency (by service), gauge for failing service count"

From research.md:
> "Prometheus best practices warn against high-cardinality labels. Metrics with unbounded label values (user IDs, URLs, tags) can create millions of time series, exhausting memory and slowing queries."

The challenge: **How to emit useful metrics while avoiding cardinality explosion?**

## Decision

We will use **bounded labels only** for Prometheus metrics, specifically limiting labels to `service_name` and `status`. Service tags will NOT be exposed as Prometheus labels.

### Metric Design

**Metrics to Expose**:

1. **`health_checks_total` (Counter)**:
   - Labels: `service_name`, `status`
   - Description: Total number of health checks performed
   - Example: `health_checks_total{service_name="example",status="PASS"} 1234`

2. **`health_check_latency_seconds` (Histogram)**:
   - Labels: `service_name`
   - Buckets: `[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]` seconds
   - Description: Health check response time distribution
   - Example: `health_check_latency_seconds_bucket{service_name="example",le="1.0"} 950`

3. **`services_failing` (Gauge)**:
   - Labels: None (scalar value)
   - Description: Current number of services in FAIL status
   - Example: `services_failing 3`

**Cardinality Calculation**:
- 50 services × 3 statuses (PASS/DEGRADED/FAIL) = **150 time series** for `health_checks_total`
- 50 services × 6 histogram buckets = **300 time series** for `health_check_latency_seconds`
- 1 time series for `services_failing`
- **Total: ~450 time series** (well within Prometheus limits)

### Tag-Based Analysis (External Join)

For tag-based analysis (e.g., "How many health services are failing?"), use external joins:
- **Prometheus metrics**: Provide service-level data (no tags)
- **External metadata**: Service-to-tag mapping stored in config.yaml
- **Query-time join**: Use PromQL `group_left` or external tools (Grafana transformations) to join metrics with tag metadata

Example Grafana query with external join:
```promql
# Get failing services count by tag (requires external metadata source)
sum by (service_name) (health_checks_total{status="FAIL"})
  * on(service_name) group_left(tag)
  label_replace(metric_name, "tag", "$1", "service_name", "(.*)")
```

## Consequences

### Positive Consequences

- **Bounded cardinality**: Maximum 450 time series for 50 services (scalable to 500+ services)
- **Predictable memory**: Prometheus memory usage remains stable
- **Fast queries**: Low cardinality enables sub-second query response times
- **Operational reliability**: No risk of Prometheus memory exhaustion or scrape timeouts
- **Future-proof**: Adding new services doesn't exponentially increase cardinality

### Negative Consequences

- **Limited dimensionality**: Cannot query by service tags directly in Prometheus
- **External join required**: Tag-based analysis requires external metadata join
- **Less flexible**: Cannot answer "How many health-tagged services are failing?" without external data
- **Query complexity**: PromQL queries are more complex for tag-based analysis

## Alternatives Considered

### Option 1: Include Service Tags as Prometheus Labels

**Description**: Add `tags` label to all metrics:
```
health_checks_total{service_name="example",status="PASS",tags="health,roads"} 1234
```

**Pros**:
- Rich dimensionality (can query by tags directly)
- No external join required
- More flexible PromQL queries

**Cons**:
- **Cardinality explosion**: 50 services × 4 tags × 3 statuses = 600+ time series
- **Unbounded growth**: Adding new tags increases cardinality
- **Memory issues**: Prometheus memory usage scales with cardinality
- **Violates best practices**: Prometheus documentation explicitly warns against high-cardinality labels

**Verdict**: Unacceptable risk. Cardinality explosion degrades Prometheus performance and can cause service outages.

### Option 2: One Metric Per Tag

**Description**: Create separate metric series for each tag:
```
health_checks_total_health{service_name="example",status="PASS"} 1234
health_checks_total_roads{service_name="example",status="PASS"} 1234
```

**Pros**:
- Bounded cardinality per metric
- Can query by tag directly

**Cons**:
- **Explosion of metrics**: 50 services × 10 unique tags = 500 metric names
- **Duplicate data**: Same check counted multiple times (once per tag)
- **Query complexity**: Must union multiple metric queries
- **Difficult to manage**: Adding new tags requires code changes

**Verdict**: Too complex. Creates metric explosion instead of label explosion.

### Option 3: Dynamic Label Creation (Recording Rules)

**Description**: Use Prometheus recording rules to pre-compute tag-based aggregations.

**Pros**:
- Bounded cardinality for base metrics
- Pre-computed aggregations are fast

**Cons**:
- Requires Prometheus server configuration (not self-contained)
- Recording rules must be updated when tags change
- Still requires external metadata
- Adds operational complexity

**Verdict**: Requires external Prometheus configuration. Not suitable for self-contained application.

### Option 4: OpenMetrics Info Metrics

**Description**: Use OpenMetrics `_info` metrics to expose service metadata separately:
```
service_info{service_name="example",tags="health,roads"} 1
health_checks_total{service_name="example",status="PASS"} 1234
```

**Pros**:
- Separates metadata from metrics
- Enables `group_left` joins in PromQL
- Best practice for exposing metadata

**Cons**:
- Still adds cardinality (50 services × 10 unique tags = 500 series for `service_info`)
- Requires PromQL join (query complexity)
- Less intuitive for users

**Verdict**: Better than Option 1, but still adds cardinality. Not worth the tradeoff for MVP.

## References

- [Prometheus Best Practices: Metric and Label Naming](https://prometheus.io/docs/practices/naming/)
- [Prometheus Best Practices: Cardinality](https://prometheus.io/docs/practices/instrumentation/#things-to-watch-out-for)
- [PromQL Join Documentation](https://prometheus.io/docs/prometheus/latest/querying/operators/#many-to-one-and-one-to-many-vector-matches)
- [research.md](../../specs/001-govuk-status-monitor/research.md) - Section 6: Prometheus Metrics Cardinality
- [spec.md FR-035](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - Prometheus metrics requirement

## Notes

**Implementation Location**: `src/metrics/prometheus.ts`, `src/metrics/server.ts`

**Metrics HTTP Server**: Expose `/metrics` endpoint on port 9090 (configurable via `PROMETHEUS_PORT` env var).

**Scrape Configuration Example** (for Prometheus server):
```yaml
scrape_configs:
  - job_name: 'govuk-status-monitor'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

**Example Metric Output**:
```
# HELP health_checks_total Total number of health checks performed
# TYPE health_checks_total counter
health_checks_total{service_name="example",status="PASS"} 1234
health_checks_total{service_name="example",status="FAIL"} 5
health_checks_total{service_name="example-two",status="PASS"} 890

# HELP health_check_latency_seconds Health check response time distribution
# TYPE health_check_latency_seconds histogram
health_check_latency_seconds_bucket{service_name="example",le="0.1"} 120
health_check_latency_seconds_bucket{service_name="example",le="0.5"} 450
health_check_latency_seconds_bucket{service_name="example",le="1.0"} 950
health_check_latency_seconds_bucket{service_name="example",le="+Inf"} 1234
health_check_latency_seconds_sum{service_name="example"} 456.78
health_check_latency_seconds_count{service_name="example"} 1234

# HELP services_failing Current number of services in FAIL status
# TYPE services_failing gauge
services_failing 3
```

**Tag-Based Analysis Workaround**:

For tag-based analysis, use CSV exports or JSON API:
- **CSV**: `history.csv` includes service names; join with config.yaml tags externally
- **JSON API**: `/api/status.json` includes tags array per service
- **Grafana**: Use Grafana transformations to join Prometheus metrics with JSON API data

This approach trades query flexibility for operational reliability - a worthwhile tradeoff for production monitoring systems.

**Future Considerations**: If tag-based querying becomes critical:
- Implement separate tag metadata service
- Use OpenTelemetry instead of Prometheus (better support for high-cardinality attributes)
- Migrate to InfluxDB or TimescaleDB (optimized for high-cardinality time series)

This ADR prioritizes operational stability and Prometheus best practices over query flexibility for MVP.
