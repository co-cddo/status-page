# Data Model: Comprehensive UK Public Service Discovery

**Feature**: 002-add-9500-public-services
**Date**: 2025-10-26
**Specification**: [spec.md](./spec.md)

## Overview

This document defines the core data entities, their attributes, relationships, validation rules, and transformations for discovering, validating, and cataloging 9500+ UK public services into the GOV.UK Status Monitor configuration.

**Key Distinction**: This data model differs from traditional application data models as it represents a one-time research and data collection workflow rather than runtime application state. Entities represent discovery artifacts and transformation outputs rather than persistent application entities.

## Entity Diagrams

```
┌─────────────────────────┐
│   Discovery Strategy    │
│─────────────────────────│
│ + method_name           │
│ + priority              │
│ + tool_name             │
│ + search_pattern        │
└─────────────────────────┘
         │
         │ produces
         ▼
┌─────────────────────────┐
│   Research Source       │
│─────────────────────────│
│ + discovery_method      │──┐
│ + source_url            │  │
│ + discovery_date        │  │
│ + discovered_by         │  │ documents
└─────────────────────────┘  │
         │                   │
         │ yields             │
         ▼                   │
┌─────────────────────────┐  │
│  Discovered Service     │  │
│─────────────────────────│  │
│ + url                   │◄─┘
│ + http_method           │──┐
│ + expected_status       │  │
│ + validation_text       │  │
│ + tags[]                │  │ validates using
│ + department            │  │
│ + service_type          │  ▼
│ + criticality           │  ┌──────────────────────┐
│ + discovery_source      │  │  Validation Result   │
│ + redirect_chain[]      │  │──────────────────────│
│ + canonical_url         │  │ + url                │
│ + is_duplicate          │  │ + is_accessible      │
└─────────────────────────┘  │ + http_status        │
         │                   │ + latency_ms         │
         │ categorized by    │ + validation_passed  │
         ▼                   │ + failure_reason     │
┌─────────────────────────┐  │ + redirect_chain[]   │
│    Tag Taxonomy         │  └──────────────────────┘
│─────────────────────────│
│ + tag_name              │
│ + tag_category          │
│ + parent_tag            │
│ + description           │
│ + usage_count           │
└─────────────────────────┘
         │
         │ groups into
         ▼
┌─────────────────────────┐
│  Service Category       │
│─────────────────────────│
│ + category_name         │
│ + tag_pattern           │
│ + display_order         │
│ + description           │
│ + service_count         │
└─────────────────────────┘
         │
         │ organizes
         ▼
┌─────────────────────────┐
│   Service Entry         │◄──────────┐
│─────────────────────────│           │
│ + name                  │           │
│ + protocol              │           │ transformed to
│ + method                │           │
│ + resource              │           │
│ + tags[]                │           │
│ + expected.status       │           │
│ + expected.text         │           │
│ + expected.headers      │           │
│ + headers[]             │───────────┘
│ + payload               │  (Discovered Service → Service Entry)
│ + interval              │
│ + warning_threshold     │
│ + timeout               │
└─────────────────────────┘
```

## Core Entities

### 1. Discovered Service

**Description**: Intermediate representation of a public service found during research phase, stored in JSON format before transformation to config.yaml. This is the primary working entity during discovery.

**Attributes**:

- `url` (string, required): Full URL of the discovered service endpoint
- `canonical_url` (string, required): Final destination URL after following all redirects
- `http_method` (enum, required): GET | HEAD | POST (determined by service type)
- `expected_status` (number, required): Expected HTTP status code for healthy service (typically 200, 401, 403)
- `validation_text` (string, optional): Unique substring in response body for positive validation
- `validation_text_inverse` (string, optional): Text that should NOT appear (for error page detection)
- `department` (string, required): Primary owning department (e.g., "hmrc", "nhs", "dvla")
- `service_type` (string, required): Functional category (e.g., "application", "booking", "information", "payment")
- `criticality` (enum, required): critical | high-volume | standard
- `geography` (string[], optional): Geographic scope (e.g., ["england"], ["scotland"], ["local-authority-westminster"])
- `tags` (string[], required): Complete tag set from taxonomy (minimum 2, maximum 10)
- `discovery_source` (ResearchSource, required): Metadata about how service was found
- `redirect_chain` (string[], optional): Array of URLs in redirect sequence (original → final)
- `is_duplicate` (boolean, required): Whether this URL duplicates another canonical_url
- `duplicate_of` (string, optional): canonical_url this duplicates (if is_duplicate=true)
- `last_verified` (Date, required): Timestamp when accessibility was last validated
- `check_interval` (number, optional): Override default interval (seconds)
- `warning_threshold` (number, optional): Override default threshold (seconds)
- `timeout` (number, optional): Override default timeout (seconds)
- `custom_headers` (CustomHeader[], optional): Required request headers
- `post_payload` (object, optional): POST request body (JSON, only if http_method=POST)
- `notes` (string, optional): Human-readable discovery context or special handling notes

