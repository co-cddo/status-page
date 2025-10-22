# Monitoring & Alerting Guide

## Metrics Catalog

The status monitor exposes Prometheus metrics on port 9090 at `/metrics` endpoint per FR-035.

### health_checks_total (Counter)

**Description**: Total number of health checks performed
**Labels**:
- `service_name`: Name of the monitored service
- `status`: Result status (PASS, DEGRADED, FAIL)

**Usage**: Track health check volume and failure rates
```promql
# Total checks per service
sum by(service_name) (health_checks_total)

# Failure rate (last 5 minutes)
rate(health_checks_total{status="FAIL"}[5m])
```

### health_check_latency_seconds (Histogram)

**Description**: HTTP response latency for health checks
**Labels**:
- `service_name`: Name of the monitored service

**Buckets**: [0.1, 0.5, 1, 2, 5, 10] seconds

**Usage**: Analyze service response time distribution
```promql
# 95th percentile latency per service
histogram_quantile(0.95, rate(health_check_latency_seconds_bucket[5m]))

# Services exceeding warning threshold (2s)
histogram_quantile(0.95, rate(health_check_latency_seconds_bucket[5m])) > 2
```

### services_failing (Gauge)

**Description**: Current count of services in FAIL state
**Labels**: None (aggregate metric to avoid cardinality explosion)

**Usage**: Monitor overall system health
```promql
# Alert if any service failing for 10+ minutes
services_failing > 0
```

## Recommended Alerting Rules

These rules require Prometheus AlertManager (external deployment, out of MVP scope).

### ServiceDown Alert

**Severity**: Critical
**Threshold**: Any service failing for 10+ minutes
**PromQL**:
```yaml
- alert: ServiceDown
  expr: services_failing > 0
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Service outage detected"
    description: "{{ $value }} service(s) are currently failing health checks. Check status page for details."
```

### ServiceDegraded Alert

**Severity**: Warning
**Threshold**: Service p95 latency > warning_threshold (2s default) for 15+ minutes
**PromQL**:
```yaml
- alert: ServiceDegraded
  expr: histogram_quantile(0.95, rate(health_check_latency_seconds_bucket{service_name!=""}[5m])) > 2
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Service {{ $labels.service_name }} performance degraded"
    description: "Service {{ $labels.service_name }} p95 latency is {{ $value }}s, exceeding warning threshold."
```

### HighErrorRate Alert

**Severity**: Warning
**Threshold**: >5% health check failure rate for 5+ minutes
**PromQL**:
```yaml
- alert: HighErrorRate
  expr: |
    sum(rate(health_checks_total{status="FAIL"}[5m]))
    /
    sum(rate(health_checks_total[5m]))
    > 0.05
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High health check error rate"
    description: "{{ $value | humanizePercentage }} of health checks are failing."
```

## Grafana Dashboard

Import the pre-built dashboard JSON (see `grafana-dashboard.json` in this directory) to visualize:
- Service status overview (green/yellow/red indicators)
- Health check latency heatmaps
- Error rate time series
- Services failing gauge

## Runbooks

### ServiceDown Runbook
1. Access status page: https://status.gov.uk/
2. Identify failing service(s) from list
3. Check failure reason in CSV/JSON data
4. Verify service is actually down (not monitoring host network issue)
5. Contact service owner or escalate to on-call
6. Document incident in incident log

### ServiceDegraded Runbook
1. Access Grafana dashboard to see latency trends
2. Check if degradation is isolated to one service or systemic
3. Review service logs for slow queries/endpoints
4. Check for traffic spikes causing load
5. Consider scaling if infrastructure-related
6. Notify service owner if persistent

### HighErrorRate Runbook
1. Check GitHub Actions workflow runs for deployment failures
2. Verify config.yaml is valid (syntax errors after recent PR?)
3. Check GitHub Actions runner network connectivity
4. Review CSV cache status (corruption? fallback working?)
5. Check for rate limiting from monitored services
6. Restart monitoring service if persistent
