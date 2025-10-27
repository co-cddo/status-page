# MVP Release: Merge and Implementation Plan
## UK Public Service Discovery Project (Feature 002)

**Document Version:** 1.0
**Date:** 2025-10-26
**Branch:** 002-add-9500-public-services
**Status:** Ready for Execution

---

## Executive Summary

This document provides a detailed, step-by-step plan to merge **6,906 validated UK public services** from three discovery YAML files into the root `config.yaml` for the MVP release. The merge will increase total monitored services from **205** to **7,111**.

**Critical Success Factors:**
- Zero service loss during merge
- No duplicate service entries
- Preserved root config.yaml settings
- Valid YAML syntax post-merge
- All services validated before commit

---

## 1. Current State Analysis

### 1.1 File Inventory

| File | Location | Size | Lines | Services | Status |
|------|----------|------|-------|----------|--------|
| **Root Config** | `/Users/cns/httpdocs/cddo/status/config.yaml` | 57 KB | 2,492 | 205 | Production |
| **Government Services** | `specs/002-add-9500-public-services/research-data/government-services.yaml` | 100 KB | 4,544 | 281 | Validated |
| **NHS Services** | `specs/002-add-9500-public-services/research-data/nhs-services.yaml` | 2.2 MB | 117,234 | 6,503 | Validated |
| **Emergency Services** | `specs/002-add-9500-public-services/research-data/emergency-services.yaml` | 46 KB | 2,346 | 122 | Validated |
| **TOTAL (Post-Merge)** | - | ~2.4 MB | ~126,616 | **7,111** | Target |

### 1.2 Root Config Structure

The root `config.yaml` has the following structure:

```yaml
settings:              # Lines 1-7: Global defaults
  check_interval: 300
  warning_threshold: 2
  timeout: 10
  page_refresh: 300
  max_retries: 3
  worker_pool_size: 0

pings:                 # Lines 28-2492: Service definitions (205 services)
  - name: Apply for First Provisional Driving Licence
    protocol: HTTPS
    method: GET
    resource: https://www.gov.uk/apply-first-provisional-driving-licence
    tags:
      - motoring
      - driving-licence
      - dvla
    expected:
      status: 200
      text: Apply for your first provisional driving licence
    interval: 60
  # ... 204 more services
```

**Key Observations:**
- Uses **compact YAML** format with inline lists for tags
- Has **text validation** with positive/negative patterns (e.g., `!We're sorry`)
- Includes **search services** with POST methods and payloads
- Contains **23 Feature 002 POC services** (lines 2082-2492)
- Has **comments explaining validation logic** (lines 9-27)

### 1.3 Discovery YAML Structures

All three discovery files share identical structure:

```yaml
settings:              # Lines 1-10: Same as root (will be discarded)
  check_interval: 60
  warning_threshold: 2
  timeout: 5
  page_refresh: 60
  max_retries: 3
  worker_pool_size: 0

pings:                 # Service definitions with section headers
  # ============================================================================
  # CRITICAL SERVICES (60-second check interval)
  # ============================================================================

  # Category comments
  # Description of service category
  - name: Service Name
    protocol: HTTPS
    method: GET
    resource: https://example.nhs.uk
    tags:
      - category1
      - category2
      - production
    expected:
      status: 200
    interval: 60
    warning_threshold: 2
    timeout: 5
```

**Key Differences from Root:**
- Use **service categories** organized by department/priority
- Have **section headers** with timing annotations
- Include **detailed category comments**
- Use **different default settings** (60s vs 300s intervals)
- Service names follow **department prefix pattern** (e.g., "HMRC Api Documentation", "NHS 111")

---

## 2. Duplicate Analysis

### 2.1 Name-Based Duplicates

**Between Root Config and Discovery Files:**

| Comparison | Duplicates | Action Required |
|------------|-----------|-----------------|
| Root ↔ Government | 11 | Keep root versions (existing services) |
| Root ↔ NHS | 0 | No conflict |
| Root ↔ Emergency | 0 | No conflict |
| **Intra-Discovery** | 16 | Already de-duplicated in validation |

**Duplicate Services to Skip (Keep Root Versions):**

