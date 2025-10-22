# Deployment Guide

## GOV.UK Status Monitor Deployment

This document describes the automated deployment workflow for the GOV.UK Status Monitor to GitHub Pages.

## Architecture Overview

The status monitor uses a **scheduled GitHub Actions workflow** to:
1. Execute health checks every 5 minutes
2. Generate static HTML and JSON
3. Deploy to GitHub Pages
4. Maintain historical CSV data

## Deployment Workflow

**File**: `.github/workflows/deploy.yml`

### Trigger Schedule

```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
```

### Manual Trigger

```bash
# Trigger deployment manually via GitHub CLI
gh workflow run deploy.yml
```

### Workflow Steps

1. **Restore CSV History**
   - Primary: GitHub Actions cache
   - Fallback: Download from GitHub Pages
   - Last resort: Create new CSV file

2. **Execute Health Checks**
   - Run checks for all configured services in `config.yaml`
   - Append results to `history.csv`
   - Generate `_data/health.json` for Eleventy

3. **Build Static Site**
   - Run Eleventy to generate HTML from templates
   - Post-process: Inline all CSS/JS/images as data URIs
   - Result: Self-contained `index.html` < 5MB

4. **Deploy to GitHub Pages**
   - Upload artifact containing:
     - `index.html` (self-contained HTML)
     - `status.json` (JSON API)
     - `history.csv` (historical data)
   - Deploy using `actions/deploy-pages@v4`

5. **Save CSV to Cache**
   - Cache updated CSV for next run
   - Cache key: `csv-history-{run_number}`

## One-Time Setup (T025a)

### Enable GitHub Pages

```bash
# Enable GitHub Pages for the repository
gh api repos/:owner/:repo/pages -X POST \
  -f source[branch]=main \
  -f source[path]=/

# Verify Pages is enabled
gh api repos/:owner/:repo/pages

# Expected output:
# {
#   "url": "https://{owner}.github.io/{repo}/",
#   "status": "built",
#   "html_url": "https://{owner}.github.io/{repo}/"
# }
```

### Test Deployment

```bash
# Access the deployed site
open "https://$(gh api repos/:owner/:repo --jq '.owner.login').github.io/$(gh api repos/:owner/:repo --jq '.name')/"
```

## Permissions

Per FR-037a, the deployment workflow uses **least-privilege permissions**:

```yaml
permissions:
  contents: read      # Read repository code
  pages: write        # Deploy to GitHub Pages
  id-token: write     # OIDC token for Pages deployment
```

## Monitoring

### Check Workflow Status

```bash
# List recent workflow runs
gh run list --workflow=deploy.yml --limit=10

# View logs for specific run
gh run view {run_id} --log
```

### Check Deployment Status

```bash
# View GitHub Pages status
gh api repos/:owner/:repo/pages

# View latest deployment
gh api repos/:owner/:repo/pages/deployments --jq '.[0]'
```

## Troubleshooting

### CSV Cache Miss

If the CSV cache is unavailable:
1. Workflow attempts to download CSV from GitHub Pages
2. If that fails, creates a new CSV file
3. Historical data before the cache miss is lost

**Recovery**: Download CSV from GitHub Pages manually and restore to cache.

### Deployment Failure

Common causes:
- Health checks timeout (increase `timeout` in `config.yaml`)
- HTML exceeds 5MB limit (optimize inlined assets)
- GitHub Pages quota exceeded (check repo settings)

**Recovery**: Check workflow logs with `gh run view {run_id} --log`

### CSV Corruption

The workflow validates CSV format before processing:
- If corrupt, attempts fallback to GitHub Pages
- If fallback fails, creates new CSV

**Prevention**: Monitor CSV size and implement rotation

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Health Check Duration | < 30s | Varies |
| Build Duration | < 2 min | Varies |
| Deployment Duration | < 1 min | Varies |
| Total Workflow Duration | < 5 min | Varies |
| HTML File Size | < 5MB | Monitored |

## Workflow Concurrency

Only one deployment runs at a time:

```yaml
concurrency:
  group: 'deploy-status-page'
  cancel-in-progress: true
```

This prevents race conditions and ensures CSV integrity.

## CSV Data Retention

**Storage Strategy**:
- GitHub Actions Cache (7 days retention)
- GitHub Pages (permanent, updated every 5 minutes)
- CSV grows over time - implement rotation if needed

**Backup Strategy**:
- CSV is included in every GitHub Pages deployment
- Download CSV from Pages as backup: `wget https://{owner}.github.io/{repo}/history.csv`

## Further Reading

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Workflow Security](./security.md)
- [Configuration Guide](../specs/001-govuk-status-monitor/quickstart.md)

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
