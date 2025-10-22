# Security Documentation

## GitHub Actions Workflow Security

This document describes the security model for GitHub Actions workflows in the GOV.UK Status Monitor project, per FR-037a requirements.

## Security Principles

### 1. Principle of Least Privilege (FR-037a)

**Definition**: Each workflow receives ONLY the minimum permissions required to perform its function.

**Implementation**: All workflows MUST have an explicit `permissions:` block. Default permissions are NEVER used.

### 2. Explicit Permissions Only

**Requirement**: Every workflow must declare its required permissions explicitly.

**Rationale**: GitHub Actions default permissions (`permissions: write-all`) grant excessive access and violate the principle of least privilege.

## Workflow Permission Matrix

| Workflow | Contents | Pages | Pull Requests | ID Token | Rationale |
|----------|----------|-------|---------------|----------|-----------|
| **test.yml** | `read` | - | - | - | Read code for testing only |
| **smoke-test.yml** | `read` | - | `write` | - | Read code + post PR comments |
| **deploy.yml** | `read` | `write` | - | `write` | Read code + deploy to Pages |

### test.yml Permissions

```yaml
permissions:
  contents: read
```

**Justification**:
- `contents:read`: Required to checkout repository code
- No write permissions: Tests are read-only operations
- No PR comment permissions: Test results visible in workflow logs

**Security Impact**: Minimal attack surface. Compromised workflow cannot modify repository or create PRs.

### smoke-test.yml Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

**Justification**:
- `contents:read`: Required to checkout code and read `config.yaml`
- `pull-requests:write`: Required to post smoke test results as PR comments per FR-038

**Security Impact**: Low. Workflow can post comments but cannot modify code or merge PRs.

### deploy.yml Permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

**Justification**:
- `contents:read`: Required to checkout code for building
- `pages:write`: Required to deploy artifacts to GitHub Pages
- `id-token:write`: Required for OIDC authentication with GitHub Pages deployment

**Security Impact**: Medium. Workflow can deploy to Pages but cannot modify repository code.

## Research Findings

### Sources Consulted

1. **GitHub Actions Security Best Practices (Official Documentation)**
   - [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
   - [Automatic token authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)

2. **OWASP Top 10 CI/CD Security Risks**
   - [Insufficient workflow permissions](https://owasp.org/www-project-top-10-ci-cd-security-risks/)

3. **Community Best Practices**
   - StepSecurity GitHub Actions Security Guide
   - Snyk's GitHub Actions Security Cheat Sheet

### Key Findings

#### 1. Default Permissions Are Overly Permissive

GitHub Actions workflows default to `permissions: write-all` if not specified, granting:
- Full repository write access
- Issue/PR creation and modification
- Workflow modification
- Package publishing

**Impact**: Workflow compromise could lead to repository takeover.

**Mitigation**: Always use explicit `permissions:` blocks.

#### 2. Token Scope Minimization

The `GITHUB_TOKEN` should be scoped to the minimum permissions required:
- Use `read` when only reading data
- Use `write` only when modifying resources
- Never use `write-all`

#### 3. Third-Party Actions Are Trust Boundaries

Actions from third-party repositories (`uses: external/action@v1`) execute with workflow permissions.

**Mitigation Strategies**:
1. Pin actions to specific commit SHAs: `uses: actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675`
2. Review action source code before use
3. Prefer actions from verified creators (@actions, @github)
4. Use Dependabot to monitor action updates

### Threat Model

#### Threat 1: Malicious PR from External Contributor

**Scenario**: Attacker submits PR with malicious code in workflow

**Mitigations**:
1. Workflows from PR forks use read-only `GITHUB_TOKEN`
2. `pull_request_target` trigger NOT used (prevents fork access to secrets)
3. Branch protection requires approval before merge

#### Threat 2: Compromised Dependency

**Scenario**: Malicious npm package in dependency tree exfiltrates secrets

**Mitigations**:
1. No secrets used in workflows (all public data)
2. Least-privilege permissions limit damage
3. Dependabot monitors dependency updates
4. `npm audit` run in CI (via `pnpm install`)

#### Threat 3: Workflow Injection Attack

**Scenario**: Attacker injects malicious code via workflow expression: `${{ github.event.issue.title }}`

**Mitigations**:
1. Never use untrusted input in `run:` commands without sanitization
2. Use `github.event` properties only in safe contexts
3. Prefer `actions/github-script` for dynamic operations (auto-sanitizes)

### Permission Decision Rationale

#### Why test.yml Has Only `contents:read`

**Requirement**: Run tests on PR code

**Alternatives Considered**:
- `contents:write`: Not needed (tests are read-only)
- `pull-requests:write`: Not needed (results in workflow logs)

**Decision**: Minimum permissions = `contents:read`

#### Why smoke-test.yml Has `pull-requests:write`

**Requirement**: Post formatted PR comment with health check results (FR-038)

**Alternatives Considered**:
- Store results in artifact (requires manual download)
- Log results only (not visible to non-developers)

**Decision**: `pull-requests:write` required for automatic PR feedback

#### Why deploy.yml Needs `id-token:write`

**Requirement**: Deploy to GitHub Pages using OIDC authentication

**Technical Context**: GitHub Pages deployment requires:
1. `pages:write`: Permission to deploy
2. `id-token:write`: Generate OIDC token for authentication

**Alternatives Considered**:
- Personal Access Token: Violates principle of automation
- Deploy key: Unnecessary complexity

**Decision**: Use built-in OIDC authentication (industry best practice)

## Security Monitoring

### Workflow Audit

**Frequency**: Every dependency update, every workflow change

**Checklist**:
- [ ] All workflows have explicit `permissions:` blocks
- [ ] No workflow uses `permissions: write-all`
- [ ] Third-party actions pinned to commit SHAs
- [ ] No secrets in workflow logs
- [ ] No untrusted input in `run:` commands

### Dependency Security

```bash
# Audit npm dependencies
pnpm audit

# Check for known vulnerabilities
pnpm audit --audit-level=moderate

# Update vulnerable dependencies
pnpm update --latest
```

### Action Security

```bash
# List all third-party actions
grep -r "uses:" .github/workflows/ | grep -v "actions/" | grep -v "github/"

# Review action source code
gh repo view {action-repo} --web
```

## Compliance

This security model complies with:
- FR-037: "GitHub Actions workflows follow least-privilege principle"
- FR-037a: "All workflows specify explicit permissions blocks"
- OWASP Top 10 CI/CD Security Risks mitigation
- GitHub Security Best Practices

## References

1. [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
2. [Automatic Token Authentication](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
3. [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/)
4. [StepSecurity GitHub Actions Security](https://www.stepsecurity.io/blog/github-actions-security-best-practices)
5. [Snyk GitHub Actions Cheat Sheet](https://snyk.io/blog/ten-git-hub-security-best-practices/)

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-22 | Initial security documentation | Claude Code |

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
**Classification**: Public