1. Companies House Find And Update
2. DVLA Change Address Driving Licence
3. DVLA Vehicle Tax
4. DWP Jobseekers Allowance
5. DWP Pip
6. DWP Universal Credit
7. Home Office Apply Renew Passport
8. Home Office Check Uk Visa
9. OTHER-GOVERNMENT Check Mot History
10. OTHER-GOVERNMENT Employment Support Allowance
11. OTHER-GOVERNMENT Government

**Strategy:** When merging, **skip these 11 services** from discovery files to avoid duplicates. The root config versions are production-tested and should be preserved.

### 2.2 URL-Based Duplicates

**Potential URL Overlaps:**
- Root has `https://111.nhs.uk/` (NHS 111 Online)
- NHS services has `https://111.nhs.uk` (111 nhs uk)
- **Action:** Verify if these are identical services with different names

**Other URL Patterns:**
- Root uses fully qualified service names ("NHS 111 Online")
- Discovery files use generated names from DNS ("111 nhs uk")
- **Recommendation:** Prefer root naming convention for clarity

### 2.3 POC Services Already in Root

The root `config.yaml` already contains **23 POC services** from Feature 002 (lines 2082-2492):
- 2 Police services (Police Police, Police Pu)
- 2 DVLA services (DVLA Change Address Driving Licence, DVLA Vehicle Tax)
- 4 DWP services
- 4 Home Office services
- 4 NHS services
- 6 OTHER-GOVERNMENT services
- 1 Companies House service

**Action:** These should be **removed** before merging the full discovery files to avoid confusion with properly-named services.

---

## 3. Merge Strategy

### 3.1 Merge Order (Priority-Based)

**Order Rationale:** Merge critical services first to ensure emergency infrastructure is monitored before general services.

1. **Emergency Services** (122 services) - Life-critical infrastructure
2. **NHS Services** (6,503 services) - Healthcare infrastructure
3. **Government Services** (281 services) - General government services

### 3.2 Pre-Merge Preparation

**Step 1: Backup Root Config**
```bash
cp config.yaml config.yaml.backup.$(date +%Y%m%d-%H%M%S)
```

**Step 2: Remove POC Services from Root**
- Delete lines 2081-2492 (Feature 002 POC section)
- This removes the 23 sample services to avoid conflicts

**Step 3: Validate Root Config Structure**
```bash
# Ensure settings block is intact
head -10 config.yaml

# Ensure pings array structure is correct
grep -n "^pings:" config.yaml
```

### 3.3 Extraction Strategy

For each discovery file, extract **only the pings array content** (skip settings):

```bash
# Extract emergency services (skip first 12 lines - settings block)
tail -n +13 emergency-services.yaml > emergency-services-pings-only.yaml

# Extract NHS services (skip first 12 lines - settings block)
tail -n +13 nhs-services.yaml > nhs-services-pings-only.yaml

# Extract government services (skip first 12 lines - settings block)
tail -n +13 government-services.yaml > government-services-pings-only.yaml
```

### 3.4 De-Duplication Filter

Create a temporary script to filter out duplicate service names:

```bash
# Extract existing service names from root config
grep "^  - name:" config.yaml | sed 's/^  - name: //' | sort > existing-services.txt

# Filter function (to be applied during merge)
filter_duplicates() {
  local input_file="$1"
  local output_file="$2"

  awk '
    BEGIN {
      while ((getline < "existing-services.txt") > 0) {
        existing[$0] = 1
      }
      skip = 0
    }
    /^  - name:/ {
      service_name = substr($0, 11)  # Extract name after "  - name: "
      if (service_name in existing) {
        skip = 1
        next
      } else {
        skip = 0
      }
    }
    !skip { print }
  ' "$input_file" > "$output_file"
}
```

### 3.5 Merge Execution Steps

**Approach:** Append discovery services to the root `pings:` array, preserving all structure.

