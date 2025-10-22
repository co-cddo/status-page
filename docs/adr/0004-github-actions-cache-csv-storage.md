# GitHub Actions Cache for CSV Historical Data Persistence

**Status**: Accepted

**Date**: 2025-10-22

**Decision Makers**: Development Team

## Context

The GOV.UK Public Services Status Monitor needs persistent storage for historical health check data in CSV format (FR-020). The application runs on scheduled GitHub Actions workflows (every 5 minutes), which are ephemeral - each workflow run starts with a clean environment. Historical data must persist across workflow runs without external dependencies.

Key requirements:
- **CSV persistence**: `history.csv` must survive across workflow runs
- **Zero external dependencies**: No databases, object storage, or third-party services for MVP
- **Automated**: No manual intervention required
- **Cost-effective**: Free or minimal cost
- **Reliable**: Data loss is unacceptable
- **Fallback mechanism**: Handle cache eviction gracefully
- **Deployment included**: CSV must be accessible via GitHub Pages

From spec.md FR-020b-e:
- FR-020b: GitHub Actions cache is PRIMARY storage for CSV
- FR-020c: Cache limit exceeded causes IMMEDIATE workflow failure
- FR-020d: Network error fetching CSV from GitHub Pages causes IMMEDIATE workflow failure
- FR-020e: CSV corruption triggers fallback to next tier with logging

GitHub Actions cache constraints:
- **10GB limit** per repository
- **7-day eviction** if not accessed
- **Manual rotation** required when cache fills

## Decision

We will use **GitHub Actions cache as primary CSV storage** with a **three-tier fallback strategy**:

### Three-Tier Fallback Chain

1. **Tier 1 (Primary): GitHub Actions Cache**
   - Use `actions/cache@v4` to save/restore `history.csv`
   - Cache key: `csv-history-{hash}` (date-based or content-based hash)
   - Immediate workflow failure if cache limit (10GB) exceeded
   - Auto-restore on every workflow run

2. **Tier 2 (Fallback): GitHub Pages**
   - Deploy `history.csv` to GitHub Pages alongside HTML
   - Fetch via HTTPS if cache miss
   - Immediate workflow failure on network error
   - Serves as backup if cache evicted (after 7 days of inactivity)

3. **Tier 3 (Last Resort): New File**
   - Create new empty `history.csv` if both cache and Pages fail
   - Occurs only on first run or catastrophic failure
   - Log warning: "Historical data unavailable, starting fresh"

### Workflow Implementation

```yaml
# .github/workflows/deploy.yml
- name: Restore CSV from cache
  uses: actions/cache/restore@v4
  with:
    path: history.csv
    key: csv-history-${{ hashFiles('history.csv') }}
    restore-keys: csv-history-

- name: Fallback to GitHub Pages
  if: steps.cache.outputs.cache-hit != 'true'
  run: |
    curl -f https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/history.csv -o history.csv \
      || echo "Cache miss and Pages fallback failed, starting fresh CSV"

- name: Run health checks
  run: npm run check-once

- name: Save CSV to cache
  uses: actions/cache/save@v4
  with:
    path: history.csv
    key: csv-history-${{ hashFiles('history.csv') }}

- name: Deploy to GitHub Pages (includes CSV)
  uses: actions/upload-pages-artifact@v3
  with:
    path: output/
```

## Consequences

### Positive Consequences

- **Zero external dependencies**: No databases, S3, GCS, etc. required
- **Free**: GitHub Actions cache is included in free tier
- **Fast**: Cache restore/save is ~1-5 seconds for CSV files
- **Automatic**: No manual intervention needed
- **Redundant**: Two independent storage tiers (cache + Pages)
- **Transparent**: CSV visible on GitHub Pages for auditing
- **Simple**: Native GitHub Actions features only

### Negative Consequences

- **10GB limit**: Requires manual cache rotation/cleanup
- **7-day eviction**: Inactive caches are purged (mitigated by Pages fallback)
- **No version history**: Cache overwrites previous versions
- **Manual rotation**: Must implement tooling to manage cache size
- **Network dependency**: Fallback to Pages requires external HTTP request
- **Cache thrashing risk**: Frequent workflow runs may hit cache API limits

## Alternatives Considered

### Option 1: External Object Storage (S3, GCS, Azure Blob)

**Description**: Store CSV in AWS S3, Google Cloud Storage, or Azure Blob Storage.

**Pros**:
- Unlimited storage (effectively)
- No eviction policies
- High durability (99.999999999%)
- Versioning support

