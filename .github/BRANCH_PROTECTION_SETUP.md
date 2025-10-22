# Branch Protection Setup Instructions (T024)

## Option 1: Upload Ruleset via GitHub UI (Recommended)

1. Navigate to your repository settings
2. Go to **Settings → Rules → Rulesets**
3. Click **"New ruleset" → "New branch ruleset"**
4. Configure the following settings:

### Ruleset Configuration

**Ruleset Name**: `Main Branch Protection`

**Enforcement Status**: Active

**Target Branches**:
- Branch name pattern: `main`

### Rules to Enable:

#### ✅ Require Pull Request
- **Required approvals**: 1
- ☑ Dismiss stale pull request approvals when new commits are pushed
- ☑ Require approval of the most recent reviewable push
- ☑ Require conversation resolution before merging

#### ✅ Require Status Checks
- ☑ Require branches to be up to date before merging
- **Required status checks**:
  - `test` (from test.yml workflow)
  - `Run All Tests` (job name from test.yml)
  - `smoke-test` (from smoke-test.yml workflow, only runs on config.yaml changes)

#### ✅ Block Force Pushes
- Prevents force pushes to protected branches

#### ✅ Require Linear History
- Enforces a linear commit history

#### ✅ Restrict Deletions
- Prevents deletion of the main branch

**Bypass List**:
- Repository administrators (for emergency fixes)

---

## Option 2: Upload via GitHub CLI

```bash
# Upload the ruleset JSON (if GitHub supports this format)
gh api repos/:owner/:repo/rulesets \
  -X POST \
  --input .github/branch-protection-ruleset.json
```

**Note**: The JSON format may need adjustment based on GitHub's API version. If the above fails, use Option 1 (GitHub UI).

---

## Option 3: Classic Branch Protection (Legacy API)

If rulesets aren't available, use classic branch protection:

```bash
gh api repos/:owner/:repo/branches/main/protection \
  -X PUT \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]=test \
  -f required_status_checks[contexts][]="Run All Tests" \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[require_code_owner_reviews]=false \
  -f enforce_admins=false \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

---

## Verification

After setting up branch protection, verify it's working:

```bash
# Check protection status
gh api repos/:owner/:repo/branches/main/protection | jq

# Expected output should show:
# - required_status_checks with contexts: ["test", "Run All Tests"]
# - required_pull_request_reviews with required_approving_review_count: 1
# - enforce_admins: false
# - required_linear_history: true
# - allow_force_pushes: false
# - allow_deletions: false
```

---

## Troubleshooting

### Status Check Names Don't Match

If workflows fail to show as required checks:

1. Trigger both workflows manually:
   ```bash
   gh workflow run test.yml
   gh workflow run smoke-test.yml
   ```

2. Check actual workflow job names:
   ```bash
   gh run list --workflow=test.yml --limit=1
   gh api repos/:owner/:repo/actions/runs/{run_id}/jobs | jq '.jobs[].name'
   ```

3. Update the required status checks to match the actual job names

### Can't Find Rulesets Option

If your repository doesn't have the "Rulesets" option:
- Use **Option 3** (Classic Branch Protection)
- Rulesets are a newer GitHub feature and may not be available on all plans

---

## Per FR-041 Requirements

This configuration ensures:
- ✅ **PR Approval Required**: Prevents direct pushes to main
- ✅ **CI Tests Must Pass**: Blocks merge if tests fail
- ✅ **Config Changes Validated**: smoke-test.yml runs on config.yaml changes
- ✅ **Application Tests Run**: test.yml runs on code changes
- ✅ **No Force Pushes**: Protects commit history
- ✅ **Linear History**: Enforces clean commit graph

**Status**: Per FR-041, this is a **one-time setup task** performed by repository administrator.

---

**Last Updated**: 2025-10-22
**Task**: T024
**Related**: FR-041 (Branch Protection Requirements)