```bash
# Step 1: Create working copy
cp config.yaml config.yaml.working

# Step 2: Append Emergency Services (filtered)
tail -n +13 emergency-services.yaml | \
  grep -v "^settings:" | \
  grep -v "^pings:" | \
  grep -v "^$" | \
  sed '/^  - name: East of England Ambulance Service NHS Trust/,/^  - name: YOUR NEXT SERVICE/d' \
  >> config.yaml.working

# Step 3: Append NHS Services (filtered)
tail -n +13 nhs-services.yaml | \
  grep -v "^settings:" | \
  grep -v "^pings:" | \
  grep -v "^$" \
  >> config.yaml.working

# Step 4: Append Government Services (filtered)
tail -n +13 government-services.yaml | \
  grep -v "^settings:" | \
  grep -v "^pings:" | \
  grep -v "^$" \
  >> config.yaml.working
```

**Critical:** The above commands are **simplified examples**. The actual merge requires careful handling of:
- YAML indentation (2 spaces for service entries)
- Comment preservation (category headers)
- Duplicate detection (service name matching)
- Line ending consistency

---

## 4. Recommended Implementation: Node.js Merge Script

Given the complexity and risks, **recommend creating a Node.js merge script** rather than manual bash operations.

### 4.1 Script Requirements

```typescript
// scripts/merge-discovery-to-config.ts

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

interface Service {
  name: string;
  protocol: string;
  method: string;
  resource: string;
  tags: string[];
  expected: {
    status: number;
    text?: string;
  };
  interval?: number;
  warning_threshold?: number;
  timeout?: number;
  headers?: Array<{ name: string; value: string }>;
  payload?: Record<string, unknown>;
}

interface Config {
  settings: {
    check_interval: number;
    warning_threshold: number;
    timeout: number;
    page_refresh: number;
    max_retries: number;
    worker_pool_size: number;
  };
  pings: Service[];
}

function mergeDiscoveryToConfig(): void {
  const rootConfigPath = path.join(__dirname, '../config.yaml');
  const emergencyPath = path.join(__dirname, '../specs/002-add-9500-public-services/research-data/emergency-services.yaml');
  const nhsPath = path.join(__dirname, '../specs/002-add-9500-public-services/research-data/nhs-services.yaml');
  const govPath = path.join(__dirname, '../specs/002-add-9500-public-services/research-data/government-services.yaml');

  // 1. Load root config
  const rootConfig = yaml.load(fs.readFileSync(rootConfigPath, 'utf8')) as Config;
  const originalServiceCount = rootConfig.pings.length;

  // 2. Remove Feature 002 POC services (lines 2081-2492 equivalent)
  // Identify POC services by comment marker
  const pocMarkerIndex = rootConfig.pings.findIndex(s =>
    s.name === 'Police Police' || s.name === 'Police Pu'
  );
  if (pocMarkerIndex !== -1) {
    rootConfig.pings = rootConfig.pings.slice(0, pocMarkerIndex);
    console.log(`Removed ${originalServiceCount - rootConfig.pings.length} POC services`);
  }

  // 3. Build service name index for duplicate detection
  const existingServiceNames = new Set(rootConfig.pings.map(s => s.name));

  // 4. Load discovery files (in priority order)
  const emergencyConfig = yaml.load(fs.readFileSync(emergencyPath, 'utf8')) as Config;
  const nhsConfig = yaml.load(fs.readFileSync(nhsPath, 'utf8')) as Config;
  const govConfig = yaml.load(fs.readFileSync(govPath, 'utf8')) as Config;

  // 5. Merge services (skip duplicates)
  const discoveryFiles = [
    { name: 'Emergency Services', config: emergencyConfig },
    { name: 'NHS Services', config: nhsConfig },
    { name: 'Government Services', config: govConfig }
  ];

  let addedCount = 0;
  let skippedCount = 0;

  for (const { name: fileName, config } of discoveryFiles) {
    console.log(`\nMerging: ${fileName}`);

    for (const service of config.pings) {
      if (existingServiceNames.has(service.name)) {
        console.log(`  [SKIP] Duplicate: ${service.name}`);
        skippedCount++;
      } else {
        rootConfig.pings.push(service);
        existingServiceNames.add(service.name);
        addedCount++;
      }
    }

    console.log(`  Added: ${config.pings.length - (config.pings.length - addedCount)}`);
  }

  // 6. Write merged config
  const outputPath = path.join(__dirname, '../config.yaml.merged');
  const yamlOutput = yaml.dump(rootConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });

  fs.writeFileSync(outputPath, yamlOutput, 'utf8');

  // 7. Report
  console.log(`\n=== MERGE COMPLETE ===`);
  console.log(`Original services: ${originalServiceCount}`);
  console.log(`Services added: ${addedCount}`);
  console.log(`Services skipped (duplicates): ${skippedCount}`);
  console.log(`Final service count: ${rootConfig.pings.length}`);
  console.log(`\nMerged config written to: ${outputPath}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review merged config: config.yaml.merged`);
  console.log(`2. Validate YAML syntax`);
  console.log(`3. Run test suite`);
  console.log(`4. Replace config.yaml with config.yaml.merged`);
}

mergeDiscoveryToConfig();
```

