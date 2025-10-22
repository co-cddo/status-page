# CSV Format for Consecutive Failure Tracking (Derived, Not Stored)

**Status**: Accepted

**Date**: 2025-10-22

**Decision Makers**: Development Team

## Context

The GOV.UK Public Services Status Monitor must display services as "DOWN" on the HTML page only after 2 consecutive failures (FR-015a) to reduce transient failure noise. However, the CSV historical data (FR-016, FR-018) must record ALL check results - including single failures - for accurate historical analysis.

This creates a design question: **Where and how should we track consecutive failure count?**

Requirements:
- **HTML display threshold**: Requires 2 consecutive FAIL statuses before showing as DOWN
- **CSV/JSON single-failure recording**: MUST record every check result, including first failure
- **Stateless HTML generation**: HTML page is regenerated from scratch on every build (no in-memory state)
- **Restart resilience**: Consecutive failure tracking must survive application restarts
- **Auditability**: Historical data must be complete and transparent
- **Simplicity**: Avoid unnecessary state management complexity

From data-model.md:
> "HTML Display: Requires 2 consecutive FAIL statuses (reduces transient noise)
> CSV/JSON Data: Single failures recorded (accurate historical tracking)
> Derivation: Counted from recent CSV records during HTML generation"

## Decision

We will **derive consecutive failure count from CSV records during HTML generation** rather than storing it as a separate column or in-memory counter.

### Approach

**CSV Schema (No Consecutive Failure Column)**:
```csv
timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id
2025-10-22T14:00:00Z,example,PASS,120,200,,abc-123
2025-10-22T14:05:00Z,example,FAIL,0,0,Connection timeout,def-456
2025-10-22T14:10:00Z,example,FAIL,0,0,Connection timeout,ghi-789
```

**Consecutive Failure Derivation Algorithm** (during HTML generation):

```typescript
function getConsecutiveFailures(serviceName: string, csvRecords: HistoricalRecord[]): number {
  // Filter records for this service, sorted by timestamp descending (newest first)
  const serviceRecords = csvRecords
    .filter(r => r.service_name === serviceName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Count consecutive FAILs from most recent record backwards
  let consecutiveFailures = 0;
  for (const record of serviceRecords) {
    if (record.status === 'FAIL') {
      consecutiveFailures++;
    } else {
      break; // Stop at first non-FAIL status
    }
  }

  return consecutiveFailures;
}

// HTML generation logic
const consecutiveFailures = getConsecutiveFailures(service.name, csvRecords);
const displayStatus = consecutiveFailures >= 2 ? 'DOWN' : service.currentStatus;
```

**Benefits of Derivation**:
1. **No separate column**: CSV remains simple (7 columns only)
2. **Stateless**: No in-memory counter to manage
3. **Restart resilient**: Consecutive count persists in CSV historical data
4. **Auditable**: Anyone can recompute consecutive failures from raw CSV
5. **Flexible**: Can change threshold (e.g., 3 consecutive failures) without migrating data

## Consequences

### Positive Consequences

- **Simplicity**: No separate state column in CSV (keep 7 columns per FR-018)
- **Auditability**: Consecutive failures can be recomputed from raw historical data
- **Restart resilience**: No in-memory state to lose on application restart
- **Flexibility**: Can change consecutive failure threshold without data migration
- **Transparency**: Historical CSV shows every check result (no hiding single failures)
- **No race conditions**: No concurrent writes to a "consecutive_failures" column

### Negative Consequences

- **Read performance**: Must scan recent CSV records on every HTML generation
- **CSV read required**: HTML generation must parse CSV file (adds ~10-50ms)
- **Memory usage**: Must load recent CSV records into memory (typically last 100-1000 records per service)
- **Algorithm complexity**: Derivation logic must be tested thoroughly

## Alternatives Considered

### Option 1: Separate Column in CSV (`consecutive_failures` column)

**Description**: Add an 8th column to CSV: `consecutive_failures` (integer).

CSV Schema:
```csv
timestamp,service_name,status,latency_ms,http_status_code,failure_reason,correlation_id,consecutive_failures
2025-10-22T14:00:00Z,example,PASS,120,200,,abc-123,0
2025-10-22T14:05:00Z,example,FAIL,0,0,Connection timeout,def-456,1
2025-10-22T14:10:00Z,example,FAIL,0,0,Connection timeout,ghi-789,2
```