**Cons**:
- External dependency (violates MVP constraint)
- Requires credentials management (secrets in GitHub)
- Costs money (even free tier requires credit card)
- Network egress costs
- Operational complexity

**Verdict**: Violates zero-external-dependency constraint for MVP. Suitable for future scaling.

### Option 2: GitHub Repository Commits

**Description**: Commit `history.csv` to repository on every workflow run.

**Pros**:
- Full version history (Git)
- No size limits (effectively unlimited)
- No eviction
- Simple Git operations

**Cons**:
- Repository bloat (CSV grows over time, pollutes Git history)
- Slow (commit + push takes 10-30 seconds)
- Triggers unnecessary workflows (commit triggers other workflows)
- Not suitable for high-frequency updates (every 5 minutes)
- Merge conflicts if multiple workflows run concurrently

**Verdict**: Too slow and pollutes repository. Commits should be for code, not data.

### Option 3: GitHub Artifacts Only

**Description**: Use `actions/upload-artifact` and `actions/download-artifact` to persist CSV.

**Pros**:
- Simple API
- No size limit per artifact (effectively unlimited)
- Retained for 90 days (default)

**Cons**:
- Artifacts are workflow-specific (not shared across workflows)
- Must download artifact from *previous* workflow (API call + auth)
- Slower than cache (30-60 seconds to download artifacts)
- Retention policy (90 days max)
- API rate limits

**Verdict**: Artifacts are designed for build outputs, not persistent state. Cache is faster and easier.

### Option 4: GitHub Gist

**Description**: Store CSV as a GitHub Gist, update via API on every workflow run.

**Pros**:
- Simple HTTP API
- Version history
- Public or secret Gist options

**Cons**:
- Rate limits (5000 requests/hour)
- Not designed for high-frequency updates
- Requires token authentication
- Single file size limit (25MB)
- Slower than cache (API latency)

**Verdict**: Rate limits make this unsuitable for every-5-minute updates.

### Option 5: External Database (PostgreSQL, MySQL, Supabase)

**Description**: Use hosted database to store historical records.

**Pros**:
- Structured queries
- Indexes for fast lookups
- Scalable
- ACID guarantees

**Cons**:
- External dependency
- Costs money
- Requires credentials management
- Overkill for append-only CSV
- Network latency

**Verdict**: Over-engineered for MVP. Violates zero-dependency constraint.

## References

- [GitHub Actions Cache Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [GitHub Actions Cache Limits](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration#artifact-and-cache-usage-limits)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [spec.md FR-020b-e](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - CSV persistence requirements
- [plan.md](../../specs/001-govuk-status-monitor/plan.md) - Hybrid orchestrator architecture

## Notes

**Implementation Location**: `.github/workflows/deploy.yml`, `src/storage/cache-manager.ts`

**Cache Key Strategy**: Use content-based hash (`hashFiles('history.csv')`) instead of date-based keys. This ensures:
- Cache is only updated when CSV content changes
- Identical CSV files reuse existing cache (saves API quota)
- Immutable cache keys (cache is append-only)

**Cache Size Monitoring**: Implement tooling to monitor cache usage:
```bash
gh api repos/{owner}/{repo}/actions/cache/usage
```

Alert when cache usage exceeds 8GB (80% of 10GB limit).

**CSV Rotation Strategy**: When CSV exceeds 100MB (configurable), implement rotation:
1. Archive current CSV with timestamp: `history-2025-10-22.csv`
2. Deploy archive to GitHub Pages
3. Start new empty CSV
4. Update cache with new empty CSV

**Corruption Recovery**: If CSV is corrupted (invalid format, missing headers):
1. Log error with correlation ID
2. Emit alert (GitHub Actions annotation)
3. Attempt repair (remove corrupted rows)
4. If unrepairable, fall through to next tier (GitHub Pages)
5. If all tiers fail, create new CSV (data loss)

**First Run Behavior**: On very first workflow run:
- Cache miss (no cache exists)
- Pages miss (no deployment yet)
- Create new empty CSV with headers only
- Subsequent runs use cache

**Cache Eviction Mitigation**: The 7-day eviction is mitigated by:
1. Workflow runs every 5 minutes (cache accessed frequently)
2. GitHub Pages fallback serves as long-term backup
3. Even if both fail, loss is minimal (historical data can be rebuilt over time)

**Future Migration Path**: When scaling beyond 10GB cache limit:
- **Option A**: Implement automated CSV rotation (archive old data)
- **Option B**: Migrate to time-series database (TimescaleDB, InfluxDB)
- **Option C**: Use external object storage (S3, GCS)

This ADR documents the MVP approach. Migration to external storage is deferred until data volume justifies the operational complexity.