### 4.2 Script Execution

```bash
# Install dependencies (if needed)
npm install js-yaml @types/js-yaml

# Run merge script
npx tsx scripts/merge-discovery-to-config.ts

# Expected output:
# Merging: Emergency Services
#   [SKIP] Duplicate: ...
#   Added: 122
# Merging: NHS Services
#   Added: 6503
# Merging: Government Services
#   [SKIP] Duplicate: Companies House Find And Update
#   ...
#   Added: 270
#
# === MERGE COMPLETE ===
# Original services: 205
# Services added: 6895
# Services skipped (duplicates): 11
# Final service count: 7100
```

---

## 5. Validation Procedures

### 5.1 Pre-Merge Validation

**Before executing merge:**

```bash
# 1. Validate all source YAML files
npx js-yaml config.yaml
npx js-yaml specs/002-add-9500-public-services/research-data/emergency-services.yaml
npx js-yaml specs/002-add-9500-public-services/research-data/nhs-services.yaml
npx js-yaml specs/002-add-9500-public-services/research-data/government-services.yaml

# 2. Count services in each file
grep -c "^  - name:" config.yaml
grep -c "^  - name:" specs/002-add-9500-public-services/research-data/emergency-services.yaml
grep -c "^  - name:" specs/002-add-9500-public-services/research-data/nhs-services.yaml
grep -c "^  - name:" specs/002-add-9500-public-services/research-data/government-services.yaml

# 3. Check for YAML syntax errors
yamllint config.yaml --strict
```

### 5.2 Post-Merge Validation

**After merge script execution:**

```bash
# 1. Validate merged YAML syntax
npx js-yaml config.yaml.merged

# 2. Verify service count
EXPECTED_COUNT=7111  # 205 (original) - 23 (POC removed) + 6906 (new) - 11 (duplicates) = 7077
ACTUAL_COUNT=$(grep -c "^  - name:" config.yaml.merged)
echo "Expected: $EXPECTED_COUNT, Actual: $ACTUAL_COUNT"

# 3. Check settings block preservation
head -10 config.yaml.merged | diff - <(head -10 config.yaml)

# 4. Verify no duplicate names
grep "^  - name:" config.yaml.merged | sort | uniq -d

# 5. Validate all services have required fields
grep -A 10 "^  - name:" config.yaml.merged | grep -E "protocol:|method:|resource:|expected:" | wc -l

# 6. Run JSON Schema validation (if available)
npx tsx scripts/validate-yaml.ts config.yaml.merged
```

### 5.3 Functional Validation

**Test merged config with monitoring system:**

```bash
# 1. Dry-run health check (if implemented)
npx tsx src/index.ts --config config.yaml.merged --dry-run

# 2. Test first 10 services
npx tsx src/index.ts --config config.yaml.merged --limit 10

# 3. Run full test suite (if available)
npm test -- --config=config.yaml.merged
```

---

## 6. File Size and Performance Considerations

### 6.1 Projected File Size

| Metric | Current | Post-Merge | Change |
|--------|---------|------------|--------|
| File Size | 57 KB | ~2.4 MB | +4,121% |
| Line Count | 2,492 | ~126,616 | +5,080% |
| Service Count | 205 | 7,111 | +3,369% |
| Avg Bytes/Service | 278 B | 337 B | +21% |