**Pros**:
- Fast read (no derivation needed)
- Simple HTML generation (just read the column)
- Explicit value in historical data

**Cons**:
- Adds column to CSV (violates simplicity)
- Requires in-memory state tracking during health checks
- Stateful tracking across restarts (must persist counter)
- What happens if CSV is edited manually? (stale consecutive_failures values)
- Redundant data (derivable from status column)

**Verdict**: Adds unnecessary state. Consecutive failures are derivable from raw data.

### Option 2: In-Memory Counter (Reset on Restart)

**Description**: Track consecutive failures in memory only, reset to 0 on application restart.

**Pros**:
- Fast (no CSV read)
- Simple logic (increment/reset counter)

**Cons**:
- **Lost on restart**: Application restart resets all counters to 0
- **No persistence**: Cannot survive crashes or deployments
- **Inaccurate**: First check after restart always shows service as UP, even if previously failing
- **Violates requirement**: FR-015a requires consecutive tracking across restarts

**Verdict**: Unacceptable. Consecutive failure tracking must survive restarts.

### Option 3: Redis/Database State Store

**Description**: Store consecutive failure counts in Redis or database.

**Pros**:
- Fast read/write
- Survives restarts
- Can handle high concurrency

**Cons**:
- External dependency (violates MVP constraint)
- Operational complexity (Redis/DB deployment)
- Costs money
- Network latency

**Verdict**: Over-engineered for MVP. Introduces external dependency.

### Option 4: Separate State File (`state.json`)

**Description**: Write consecutive failures to a separate JSON file:
```json
{
  "example": {"consecutiveFailures": 2},
  "example-two": {"consecutiveFailures": 0}
}
```

**Pros**:
- Fast read/write
- Survives restarts
- No external dependencies

**Cons**:
- Another file to manage
- Redundant data (derivable from CSV)
- State file can diverge from CSV (if CSV edited manually)
- Adds complexity (two files instead of one)

**Verdict**: Unnecessary complexity. Derivation from CSV is simpler.

## References

- [data-model.md](../../specs/001-govuk-status-monitor/data-model.md) - Consecutive failure derivation approach
- [spec.md FR-015a](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - "Services displaying as DOWN in HTML require 2 consecutive FAIL statuses"
- [spec.md FR-016](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - "Single check failures MUST be recorded to CSV"
- [spec.md FR-018](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - CSV columns specification (7 columns)

## Notes

**Implementation Location**: `src/storage/csv-reader.ts` (derivation logic), `pages/index.njk` (HTML generation)

**Performance Optimization**: For large CSV files (1M+ records), implement indexed CSV reading:
- Only read last N records per service (e.g., last 100 checks)
- Use streaming CSV parser to avoid loading entire file into memory
- Cache derivation results for current build cycle (invalidate on next cycle)

**Derivation Example**:

Given CSV records for "example" service (newest first):
```
2025-10-22T14:30:00Z,example,FAIL,...  # Check 5
2025-10-22T14:25:00Z,example,FAIL,...  # Check 4 (2nd consecutive fail)
2025-10-22T14:20:00Z,example,PASS,...  # Check 3 (break in failure chain)
2025-10-22T14:15:00Z,example,FAIL,...  # Check 2 (isolated fail)
2025-10-22T14:10:00Z,example,PASS,...  # Check 1
```

Derivation result: `consecutiveFailures = 2` (Checks 4 and 5)

HTML display: **DOWN** (threshold of 2 met)

**Testing Strategy**:
- Unit tests for derivation algorithm (various failure patterns)
- Edge cases: 0 failures, 1 failure, exactly 2 failures, 10+ consecutive failures
- Empty CSV (no historical data)
- CSV with single record
- Mixed service records (ensure filtering by service name works)

**Future Considerations**: If CSV performance becomes a bottleneck (CSV > 10MB), consider:
- Migrate to SQLite database with indexed queries
- Use columnar storage format (Parquet)
- Implement sliding window (only keep last 1000 checks per service)

This ADR documents the stateless derivation approach, which aligns with the static site generation architecture and avoids external dependencies.
