# Quickstart: UK Public Service Discovery Researcher Guide

**Feature**: 002-add-9500-public-services
**Last Updated**: 2025-10-26

This guide helps researchers quickly set up discovery tools, execute service discovery, validate findings, and transform results into config.yaml entries for the GOV.UK Public Services Status Monitor.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Discovery Workflow](#discovery-workflow)
4. [Running Discovery Tools](#running-discovery-tools)
5. [Validation and Deduplication](#validation-and-deduplication)
6. [Transformation to config.yaml](#transformation-to-configyaml)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: v22.11.0 or later (LTS recommended)
  ```bash
  node --version  # Should be >= 22.11.0
  ```

- **npm**: v10+ (comes with Node.js 22)
  ```bash
  npm --version
  ```

- **Go**: v1.21+ (required for subfinder and amass)
  ```bash
  go version  # Should be >= 1.21
  ```

- **Git**: For version control and GitHub searches
  ```bash
  git --version
  ```

### Discovery Tools

**Primary DNS Enumeration:**
- **Subfinder v2.6+**: Fast passive subdomain enumeration
  ```bash
  go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
  subfinder -version
  ```

**Secondary DNS Enumeration:**
- **Amass v4+**: Comprehensive subdomain discovery
  ```bash
  go install -v github.com/owasp-amass/amass/v4/...@master
  amass -version
  ```

**Certificate Transparency:**
- **crt.sh API**: Query via curl (no installation needed)
  ```bash
  curl -s "https://crt.sh/?q=%.services.gov.uk&output=json" | jq
  ```

**HTTP Client Tools:**
- **curl**: For manual HTTP testing
- **jq**: For JSON processing
  ```bash
  brew install jq  # macOS
  sudo apt install jq  # Ubuntu/Debian
  ```

### Node.js Dependencies

The following will be installed via npm (see Installation section):

- **undici v7+**: High-performance HTTP client
- **ajv v8+**: JSON Schema validation
- **yaml**: YAML generation with comment support
- **normalize-url**: RFC 3986 URL normalization

### System Requirements

- **Operating System**: Linux or macOS (Windows with WSL2)
- **RAM**: 8GB minimum, 16GB recommended (for Amass intensive scans)
- **Disk Space**: 2GB for tools and data artifacts
- **Network**: Unrestricted internet access for DNS queries and HTTP requests

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/status-monitor.git
cd status-monitor
```

### 2. Checkout Feature Branch

```bash
git checkout 002-add-9500-public-services
```

### 3. Install Node.js Dependencies

```bash
npm install
```

This installs:
- undici (HTTP client)
- ajv (JSON Schema validator)
- yaml (YAML generator with comment support)
- normalize-url (URL normalization)
- TypeScript and development tools

### 4. Install Discovery Tools

**Subfinder** (Primary DNS tool):
```bash
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Add to PATH (if not already)
export PATH=$PATH:~/go/bin
echo 'export PATH=$PATH:~/go/bin' >> ~/.bashrc  # or ~/.zshrc

# Verify installation
subfinder -version
```

**Amass** (Secondary DNS tool):
```bash
go install -v github.com/owasp-amass/amass/v4/...@master

# Verify installation
amass -version
```

**Optional: Enhanced Subfinder Sources** (recommended for better coverage):
```bash
# Create config file for API keys (free tier)
mkdir -p ~/.config/subfinder
cat > ~/.config/subfinder/provider-config.yaml << 'EOF'
binaryedge:
  - <your-api-key>
censys:
  - <censys-api-id>:<censys-api-secret>
certspotter: <your-api-key>
shodan: <your-api-key>
virustotal: <your-api-key>
EOF
```

[Get free API keys from sources in research.md section 1]

### 5. Verify Installation

```bash
# Check Node.js dependencies
npm run verify-tools

# Check discovery tools
subfinder -version
amass -version
curl -s "https://crt.sh/?q=%.gov.uk&output=json" | jq '. | length'
```

Expected output:
```
✓ Node.js v22.11.0
✓ undici v7.x.x
✓ ajv v8.x.x
✓ yaml v2.x.x
✓ subfinder v2.6.x
✓ amass v4.x.x
✓ crt.sh API accessible
```

## Discovery Workflow

The research process follows 3 phases (from spec.md):

```
Phase 1: Breadth-First Discovery
    → Minimum coverage across all categories
    → Government departments, NHS, emergency, local gov, third-party
    ↓
Phase 2: Depth by Criticality
    → Deepen coverage prioritizing life-critical services
    → NHS emergency, 999/111, HMRC, DWP, Home Office
    ↓
Phase 3: Exhaustive Continuation
    → Continue beyond 9500 minimum until all discoverable services documented
```

### Workflow Steps

1. **Discovery**: Use DNS tools, web search, CT logs to find service URLs
2. **Normalization**: Apply RFC 3986 URL normalization
3. **Redirect Resolution**: Follow HTTP redirects to canonical URLs (max 5 hops)
4. **Deduplication**: Remove duplicate canonical URLs
5. **Validation**: Verify accessibility and extract validation text
6. **Categorization**: Apply 74-tag taxonomy
7. **Transformation**: Generate Service Entry entities
8. **YAML Generation**: Write to config.yaml with comments and formatting

## Running Discovery Tools

### Phase 1: DNS Enumeration

**Discover *.services.gov.uk subdomains** (Subfinder - fast):

```bash
# Basic enumeration (30-60 seconds, ~500 subdomains)
subfinder -d services.gov.uk -o discovered/services-gov-uk.txt

# With enhanced sources (2-5 minutes, ~800+ subdomains)
subfinder -d services.gov.uk -config ~/.config/subfinder/provider-config.yaml -o discovered/services-gov-uk-enhanced.txt

# Silent mode (no progress output)
subfinder -d services.gov.uk -silent -o discovered/services-gov-uk.txt
```

**Discover *.nhs.uk subdomains**:

```bash
subfinder -d nhs.uk -o discovered/nhs-uk.txt
subfinder -d nhs.wales -o discovered/nhs-wales.txt
subfinder -d scot.nhs.uk -o discovered/nhs-scotland.txt
```

**Discover *.gov.uk subdomains** (comprehensive - takes 20+ minutes):

```bash
# Use Amass for thorough discovery (slower but more complete)
amass enum -passive -d gov.uk -o discovered/gov-uk-amass.txt

# Or use Subfinder with recursion (faster)
subfinder -d gov.uk -recursive -o discovered/gov-uk-recursive.txt
```

### Phase 2: Certificate Transparency Logs

**Query crt.sh for *.services.gov.uk certificates**:

```bash
# Query crt.sh API
curl -s "https://crt.sh/?q=%.services.gov.uk&output=json" | \
  jq -r '.[].name_value' | \
  sed 's/^\*\.//g' | \
  sort -u > discovered/services-gov-uk-crtsh.txt

# Query for *.nhs.uk
curl -s "https://crt.sh/?q=%.nhs.uk&output=json" | \
  jq -r '.[].name_value' | \
  sed 's/^\*\.//g' | \
  sort -u > discovered/nhs-uk-crtsh.txt
```

**Merge DNS and CT log results**:

```bash
# Combine all sources and deduplicate
cat discovered/services-gov-uk*.txt | sort -u > discovered/services-gov-uk-all.txt
cat discovered/nhs-uk*.txt discovered/nhs-wales.txt discovered/nhs-scotland.txt | sort -u > discovered/nhs-all.txt
```

### Phase 3: Web Search (Manual + Automated)

**Use search operators** to find government services:

```
# Google/Bing search queries
site:*.services.gov.uk apply
site:*.services.gov.uk login
site:*.nhs.uk book appointment
site:*.police.uk report crime
site:*.gov.uk inurl:apply
```

**Example automated web search** (using Node.js script):

```bash
# Run web search discovery script
npm run discover:web-search -- --query "site:*.services.gov.uk apply" --output discovered/web-search-results.json
```

### Phase 4: Government Directories

**Query GOV.UK API** (if available):

```bash
# Search GOV.UK content API
curl -s "https://www.gov.uk/api/search.json?filter_format=service&count=1000" | \
  jq -r '.results[].link' | \
  sed 's|^|https://www.gov.uk|' > discovered/govuk-services.txt
```

**Manual directory review**:
- GOV.UK service directories: https://www.gov.uk/browse
- NHS Digital service catalog: https://digital.nhs.uk/services
- Department service lists (check each department homepage)

## Validation and Deduplication

### Step 1: URL Normalization

Run URL normalization script to apply RFC 3986 rules:

```bash
npm run normalize-urls -- \
  --input discovered/services-gov-uk-all.txt \
  --output discovered/services-gov-uk-normalized.json
```

This applies:
- Lowercase scheme + host
- Remove default ports (80, 443)
- Sort query parameters
- Remove trailing slashes
- Normalize percent-encoding

### Step 2: Redirect Resolution

Follow redirects to determine canonical URLs:

```bash
npm run resolve-redirects -- \
  --input discovered/services-gov-uk-normalized.json \
  --output discovered/services-gov-uk-canonical.json \
  --max-redirects 5 \
  --timeout 5000
```

**Parameters**:
- `--max-redirects 5`: Maximum redirect hops (default)
- `--timeout 5000`: 5-second timeout per hop
- `--cache-ttl 604800`: Cache redirect chains for 7 days (seconds)

**Output format** (JSON):
```json
{
  "original_url": "http://www.example.service.gov.uk",
  "canonical_url": "https://example.service.gov.uk/",
  "redirect_chain": [
    "http://www.example.service.gov.uk",
    "https://www.example.service.gov.uk",
    "https://example.service.gov.uk/"
  ],
  "redirect_count": 2,
  "latency_ms": 450
}
```

### Step 3: Deduplication

Remove duplicate canonical URLs:

```bash
npm run deduplicate-services -- \
  --input discovered/services-gov-uk-canonical.json \
  --output discovered/services-gov-uk-unique.json
```

This marks duplicates with `is_duplicate: true` and keeps first occurrence (earliest discovery date).

### Step 4: Accessibility Validation

Validate that services are publicly accessible:

```bash
npm run validate-accessibility -- \
  --input discovered/services-gov-uk-unique.json \
  --output validation-results.json \
  --concurrency 50
```

**Validation checks**:
- HTTP status code (200, 301, 302, 401, 403 = accessible)
- Response latency < 15 seconds
- No circular redirects
- Valid SSL certificates

**Output format** (validation-results.json):
```json
{
  "url": "https://example.service.gov.uk/",
  "is_accessible": true,
  "http_status": 200,
  "latency_ms": 380,
  "validation_passed": true,
  "failure_reason": ""
}
```

Services with `validation_passed: false` are excluded or flagged for manual review.

### Step 5: Tag Application

Apply 74-tag taxonomy to categorize services:

```bash
npm run apply-tags -- \
  --input validation-results.json \
  --taxonomy taxonomy.json \
  --output discovered-services.json
```

**Taxonomy file** (taxonomy.json) contains all 74 tags across 6 dimensions:
- department (24 tags): hmrc, nhs, dvla, etc.
- service-type (13 tags): application, booking, information, etc.
- geography (11 tags): england, scotland, wales, etc.
- criticality (3 tags): critical, high-volume, standard
- channel (5 tags): citizen-facing, business-facing, etc.
- lifecycle (18 tags): live, beta, alpha, etc.

## Transformation to config.yaml

### Step 1: Generate Service Entries

Transform Discovered Services to Service Entry format:

```bash
npm run transform-to-entries -- \
  --input discovered-services.json \
  --output service-entries.json
```

**Transformation rules**:
- `canonical_url` → `resource`
- `validation_text` → `expected.text` (or `!validation_text_inverse`)
- `expected_status` → `expected.status`
- Tags array preserved
- Department-based service naming

### Step 2: Group by Category

Organize services into 15 predefined categories by criticality and department:

```bash
npm run group-by-category -- \
  --input service-entries.json \
  --categories categories.json \
  --output categorized-services.json
```

**Category order** (display_order):
1. NHS Emergency & Urgent Care
2. Emergency Services (Police/Fire/Ambulance)
3. GOV.UK Core Platform Services
4. HMRC Tax Services
5. DVLA Licensing & Vehicle Services
... (15 total categories)

### Step 3: Generate YAML

Create formatted config.yaml with inline comments:

```bash
npm run generate-yaml -- \
  --input categorized-services.json \
  --output config-additions.yaml \
  --preserve-comments
```

**Generated YAML structure**:

```yaml
# ============================================================================
# CRITICAL SERVICES (60-second check interval)
# ============================================================================

# NHS Emergency & Urgent Care
- name: 'NHS 111 Online'
  protocol: HTTPS
  method: GET
  resource: 'https://111.nhs.uk/'
  tags: ['nhs', 'emergency', 'critical', 'citizen-facing', 'england']
  expected:
    status: 200
    text: 'Get help from NHS 111'
  interval: 60
  warning_threshold: 2
  timeout: 5

# ... more critical services ...
```

### Step 4: Merge into config.yaml

**Manual merge** (recommended for first iteration):

1. Review generated `config-additions.yaml`
2. Validate with JSON Schema:
   ```bash
   npm run validate-yaml -- --input config-additions.yaml
   ```
3. Manually merge into `config.yaml` at appropriate locations
4. Test with config validation:
   ```bash
   npm run validate-config
   ```

**Automated merge** (use with caution):

```bash
npm run merge-config -- \
  --existing config.yaml \
  --additions config-additions.yaml \
  --output config-new.yaml \
  --backup config-backup.yaml
```

## Common Tasks

### View Discovery Progress

Check counts at each stage:

```bash
# Raw discovered URLs
wc -l discovered/*.txt

# After normalization
jq '. | length' discovered/services-gov-uk-normalized.json

# After deduplication
jq '.services | length' discovered/services-gov-uk-unique.json

# After validation (passed only)
jq '[.[] | select(.validation_passed == true)] | length' validation-results.json
```

### Re-validate Failed Services

Retry validation for services that initially failed:

```bash
# Extract failed URLs
jq -r '.[] | select(.validation_passed == false) | .url' validation-results.json > failed-urls.txt

# Retry with longer timeout
npm run validate-accessibility -- \
  --input-file failed-urls.txt \
  --output validation-retry.json \
  --timeout 15000 \
  --retries 5
```

### Manual Service Addition

Add a manually discovered service directly to JSON:

```bash
cat >> discovered-services-manual.json << 'EOF'
{
  "url": "https://manual-service.gov.uk/",
  "canonical_url": "https://manual-service.gov.uk/",
  "http_method": "GET",
  "expected_status": 200,
  "validation_text": "Service Available",
  "department": "example-dept",
  "service_type": "information",
  "criticality": "standard",
  "tags": ["example-dept", "information", "standard", "citizen-facing", "uk-wide"],
  "discovery_source": {
    "discovery_method": "manual",
    "discovery_date": "2025-10-26T14:00:00Z",
    "discovered_by": "researcher-name"
  },
  "is_duplicate": false,
  "last_verified": "2025-10-26T14:00:00Z"
}
EOF
```

### Validate JSON Against Schema

Check discovered services conform to schema:

```bash
npm run validate-schema -- \
  --schema contracts/service-discovery-api.json \
  --data discovered-services.json
```

### Generate Research Report

Create final discovery report with statistics:

```bash
npm run generate-report -- \
  --input discovered-services.json \
  --validation validation-results.json \
  --output research-report.md
```

**Report includes**:
- Total discovered services
- Validation pass/fail breakdown
- Coverage by department
- Coverage by service type
- Discovery method statistics
- Top 10 most-common tags

### Search for Specific Services

Query discovered services by criteria:

```bash
# Find all NHS services
jq '.services[] | select(.department == "nhs")' discovered-services.json

# Find all critical services
jq '.services[] | select(.criticality == "critical")' discovered-services.json

# Find all booking services
jq '.services[] | select(.service_type == "booking")' discovered-services.json

# Find services by tag
jq '.services[] | select(.tags[] | contains("emergency"))' discovered-services.json
```

### Export to CSV

Convert discovered services to CSV for spreadsheet analysis:

```bash
npm run export-to-csv -- \
  --input discovered-services.json \
  --output discovered-services.csv
```

## Troubleshooting

### Subfinder Returns No Results

**Problem**: `subfinder -d services.gov.uk` returns 0 subdomains

**Solutions**:

1. **Check internet connectivity**:
   ```bash
   dig services.gov.uk
   curl -I https://www.services.gov.uk
   ```

2. **Verify API keys configured** (if using enhanced sources):
   ```bash
   cat ~/.config/subfinder/provider-config.yaml
   ```

3. **Try passive sources explicitly**:
   ```bash
   subfinder -d services.gov.uk -sources certspotter,crtsh,hackertarget -v
   ```

4. **Use Amass as fallback**:
   ```bash
   amass enum -passive -d services.gov.uk -o services-gov-uk-amass.txt
   ```

---

### crt.sh API Rate Limiting

**Problem**: `curl https://crt.sh` returns 429 Too Many Requests

**Solutions**:

1. **Add delay between requests**:
   ```bash
   curl -s "https://crt.sh/?q=%.services.gov.uk&output=json" -w "\n" && sleep 5
   ```

2. **Use alternative CT log sources**:
   - Google CT: https://transparencyreport.google.com/https/certificates
   - Censys.io API: https://search.censys.io/api (requires free API key)

3. **Reduce query scope**:
   ```bash
   # Query specific subdomains instead of wildcard
   curl -s "https://crt.sh/?q=apply.services.gov.uk&output=json"
   ```

---

### Redirect Resolution Timeouts

**Problem**: Many services timeout during redirect resolution

**Solutions**:

1. **Increase timeout value**:
   ```bash
   npm run resolve-redirects -- --timeout 10000  # 10 seconds
   ```

2. **Reduce concurrency** (avoid overwhelming network):
   ```bash
   npm run resolve-redirects -- --concurrency 10  # Reduce from default 50
   ```

3. **Check DNS resolver**:
   ```bash
   # Use faster DNS resolver (e.g., 1.1.1.1, 8.8.8.8)
   echo "nameserver 1.1.1.1" | sudo tee /etc/resolv.conf
   ```

4. **Retry failed URLs separately**:
   ```bash
   jq -r '.[] | select(.canonical_url == null) | .original_url' \
     discovered/services-gov-uk-canonical.json > retry-urls.txt
   npm run resolve-redirects -- --input-file retry-urls.txt --timeout 15000
   ```

---

### Validation Failing for All Services

**Problem**: All services marked `validation_passed: false`

**Solutions**:

1. **Check expected_status values are realistic**:
   ```bash
   # Many services return 401/403 (auth required) not 200
   # Update validation to accept these statuses
   ```

2. **Verify network access**:
   ```bash
   curl -I https://example.service.gov.uk
   ```

3. **Check for proxy/firewall blocking**:
   ```bash
   # Temporarily disable proxy
   unset http_proxy https_proxy
   ```

4. **Use verbose mode** to see detailed errors:
   ```bash
   npm run validate-accessibility -- --verbose
   ```

---

### YAML Generation Produces Invalid Syntax

**Problem**: Generated YAML fails schema validation

**Solutions**:

1. **Validate JSON input first**:
   ```bash
   npm run validate-schema -- --data service-entries.json
   ```

2. **Check for special characters in names**:
   ```bash
   # Quotes required for names with colons, hashes, etc.
   jq '.services[] | select(.name | contains(":"))' service-entries.json
   ```

3. **Test YAML parsing**:
   ```bash
   npm run validate-yaml -- --input config-additions.yaml
   ```

4. **Manually review problematic services**:
   ```bash
   # Find services with complex expected.text patterns
   jq '.services[] | select(.expected.text | length > 100)' service-entries.json
   ```

---

### Memory Exhaustion with Large Datasets

**Problem**: Node.js process crashes with "JavaScript heap out of memory"

**Solutions**:

1. **Increase Node.js heap size**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=8192"  # 8GB
   npm run resolve-redirects
   ```

2. **Process in batches**:
   ```bash
   # Split large file into chunks
   split -l 1000 discovered/services-gov-uk-all.txt discovered/batch-

   # Process each batch separately
   for file in discovered/batch-*; do
     npm run resolve-redirects -- --input "$file" --output "${file}-canonical.json"
   done

   # Merge results
   jq -s 'add' discovered/batch-*-canonical.json > discovered/services-gov-uk-canonical.json
   ```

3. **Use streaming JSON parser** (for very large datasets):
   ```bash
   npm run resolve-redirects -- --input-stream discovered/services-gov-uk-all.txt
   ```

---

### Duplicate Detection Missing Obvious Duplicates

**Problem**: www.example.gov.uk and example.gov.uk both kept after deduplication

**Solutions**:

1. **Verify redirect resolution ran first**:
   ```bash
   # Redirect resolution should canonicalize www variants
   # Check if both URLs have same canonical_url
   jq '.[] | select(.original_url | contains("www.example.gov.uk"))' \
     discovered/services-gov-uk-canonical.json
   ```

2. **Check normalization rules applied**:
   ```bash
   npm run normalize-urls -- --verbose
   ```

3. **Manual deduplication** for specific domains:
   ```bash
   # Remove all www. variants that redirect to non-www
   jq 'map(select(.is_duplicate == false))' discovered/services-gov-uk-unique.json
   ```

## Next Steps

1. **Read the feature specification**: [spec.md](./spec.md)
2. **Understand the data model**: [data-model.md](./data-model.md)
3. **Review the research findings**: [research.md](./research.md)
4. **Explore the JSON Schema contract**: [contracts/service-discovery-api.json](./contracts/service-discovery-api.json)
5. **Review the implementation plan**: [plan.md](./plan.md)

## Additional Resources

- **Subfinder Documentation**: https://github.com/projectdiscovery/subfinder
- **Amass Documentation**: https://github.com/owasp-amass/amass
- **crt.sh Certificate Transparency**: https://crt.sh/
- **undici HTTP Client**: https://undici.nodejs.org/
- **RFC 3986 URL Normalization**: https://datatracker.ietf.org/doc/html/rfc3986
- **GOV.UK Service Manual**: https://www.gov.uk/service-manual
- **NHS Digital Services**: https://digital.nhs.uk/services
- **JSON Schema Specification**: https://json-schema.org/draft-07/json-schema-release-notes

## Support

For issues or questions:

- Create an issue in the project repository
- Contact the research team lead
- Review the troubleshooting section above
- Consult research.md for technical decisions and rationale

**Version**: 1.0.0 | **Last Updated**: 2025-10-26