**Performance Implications:**

1. **YAML Parsing:** 2.4 MB YAML file will parse in <100ms with `js-yaml` (acceptable)
2. **Memory Usage:** ~10-15 MB in memory (insignificant)
3. **Git Operations:** Larger diffs, but manageable with Git LFS if needed
4. **Health Check Concurrency:** Worker pool (2x CPU cores) will handle 7,111 services efficiently

**Recommendation:** No performance concerns. Proceed with merge.

### 6.2 Git LFS Consideration

**Current:** `config.yaml` is 57 KB (below Git LFS threshold)
**Post-Merge:** `config.yaml` will be 2.4 MB

**Decision:** Enable Git LFS for `config.yaml` if repo size becomes a concern:

```bash
# Optional: Enable Git LFS for large config
git lfs track "config.yaml"
git add .gitattributes
git commit -m "chore: enable Git LFS for config.yaml"
```

**Current Recommendation:** **Do not enable Git LFS yet**. Monitor repo size and enable only if cloning/pushing becomes slow.

---

## 7. Step-by-Step Implementation Procedure

### Phase 1: Preparation (5 minutes)

```bash
# 1.1: Navigate to project root
cd /Users/cns/httpdocs/cddo/status

# 1.2: Ensure clean working directory
git status

# 1.3: Backup current config
cp config.yaml config.yaml.backup.$(date +%Y%m%d-%H%M%S)

# 1.4: Verify backup
ls -lh config.yaml.backup.*
```

### Phase 2: Merge Script Execution (2 minutes)

```bash
# 2.1: Run merge script
npx tsx scripts/merge-discovery-to-config.ts

# Expected output:
# Removed 23 POC services
#
# Merging: Emergency Services
#   Added: 122
# Merging: NHS Services
#   Added: 6503
# Merging: Government Services
#   [SKIP] Duplicate: Companies House Find And Update
#   [SKIP] Duplicate: DVLA Change Address Driving Licence
#   [... 9 more duplicates ...]
#   Added: 270
#
# === MERGE COMPLETE ===
# Original services: 205
# Services added: 6895
# Services skipped (duplicates): 11
# Final service count: 7077
#
# Merged config written to: config.yaml.merged

# 2.2: Verify merge output
ls -lh config.yaml.merged
```

### Phase 3: Validation (10 minutes)

```bash
# 3.1: Validate YAML syntax
npx js-yaml config.yaml.merged > /dev/null && echo "YAML syntax valid" || echo "YAML syntax ERROR"

# 3.2: Verify service count
ACTUAL=$(grep -c "^  - name:" config.yaml.merged)
echo "Service count: $ACTUAL (expected ~7077)"

# 3.3: Check for duplicate names
DUPLICATES=$(grep "^  - name:" config.yaml.merged | sort | uniq -d | wc -l)
echo "Duplicate service names: $DUPLICATES (expected 0)"

# 3.4: Verify settings block
head -10 config.yaml.merged

# 3.5: Test parse with validation script (if available)
npx tsx scripts/validate-yaml.ts config.yaml.merged

# 3.6: Spot-check random services
grep "^  - name:" config.yaml.merged | shuf | head -10
```

### Phase 4: Dry-Run Testing (15 minutes)

```bash
# 4.1: Test first 10 services (if orchestrator supports --limit)
# npx tsx src/index.ts --config config.yaml.merged --limit 10 --dry-run

# 4.2: Run test suite with merged config (if available)
# npm test -- --config=config.yaml.merged

# 4.3: Manual spot-check of critical services
# curl -I https://111.nhs.uk/
# curl -I https://www.police.uk/
# curl -I https://www.gov.uk/
```

### Phase 5: Commit and Deploy (5 minutes)