**Validation Rules**:

- `url` must be valid HTTP/HTTPS URL with public TLD
- `canonical_url` must be determined by following redirects (max 5 hops, 5s per hop)
- `http_method` must match service type patterns:
  - GET: information pages, dashboards, status pages
  - POST: search services, form submissions, booking systems
  - HEAD: lightweight checks for high-volume services
- `expected_status` must be 100-599 range
- `validation_text` or `validation_text_inverse` MUST be present if service returns HTML
- `department` must match one of 74 predefined taxonomy categories
- `service_type` must match one of 13 predefined types (research.md section 8)
- `criticality` determined by:
  - critical: Life-critical services (NHS emergency, 999/111, emergency services)
  - high-volume: Services used daily by thousands (HMRC, DVLA, DWP benefits)
  - standard: All other public services
- `tags` must be drawn from 74-tag taxonomy only (no ad-hoc tags)
- `is_duplicate` set to true if `canonical_url` already exists in collection
- `redirect_chain` must not contain circular references (visited Set validation)
- Services with `is_duplicate=true` MUST NOT be added to config.yaml

**State Transitions**:

```
Discovered (raw URL from research)
    │
    │ HTTP request with redirect following
    ▼
Canonical URL resolved
    │
    ├── DNS failure ──► Excluded (not accessible)
    │
    ├── Connection timeout ──► Excluded (not publicly accessible)
    │
    ├── 404/410 status ──► Excluded (service not found/gone)
    │
    ├── 500+ status ──► Flagged for manual review (may be temporary)
    │
    └── 200/401/403 status
         │
         │ Check if canonical_url already exists
         ▼
    Duplicate check
         │
         ├── Duplicate found ──► Marked is_duplicate=true, not added to config
         │
         └── Unique canonical URL
              │
              │ Validation text check (if configured)
              ▼
         Validation passed
              │
              │ Taxonomy tagging
              ▼
         Fully categorized
              │
              │ JSON → YAML transformation
              ▼
         Service Entry (added to config.yaml)
```

**Relationships**:

- Has one `ResearchSource`
- Belongs to one or more `Tag Taxonomy` entries
- Belongs to one `Service Category`
- Produces one `Service Entry` (if not duplicate and validation passes)
- May have one `Validation Result`

---

### 2. Service Entry

**Description**: Final config.yaml representation of a monitored service. This is the output entity written to config.yaml after validation and transformation from Discovered Service.

**Attributes**:

- `name` (string, required): Human-readable service name (max 100 characters, ASCII)
- `protocol` (enum, required): HTTP | HTTPS
- `method` (enum, required): GET | HEAD | POST
- `resource` (string, required): Full URL (canonical_url from Discovered Service)
- `tags` (string[], optional): Array of taxonomy tags for categorization
- `expected` (object, required): Validation criteria
  - `status` (number, required): Expected HTTP status code
  - `text` (string, optional): Expected substring in response body
  - `headers` (object, optional): Expected response headers (e.g., {"location": "http://..."})
- `headers` (CustomHeader[], optional): Custom request headers
  - `name` (string): Header name
  - `value` (string): Header value
- `payload` (object, optional): POST request body (JSON, only if method=POST)
- `interval` (number, optional): Override default check interval (seconds)
- `warning_threshold` (number, optional): Override default latency threshold (seconds)
- `timeout` (number, optional): Override default timeout (seconds)

**Validation Rules**:

- Must conform to JSON Schema defined in contracts/service-discovery-api.json
- `name` must be unique across all services in config.yaml
- `resource` must equal `canonical_url` from source Discovered Service (no non-canonical URLs)
- `protocol` extracted from resource URL scheme
- `method` copied from Discovered Service http_method
- `tags` array must contain only valid taxonomy tags
- `expected.status` matches Discovered Service expected_status
- `expected.text` uses validation_text (positive) or !validation_text_inverse (negative pattern)
- If `method=POST`, `payload` must be valid JSON object
- Per-service thresholds must satisfy: `warning_threshold < timeout`

**State Transitions**: N/A (service entries are immutable in config.yaml until manual editing)

**Relationships**:

- Transformed from one `Discovered Service`
- Grouped within one `Service Category` in config.yaml organization
- Tagged by 0..n `Tag Taxonomy` entries

---

### 3. Research Source

**Description**: Metadata documenting how and when a service was discovered, enabling reproducibility and source tracking.

**Attributes**:

- `discovery_method` (enum, required): dns-enumeration | certificate-transparency | web-search | gov-directory | api-discovery | manual | github-search | wayback-machine | procurement-database | third-party-aggregator
- `source_url` (string, optional): URL of discovery source (e.g., crt.sh query URL, Google search URL, directory page)
- `discovery_date` (Date, required): ISO 8601 timestamp when service was discovered
- `discovered_by` (string, required): Tool or person name (e.g., "subfinder", "crt.sh", "manual review")
- `search_query` (string, optional): Exact search query or command used (for reproducibility)
- `tool_version` (string, optional): Version of discovery tool (e.g., "subfinder v2.6.3")
- `notes` (string, optional): Additional context about discovery process

**Validation Rules**:

- `discovery_method` must match enumeration values
- `discovery_date` must be valid ISO 8601 format
- `discovered_by` should be populated with specific tool/person identifier
- `search_query` SHOULD be populated for web-search and github-search methods (reproducibility)
- `source_url` SHOULD be populated where applicable (DNS enumeration may not have URL)

**State Transitions**: N/A (research sources are immutable historical records)

**Relationships**:

- Associated with 1..n `Discovered Service` entries (one discovery source may yield multiple services)
- Used to generate research documentation in final report

---

### 4. Tag Taxonomy

**Description**: Hierarchical structure defining all valid tags for categorizing services. Provides consistent vocabulary for config.yaml tagging.

**Attributes**:

- `tag_name` (string, required): Tag identifier (lowercase, hyphenated, max 100 chars)
- `tag_category` (enum, required): department | service-type | geography | criticality | channel | lifecycle
- `parent_tag` (string, optional): Parent tag for hierarchical relationships (e.g., "nhs" parent of "nhs-england")
- `description` (string, required): Human-readable explanation of tag meaning
- `usage_count` (number, runtime): Count of services using this tag (updated during tagging)
- `display_order` (number, optional): Sort order for tag display in status page

**Tag Categories**:

1. **department** (24 tags): hmrc, dvla, dwp, nhs, home-office, moj, dfe, defra, companies-house, ipo, etc.
2. **service-type** (13 tags): application, booking, information, payment, authentication, search, reporting, licensing, registration, case-management, appointment, portal, api
3. **geography** (11 tags): england, scotland, wales, northern-ireland, uk-wide, local-authority-*, region-*
4. **criticality** (3 tags): critical, high-volume, standard
5. **channel** (5 tags): citizen-facing, business-facing, internal, professional, emergency
6. **lifecycle** (18 tags): live, beta, alpha, deprecated, migrated, merged, archived, etc.

**Total**: 74 tags across 6 dimensions (from research.md section 8)

**Validation Rules**:

- `tag_name` must be unique globally across taxonomy
- `tag_category` must match one of 6 enumeration values
- `parent_tag` must reference existing tag_name (no orphan parents)
- No circular hierarchies allowed (validated via tree traversal)
- Tags must be lowercase, ASCII, hyphens only (no spaces, underscores, or special chars)
- Maximum tag depth: 2 levels (parent → child, no grandchildren)

**State Transitions**: N/A (taxonomy is predefined and static for this project)

**Relationships**:

- Referenced by 0..n `Discovered Service` entries
- Used to generate `Service Category` groupings
- Defines valid values for Service Entry tags array

---

### 5. Service Category

**Description**: Logical grouping of services in config.yaml for maintainability and readability. Categories use inline YAML comments to organize services.

**Attributes**:

- `category_name` (string, required): Display name for category section (e.g., "HMRC Tax Services", "NHS Booking Systems")
- `tag_pattern` (string, required): Primary tag that defines membership (e.g., "hmrc", "nhs + booking")
- `display_order` (number, required): Sort order in config.yaml (1-999)
- `description` (string, required): YAML comment text explaining category
- `service_count` (number, runtime): Count of services in this category

**Predefined Categories** (by criticality tier):

**Tier 1: Critical Services (60s checks)**
1. NHS Emergency & Urgent Care
2. Emergency Services (Police/Fire/Ambulance)
3. GOV.UK Core Platform Services

**Tier 2: High-Volume Services (300s checks)**
4. HMRC Tax Services
5. DVLA Licensing & Vehicle Services
6. DWP Benefits & Pensions
7. Home Office Immigration & Passports
8. NHS Routine Healthcare Services

**Tier 3: Standard Services (900s checks)**
9. MOJ/HMCTS Court & Tribunal Services
10. DfE Education & Student Finance
11. DEFRA Agriculture & Environment
12. Local Government Shared Platforms
13. Companies House & Intellectual Property
14. Third-Party Contracted Services
15. Other Government Services

**Validation Rules**:

- `category_name` must be unique across all categories
- `tag_pattern` must reference valid taxonomy tags
- `display_order` determines YAML section order (lower = higher in file)
- Services assigned to category if ANY tag matches tag_pattern
- Service with multiple matching categories assigned to highest priority (lowest display_order)

**State Transitions**: N/A (categories are predefined organizational structure)

**Relationships**:

- Contains 0..n `Service Entry` entities
- Filters services by `Tag Taxonomy` matches
- Generates YAML comment headers in config.yaml

---

### 6. Validation Result

**Description**: Outcome of validating a discovered service's accessibility and correctness before adding to config.yaml.

**Attributes**:

- `url` (string, required): Service URL being validated (original discovered URL)
- `canonical_url` (string, required): Final URL after redirect resolution
- `is_accessible` (boolean, required): Whether service responds successfully
- `http_status` (number, required): Actual HTTP status code received (0 if connection failed)
- `latency_ms` (number, required): Response time in milliseconds
- `validation_passed` (boolean, required): Whether all validation criteria met
- `text_validation_passed` (boolean, optional): Whether expected text found (null if not configured)
- `redirect_chain` (string[], optional): Array of redirect URLs (original → final)
- `redirect_count` (number, required): Number of redirects followed
- `failure_reason` (string, required): Human-readable failure explanation (empty if passed)
- `timestamp` (Date, required): When validation was performed
- `retry_count` (number, required): Number of retry attempts (for network errors)

**Possible Failure Reasons**:

- "DNS resolution failed"
- "Connection timeout after 5000ms"
- "HTTP status code mismatch: expected 200, got 500"
- "Expected text 'Service Available' not found in response"
- "Redirect limit exceeded (max 5 redirects)"
- "Circular redirect detected"
- "Invalid SSL certificate"
- "Connection refused"

**Validation Rules**:

- `is_accessible` true if http_status in [200, 301, 302, 401, 403] (404/500 = false)
- `validation_passed` true if:
  - is_accessible = true
  - http_status matches expected_status
  - validation_text found (if configured)
  - redirect_count <= 5
- `latency_ms` measured from request start to final response received
- `retry_count` 0-3 (exponential backoff: 1s, 2s, 4s delays)
- Services with `validation_passed=false` MUST be manually reviewed before adding to config

**State Transitions**:

```
Validation started
    │
    ├── Network error (DNS, connection) ──► Retry (up to 3 times)
    │                                         │
    │                                         └── All retries failed ──► validation_passed=false
    │
    ├── Timeout ──► validation_passed=false
    │
    ├── 404/410/500 status ──► validation_passed=false
    │
    └── 200/301/302/401/403 status
         │
         ├── Expected text not found ──► validation_passed=false
         │
         ├── Redirect limit exceeded ──► validation_passed=false
         │
         └── All checks passed ──► validation_passed=true
```

**Relationships**:

- Validates one `Discovered Service`
- Determines whether Discovered Service proceeds to Service Entry transformation

---

## Data Flow

### Discovery → Validation → Transformation Flow