```bash
# 5.1: Replace production config
mv config.yaml.merged config.yaml

# 5.2: Verify replacement
wc -l config.yaml
grep -c "^  - name:" config.yaml

# 5.3: Stage changes
git add config.yaml

# 5.4: Commit with detailed message
git commit -m "feat: merge 6,895 validated UK public services for MVP release (002)

- Merged emergency services (122 services)
- Merged NHS services (6,503 services)
- Merged government services (270 services, 11 duplicates skipped)
- Removed 23 POC services from root config
- Final service count: 7,077 (up from 205)

Validation:
- YAML syntax validated with js-yaml
- Zero duplicate service names
- Settings block preserved
- All services have required fields (protocol, method, resource, expected)

Related: specs/002-add-9500-public-services/MERGE-AND-IMPLEMENTATION-PLAN.md"

# 5.5: Push to remote
git push origin 002-add-9500-public-services

# 5.6: Create PR
gh pr create --title "feat: merge 6,895 validated UK public services for MVP (002)" \
  --body "$(cat <<'EOF'
## Summary

Merges 6,895 validated UK public services into root config.yaml for MVP release.

### Changes
- **Emergency Services:** 122 services (police, fire, ambulance)
- **NHS Services:** 6,503 services (hospitals, trusts, health services)
- **Government Services:** 270 services (HMRC, DVLA, DWP, Home Office)
- **Duplicates Skipped:** 11 services (existing root config preserved)
- **POC Services Removed:** 23 services (replaced with properly-named services)

### Validation
- [x] YAML syntax validated
- [x] Zero duplicate service names
- [x] Settings block preserved
- [x] All services have required fields
- [x] Service count verified: 7,077

### Test Plan
- [ ] Run health check orchestrator against merged config
- [ ] Verify first 100 services respond correctly
- [ ] Check monitoring dashboard displays all services
- [ ] Validate tag filtering works (NHS, emergency, government)
- [ ] Test auto-refresh functionality

### File Size
- **Before:** 57 KB, 205 services
- **After:** 2.4 MB, 7,077 services
- **Impact:** +4,121% size, +3,369% services

### Related Documentation
- Merge Plan: specs/002-add-9500-public-services/MERGE-AND-IMPLEMENTATION-PLAN.md
- Validation Pipeline: specs/002-add-9500-public-services/VALIDATION-PIPELINE-REPORT.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 8. Rollback Procedures

### 8.1 Pre-Deployment Rollback

**If validation fails before commit:**

```bash
# Restore original config
cp config.yaml.backup.TIMESTAMP config.yaml

# Verify restoration
diff config.yaml config.yaml.backup.TIMESTAMP
```

### 8.2 Post-Commit Rollback

**If issues discovered after commit but before PR merge:**

```bash
# Revert last commit
git revert HEAD

# Or reset to previous commit (destructive)
git reset --hard HEAD~1
git push --force origin 002-add-9500-public-services
```

### 8.3 Post-Deployment Rollback

**If issues discovered after PR merge to main:**

```bash
# Create rollback branch
git checkout main
git checkout -b rollback/002-merge-services

# Revert merge commit
git revert -m 1 MERGE_COMMIT_SHA

# Push rollback
git push origin rollback/002-merge-services

# Create rollback PR
gh pr create --title "rollback: revert 6,895 service merge (002)" \
  --body "Rolling back service merge due to: [REASON]"
```

### 8.4 Emergency Rollback (Production Down)

**If merged config causes production outage:**

```bash
# IMMEDIATE: Restore backup directly to main
git checkout main
git checkout HEAD~1 -- config.yaml
git commit -m "emergency: rollback config.yaml to previous version"
git push origin main

# Notify team
echo "EMERGENCY ROLLBACK: config.yaml reverted to previous version" | \
  mail -s "URGENT: Service Config Rollback" team@example.com
```

---

## 9. Risk Assessment

### 9.1 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **YAML Syntax Error** | Low | High | Pre-merge validation, js-yaml parser |
| **Duplicate Services** | Medium | Medium | Automated duplicate detection in merge script |
| **Service Name Conflicts** | Low | Medium | Manual review of 11 known duplicates |
| **File Too Large for Git** | Low | Low | Enable Git LFS if needed |
| **Performance Degradation** | Very Low | Medium | Test with --limit flag first |
| **Production Outage** | Very Low | High | Dry-run testing, rollback procedure |

### 9.2 Acceptance Criteria

**Merge is considered successful if:**

1. ✅ YAML syntax validates with `js-yaml`
2. ✅ Service count is 7,077 ± 5 services
3. ✅ Zero duplicate service names detected
4. ✅ Settings block matches original root config
5. ✅ All services have required fields (protocol, method, resource, expected)
6. ✅ First 10 test services respond successfully
7. ✅ Git commit completes without errors
8. ✅ CI/CD pipeline passes all tests

---

## 10. Success Metrics

### 10.1 Merge Metrics

- **Total Services Before:** 205
- **Services Added:** 6,895
- **Services Removed (POC):** 23
- **Duplicates Skipped:** 11
- **Total Services After:** 7,077
- **Merge Success Rate:** 99.8% (6,895/6,906)

### 10.2 Validation Metrics

- **YAML Syntax Errors:** 0
- **Duplicate Service Names:** 0
- **Missing Required Fields:** 0
- **File Size:** 2.4 MB (within acceptable range)
- **Validation Time:** <2 minutes

### 10.3 Performance Metrics (Post-Deploy)

- **Health Check Completion Time:** <10 minutes (all 7,077 services)
- **Page Load Time:** <2 seconds
- **Memory Usage:** <500 MB
- **Worker Pool Utilization:** 80-90%

---

## 11. Post-Merge Tasks

### 11.1 Documentation Updates

- [ ] Update `README.md` with new service count (7,077)
- [ ] Update `specs/002-add-9500-public-services/IMPLEMENTATION_STATUS.md`
- [ ] Add merge completion note to `specs/002-add-9500-public-services/tasks.md`
- [ ] Create `MERGE-COMPLETION-REPORT.md` with final metrics

### 11.2 Monitoring Setup

- [ ] Verify all 7,077 services appear in monitoring dashboard
- [ ] Test tag filtering (NHS, emergency, government, high-volume, critical)
- [ ] Set up alerts for service failures (if not already configured)
- [ ] Monitor first 24 hours for anomalies

### 11.3 Team Communication

- [ ] Notify team of successful merge via Slack/email
- [ ] Share monitoring dashboard URL
- [ ] Document any unexpected findings
- [ ] Schedule retrospective meeting

---

## 12. Appendix: Alternative Merge Approaches

### 12.1 Manual Copy-Paste (Not Recommended)

**Pros:** Simple, no scripting required
**Cons:** Error-prone, no duplicate detection, tedious

**Steps:**
1. Open `config.yaml` in editor
2. Copy service blocks from discovery files
3. Paste into `pings:` array
4. Manually remove duplicates

**Risk:** Very high (human error, missed duplicates)

### 12.2 Bash-Only Merge (Not Recommended)

**Pros:** No Node.js dependency
**Cons:** Complex awk/sed scripting, difficult to debug

**Example:**
```bash
cat config.yaml \
  <(tail -n +13 emergency-services.yaml | grep -v "^settings:" | grep -v "^pings:") \
  <(tail -n +13 nhs-services.yaml | grep -v "^settings:" | grep -v "^pings:") \
  <(tail -n +13 government-services.yaml | grep -v "^settings:" | grep -v "^pings:") \
  > config.yaml.merged
```

**Risk:** High (no duplicate detection, indentation issues)

### 12.3 Python Merge Script (Alternative to Node.js)

**Pros:** Similar to Node.js approach, Python widely available
**Cons:** Requires PyYAML dependency

**Recommendation:** Use Node.js approach (Section 4) for consistency with existing TypeScript project.

---

## 13. Conclusion

This merge plan provides a **safe, validated, and automated approach** to merging 6,906 UK public services into the production config. The Node.js merge script ensures:

- ✅ Zero data loss
- ✅ Automated duplicate detection
- ✅ Preserved root config settings
- ✅ Valid YAML syntax
- ✅ Comprehensive validation checks

**Estimated Total Time:** 37 minutes
**Risk Level:** Low (with automated merge script and rollback procedures)

**Next Steps:**
1. Review this plan with team
2. Execute merge script (Phase 2)
3. Validate merged config (Phase 3)
4. Commit and create PR (Phase 5)
5. Monitor first 24 hours post-merge

---

**Document Owner:** Claude Code Agent
**Last Updated:** 2025-10-26
**Version:** 1.0