```
1. Research execution (DNS enumeration, web search, etc.)
   ↓
2. Raw URLs collected with discovery metadata
   ↓
3. For each URL:
   a. Follow redirects to canonical URL (max 5 hops)
   b. Check for duplicates (canonical_url already exists?)
   c. Perform accessibility validation (HTTP request)
   d. Extract validation text patterns
   ↓
4. Create Discovered Service entity (JSON format)
   ↓
5. Apply Tag Taxonomy (categorization by department, type, geography)
   ↓
6. Create Validation Result (accessibility + validation checks)
   ↓
7. Filter: Keep only validation_passed=true, is_duplicate=false
   ↓
8. Group by Service Category (criticality tier + department)
   ↓
9. Transform to Service Entry entities
   ↓
10. Generate YAML with comments and formatting
   ↓
11. Write to config.yaml (organized by category, alphabetically within)
```

### Deduplication Flow (from research.md section 9)

```
1. URL normalization (RFC 3986)
   - Lowercase scheme + host
   - Remove default ports (80, 443)
   - Sort query parameters
   - Remove trailing slashes
   - Normalize percent-encoding
   ↓
2. Redirect resolution (max 5 hops, 5s timeout per hop)
   - Store redirect chain
   - Detect circular redirects (visited Set)
   - Use final destination as canonical_url
   ↓
3. Canonical URL deduplication
   - Build Set of all canonical_url values
   - Mark duplicates with is_duplicate=true
   - Keep first occurrence (earliest discovery_date)
   ↓
4. Manual review of duplicates (optional)
   - Verify same service (not different environments)
   - Update tags if needed
```

### Tag Application Flow

```
1. Department identification (primary tag)
   - Parse URL hostname for department indicators
   - Check validation text for department branding
   - Manual review if ambiguous
   ↓
2. Service type classification
   - Analyze URL path segments (e.g., /apply → application)
   - Check validation text for service type keywords
   - Determine HTTP method (GET vs POST)
   ↓
3. Geography tagging (if applicable)
   - UK-wide by default
   - Scotland/Wales/NI if hosted on .scot/.wales/.nhs.wales/hscni.net
   - Local authority if subdomain matches council name
   ↓
4. Criticality assignment
   - Critical: NHS emergency, 999/111, emergency services
   - High-volume: HMRC, DVLA, DWP, Home Office, major NHS
   - Standard: All others
   ↓
5. Channel tagging
   - Citizen-facing (default for public services)
   - Business-facing (if tax/registration/licensing)
   - Professional (if NHS/police professional portals)
   - Emergency (if 999/111 related)
   ↓
6. Lifecycle tagging (if detectable)
   - Live (default assumption)
   - Beta/Alpha if URL or page indicates
```

## Storage Schema

### JSON Schema (Discovered Services - intermediate format)

**File**: `discovered-services.json` (development artifact, not committed)

```typescript
interface DiscoveredServiceCollection {
  metadata: {
    discovery_date: string; // ISO 8601
    total_discovered: number;
    total_validated: number;
    total_duplicates: number;
    total_added_to_config: number;
  };
  services: DiscoveredService[];
}

interface DiscoveredService {
  url: string;
  canonical_url: string;
  http_method: 'GET' | 'HEAD' | 'POST';
  expected_status: number;
  validation_text?: string;
  validation_text_inverse?: string;
  department: string;
  service_type: string;
  criticality: 'critical' | 'high-volume' | 'standard';
  geography?: string[];
  tags: string[];
  discovery_source: ResearchSource;
  redirect_chain?: string[];
  is_duplicate: boolean;
  duplicate_of?: string;
  last_verified: string; // ISO 8601
  check_interval?: number;
  warning_threshold?: number;
  timeout?: number;
  custom_headers?: CustomHeader[];
  post_payload?: Record<string, unknown>;
  notes?: string;
}

interface ResearchSource {
  discovery_method:
    | 'dns-enumeration'
    | 'certificate-transparency'
    | 'web-search'
    | 'gov-directory'
    | 'api-discovery'
    | 'manual'
    | 'github-search'
    | 'wayback-machine'
    | 'procurement-database'
    | 'third-party-aggregator';
  source_url?: string;
  discovery_date: string; // ISO 8601
  discovered_by: string;
  search_query?: string;
  tool_version?: string;
  notes?: string;
}

interface CustomHeader {
  name: string;
  value: string;
}
```

### YAML Schema (Service Entries - final config.yaml format)

Follows existing config.yaml structure from project 001. Services organized by category with inline comments:

```yaml
settings:
  check_interval: 60
  warning_threshold: 2
  timeout: 5
  page_refresh: 60
  max_retries: 3
  worker_pool_size: 0

pings:
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

  # Emergency Services (Police/Fire/Ambulance)
  - name: 'Police.UK Crime Reporting'
    protocol: HTTPS
    method: GET
    resource: 'https://www.police.uk/'
    tags:
      ['home-office', 'policing', 'critical', 'emergency', 'citizen-facing', 'uk-wide']
    expected:
      status: 200
      text: 'Report a crime'
    interval: 60

  # ... more critical services ...

  # ============================================================================
  # HIGH-VOLUME SERVICES (300-second check interval)
  # ============================================================================

  # HMRC Tax Services
  - name: 'HMRC Self Assessment'
    protocol: HTTPS
    method: GET
    resource: 'https://www.tax.service.gov.uk/self-assessment'
    tags:
      ['hmrc', 'application', 'high-volume', 'citizen-facing', 'uk-wide']
    expected:
      status: 200
      text: 'Self Assessment tax return'
    interval: 300
    warning_threshold: 2
    timeout: 10

  # ... more high-volume services ...

  # ============================================================================
  # STANDARD SERVICES (900-second check interval)
  # ============================================================================

  # Companies House & Intellectual Property
  - name: 'Companies House WebFiling'
    protocol: HTTPS
    method: GET
    resource: 'https://ewf.companieshouse.gov.uk/'
    tags:
      [
        'companies-house',
        'application',
        'standard',
        'business-facing',
        'uk-wide'
      ]
    expected:
      status: 200
      text: 'Companies House WebFiling'
    interval: 900
    warning_threshold: 3
    timeout: 15

  # ... more standard services ...
```

### Validation Results Storage (optional CSV for auditing)

**File**: `validation-results.csv` (development artifact, not committed)

```csv
timestamp,url,canonical_url,is_accessible,http_status,latency_ms,validation_passed,redirect_count,failure_reason
2025-10-26T14:30:00.000Z,https://111.nhs.uk,https://111.nhs.uk/,true,200,450,true,0,
2025-10-26T14:30:05.000Z,http://www.nhs.uk,https://www.nhs.uk/,true,200,380,true,2,
2025-10-26T14:30:10.000Z,https://internal.service.gov.uk,https://internal.service.gov.uk/,false,403,120,false,0,Expected status 200 got 403 - likely internal-only
```

## TypeScript Type Definitions

```typescript
// Discovery entities
interface DiscoveredService {
  url: string;
  canonical_url: string;
  http_method: 'GET' | 'HEAD' | 'POST';
  expected_status: number;
  validation_text?: string;
  validation_text_inverse?: string;
  department: string;
  service_type: string;
  criticality: 'critical' | 'high-volume' | 'standard';
  geography?: string[];
  tags: string[];
  discovery_source: ResearchSource;
  redirect_chain?: string[];
  is_duplicate: boolean;
  duplicate_of?: string;
  last_verified: Date;
  check_interval?: number;
  warning_threshold?: number;
  timeout?: number;
  custom_headers?: CustomHeader[];
  post_payload?: Record<string, unknown>;
  notes?: string;
}

interface ServiceEntry {
  name: string;
  protocol: 'HTTP' | 'HTTPS';
  method: 'GET' | 'HEAD' | 'POST';
  resource: string;
  tags?: string[];
  expected: {
    status: number;
    text?: string;
    headers?: Record<string, string>;
  };
  headers?: CustomHeader[];
  payload?: Record<string, unknown>;
  interval?: number;
  warning_threshold?: number;
  timeout?: number;
}

interface ResearchSource {
  discovery_method:
    | 'dns-enumeration'
    | 'certificate-transparency'
    | 'web-search'
    | 'gov-directory'
    | 'api-discovery'
    | 'manual'
    | 'github-search'
    | 'wayback-machine'
    | 'procurement-database'
    | 'third-party-aggregator';
  source_url?: string;
  discovery_date: Date;
  discovered_by: string;
  search_query?: string;
  tool_version?: string;
  notes?: string;
}

interface TagTaxonomy {
  tag_name: string;
  tag_category:
    | 'department'
    | 'service-type'
    | 'geography'
    | 'criticality'
    | 'channel'
    | 'lifecycle';
  parent_tag?: string;
  description: string;
  usage_count: number;
  display_order?: number;
}

interface ServiceCategory {
  category_name: string;
  tag_pattern: string;
  display_order: number;
  description: string;
  service_count: number;
}

interface ValidationResult {
  url: string;
  canonical_url: string;
  is_accessible: boolean;
  http_status: number;
  latency_ms: number;
  validation_passed: boolean;
  text_validation_passed?: boolean;
  redirect_chain?: string[];
  redirect_count: number;
  failure_reason: string;
  timestamp: Date;
  retry_count: number;
}

interface CustomHeader {
  name: string;
  value: string;
}

// Collection types
interface DiscoveredServiceCollection {
  metadata: {
    discovery_date: Date;
    total_discovered: number;
    total_validated: number;
    total_duplicates: number;
    total_added_to_config: number;
  };
  services: DiscoveredService[];
}

interface ValidationReport {
  total_validated: number;
  passed: number;
  failed: number;
  duplicates: number;
  results: ValidationResult[];
}

// Taxonomy structure
interface TaxonomyDefinition {
  version: string;
  total_tags: number;
  categories: {
    department: TagTaxonomy[];
    'service-type': TagTaxonomy[];
    geography: TagTaxonomy[];
    criticality: TagTaxonomy[];
    channel: TagTaxonomy[];
    lifecycle: TagTaxonomy[];
  };
}
```

## Indexes and Performance Considerations

### In-Memory Processing

**Canonical URL Deduplication**:

- Use `Set<string>` for O(1) duplicate lookup by canonical_url
- Process services sequentially (not batch) to detect duplicates during discovery

**Tag Lookup**:

- Use `Map<string, TagTaxonomy>` for O(1) tag validation
- Pre-load entire taxonomy (74 tags) into memory at startup

**Category Assignment**:

- Pre-sort categories by display_order
- Linear scan through categories for tag_pattern matching (acceptable for 15 categories)

### File I/O Optimization

**JSON Writing** (discovered-services.json):

- Single atomic write after all discovery completes
- Pretty-print with 2-space indent for human readability
- Estimated size: 9500 services × ~500 bytes = ~4.75MB (acceptable)

**YAML Generation** (config.yaml):

- Use yaml package (eemeli) Document API for comment insertion
- Generate category by category to reduce memory pressure
- Estimated final size: 9500 services × ~300 bytes = ~2.85MB (well under 5MB limit)

### HTTP Request Concurrency

**Redirect Resolution**:

- Parallel processing using undici connection pool (50 connections/host)
- 9500 URLs with average 2 redirects = 19,000 HTTP requests
- Estimated time: 19,000 requests ÷ 50 concurrent = 380 batches × 100ms avg latency = ~38 seconds

**Validation Checks**:

- Same connection pool as redirect resolution
- Can reuse canonical_url responses (no duplicate requests)
- Estimated additional time: ~2 minutes for 9500 accessibility checks

### Caching Strategy

**Redirect Chain Caching**:

- Cache redirect chains with 7-day TTL (reduces re-validation time)
- Cache key: original URL, cache value: canonical URL + redirect chain
- Estimated cache size: 10,000 entries × ~200 bytes = ~2MB

**DNS Resolution Caching**:

- Use undici's built-in DNS cache
- Significant performance improvement for services sharing domains (e.g., *.service.gov.uk)

## Migration Strategy

This feature uses disposable intermediate formats (JSON) that will NOT be maintained long-term. The only persistent artifact is the updated config.yaml file.

**Future Maintenance Workflow**:

1. Services added manually to config.yaml (no automated discovery system)
2. Validation scripts can be reused for manual service validation
3. Tag taxonomy may be extended (add new tags to existing categories)
4. Discovery scripts preserved as documentation but not productionized

**No Database Migration Required**: All entities are ephemeral development artifacts except final config.yaml output.

## References

- Feature Specification: [spec.md](./spec.md)
- Research Findings: [research.md](./research.md)
- Implementation Plan: [plan.md](./plan.md)
- JSON Schema Contract: [contracts/service-discovery-api.json](./contracts/service-discovery-api.json) (to be created)
- Quickstart Guide: [quickstart.md](./quickstart.md) (to be created)
