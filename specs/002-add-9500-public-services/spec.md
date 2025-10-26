# Feature Specification: Comprehensive UK Public Service Monitoring

**Feature Branch**: `002-add-9500-public-services`
**Created**: 2025-10-26
**Status**: Draft
**Input**: User description: "I want to add at least 9500 public sector services to the config.yaml. You'll need to carry out exhaustive searches using websearch, perplexity, webfetch to find them unique *.services.gov.uk domains, nhs services, and nhs, policing, emergency services, local government services and all sorts of other 3rd party ones including booking services. Find the correct meaningful places to put them in the config.yaml with meaningful syntax, this will be an exhaustive research event. You'll need to think of all sorts of inventive ways to find these things"

## Clarifications

### Session 2025-10-26

- Q: Which structured format should be used for documenting discovered services before they're added to config.yaml? → A: JSON (disposable development artifact, enables programmatic transformation to YAML)
- Q: If the 9500 service target cannot be fully met due to time/discovery constraints, which service categories should be prioritized first? → A: Breadth-first coverage across all departments/categories, then deepen by department criticality. 9500 is minimum baseline - research should be exhaustive and continue beyond 9500
- Q: When multiple URLs serve the same service (e.g., with/without www, HTTP/HTTPS), which URL should be selected as canonical? → A: Follow redirects - use the final destination URL after following all HTTP redirects (most accurate to actual service)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Government Services Discovery (Priority: P1)

Citizens, businesses, and government monitoring teams need a comprehensive view of all critical government services to understand service availability across the entire UK public sector ecosystem.

**Why this priority**: This provides the foundational value - visibility into the entire public service landscape. Without comprehensive service coverage, the monitoring system provides only partial value.

**Independent Test**: Can be tested by verifying that all major government service categories (HMRC, DVLA, NHS, DWP, etc.) have representative services monitored, and that the status page displays them organized by meaningful categories.

**Acceptance Scenarios**:

1. **Given** the monitoring system is operational, **When** a user visits the status page, **Then** they see services organized by government department and service category
2. **Given** a critical government service experiences an outage, **When** the monitoring system performs its next health check, **Then** the outage is detected and reflected on the status page within 5 minutes
3. **Given** 9500+ services are configured, **When** the monitoring system runs, **Then** all health checks complete within the configured check interval without system resource exhaustion

---

### User Story 2 - NHS and Healthcare Services Visibility (Priority: P1)

Healthcare professionals, patients, and NHS administrators need to monitor the availability of critical NHS digital services including booking systems, patient records, and emergency service portals.

**Why this priority**: NHS services are life-critical and high-volume. Outages can impact patient care and emergency response. Equal P1 priority with general government services.

**Independent Test**: Can be tested by verifying that NHS services (NHS 111, NHS App, NHS Jobs, booking systems, GP services) are monitored and that health check failures trigger appropriate status updates.

**Acceptance Scenarios**:

1. **Given** NHS digital services are configured, **When** a service like NHS 111 Online becomes unavailable, **Then** the status is reflected as FAIL on the status page
2. **Given** NHS booking services are monitored, **When** response times exceed warning thresholds, **Then** services are marked as DEGRADED
3. **Given** multiple NHS trusts operate separate digital services, **When** trust-specific services are configured, **Then** each trust's services are monitored independently with appropriate tagging

---

### User Story 3 - Emergency Services and Public Safety Monitoring (Priority: P1)

Emergency service coordinators, police, fire, and ambulance services need to monitor the availability of critical incident reporting, emergency response, and public safety platforms.

**Why this priority**: Emergency services are life-critical and time-sensitive. System outages can directly impact public safety and emergency response capabilities.

**Independent Test**: Can be tested by configuring police, fire, ambulance, and emergency reporting services and verifying that health check failures are detected within one check interval.

**Acceptance Scenarios**:

1. **Given** emergency service reporting portals are configured, **When** services become unavailable, **Then** failures are detected and displayed prominently
2. **Given** 999/111 related digital services are monitored, **When** response times degrade, **Then** DEGRADED status is shown with latency metrics
3. **Given** emergency services span multiple agencies, **When** services are tagged by agency type (police, fire, ambulance), **Then** status page groups them appropriately

---

### User Story 4 - Local Government Services Coverage (Priority: P2)

Local authority administrators, council service teams, and residents need visibility into local government digital services including planning portals, council tax systems, housing applications, and waste management services.

**Why this priority**: While critical to citizens, local services are often less centralized and time-critical than P1 national/emergency services. Still essential for comprehensive monitoring.

**Independent Test**: Can be tested by configuring representative local government services (council tax, planning applications, waste collection booking) and verifying multi-tenant service monitoring.

**Acceptance Scenarios**:

1. **Given** local government services span 300+ local authorities, **When** shared platforms (e.g., Planning Portal) are configured, **Then** single health checks represent availability for all authorities using the platform
2. **Given** some councils operate independent digital services, **When** council-specific services are configured, **Then** each council's services are monitored with appropriate geographic tagging
3. **Given** local services include booking systems, **When** booking functionality is health-checked, **Then** POST requests validate that booking workflows are operational

---

### User Story 5 - Third-Party and Contracted Service Provider Monitoring (Priority: P2)

Government procurement teams, service managers, and contract administrators need to monitor third-party services contracted by government including booking platforms, payment processors, and specialized service providers.

**Why this priority**: Many government services are delivered via third-party contracts. Monitoring these ensures complete service availability visibility but is lower priority than direct government service monitoring.

**Independent Test**: Can be tested by configuring third-party booking systems, payment gateways, and contracted platforms with appropriate validation criteria.

**Acceptance Scenarios**:

1. **Given** government services use third-party booking platforms, **When** these platforms are configured, **Then** health checks validate booking functionality availability
2. **Given** third-party services may have different SLA requirements, **When** warning thresholds and timeouts are configured, **Then** each service uses appropriate threshold values
3. **Given** third-party services may redirect or change URLs, **When** HTTP redirects occur, **Then** health checks follow redirects and validate final destination availability

---

### User Story 6 - *.services.gov.uk Domain Discovery and Monitoring (Priority: P2)

Government service teams need automated discovery and monitoring of all services hosted on the *.services.gov.uk domain pattern to ensure comprehensive coverage of GDS-managed services.

**Why this priority**: Provides systematic coverage of GDS service domains but requires research/discovery infrastructure. Lower priority than actively monitoring known critical services.

**Independent Test**: Can be tested by performing DNS enumeration and web scraping of *.services.gov.uk subdomains, then validating that discovered services are added to config.yaml with correct health check parameters.

**Acceptance Scenarios**:

1. **Given** *.services.gov.uk is a common pattern for government services, **When** domain discovery is performed, **Then** all active subdomains are identified
2. **Given** discovered services may have different health check requirements, **When** services are added to config, **Then** appropriate HTTP methods and validation criteria are configured
3. **Given** some services may be internal or authentication-required, **When** health checks return 401/403 status codes, **Then** services are configured to expect these status codes as "healthy"

---

### User Story 7 - Policing and Justice Digital Services Monitoring (Priority: P2)

Police forces, court administrators, and justice system users need to monitor digital services including court booking systems, case management portals, tribunal services, and police reporting platforms.

**Why this priority**: Critical for justice system operations but typically lower volume than NHS/HMRC services. Still essential for comprehensive government service monitoring.

**Independent Test**: Can be tested by configuring HMCTS (courts/tribunals), police force digital services, and justice system portals with appropriate health checks.

**Acceptance Scenarios**:

1. **Given** court and tribunal services are time-sensitive, **When** HMCTS services are configured, **Then** appropriate warning thresholds (≤2s) are set for DEGRADED status
2. **Given** police forces may operate independent digital services, **When** force-specific services are configured, **Then** services are tagged by force area for geographic filtering
3. **Given** justice services include case management systems, **When** authentication-protected services are monitored, **Then** health checks validate that login pages/endpoints are accessible

---

### User Story 8 - Service Categorization and Organizational Taxonomy (Priority: P3)

Status page users, government analysts, and service managers need services organized by meaningful categories (department, service type, geographic region, criticality) to quickly understand service availability patterns.

**Why this priority**: Enhances usability of status page but depends on services already being monitored. Important for navigation but lower priority than core monitoring functionality.

**Independent Test**: Can be tested by verifying that config.yaml uses consistent tagging taxonomy and that the status page groups/filters services by these tags.

**Acceptance Scenarios**:

1. **Given** 9500+ services are monitored, **When** users view the status page, **Then** services are grouped by primary category (department, service type, or criticality)
2. **Given** services have multiple relevant tags, **When** tag structure is defined, **Then** tags follow hierarchical patterns (e.g., "department-subdepartment-service-type")
3. **Given** users need to filter services, **When** tags are applied consistently, **Then** filtering by tag shows all relevant services

---

### User Story 9 - Service Research and Documentation (Priority: P3)

Development teams, documentation maintainers, and service catalogers need structured research outputs documenting discovered services, their endpoints, validation criteria, and organizational ownership.

**Why this priority**: Supports maintainability and knowledge transfer but is not end-user facing. Important for long-term sustainability but lowest immediate priority.

**Independent Test**: Can be tested by verifying that research outputs include service URLs, expected status codes, validation text patterns, ownership departments, and discovery sources.

**Acceptance Scenarios**:

1. **Given** services are discovered via research, **When** services are documented, **Then** documentation includes discovery method, validation criteria rationale, and contact information
2. **Given** services may change ownership or URLs, **When** services are cataloged, **Then** metadata includes "last verified" timestamps for maintenance
3. **Given** research is exhaustive, **When** discovery methods are documented, **Then** documentation includes search queries, data sources, and discovery tools used

---

### Edge Cases

- **Duplicate service detection**: Multiple URLs serving the same service (www vs non-www, HTTP vs HTTPS) are deduplicated by following redirects to canonical destination URL
- **Service deprecation**: How does the system handle services that are decommissioned or merged with other services?
- **Rate limiting**: How does the system avoid overwhelming services with health checks when monitoring 9500+ endpoints?
- **DNS failures**: How does the system distinguish between DNS resolution failures and service unavailability?
- **Redirects and URL changes**: How does the system handle services that permanently redirect to new URLs?
- **Partial service degradation**: How does the system detect when only specific functions of a service are unavailable?
- **Geographic load balancing**: How does the system handle services that route to different backends based on client location?
- **Authentication-required services**: How does the system validate availability for services that require authentication without exposing credentials?
- **Service maintenance windows**: How does the system avoid reporting planned maintenance as service failures?
- **Third-party service SLA boundaries**: How does the system monitor third-party services that government contracts with but doesn't directly control?
- **Subdomain enumeration limits**: How does the research process avoid discovering internal/development subdomains that shouldn't be monitored?
- **False positives from WAF/DDoS protection**: How does the system handle services behind Web Application Firewalls that may block health check requests?
- **Multi-page workflows**: How does the system validate complex services requiring multiple steps (e.g., "apply then submit")?
- **Search functionality validation**: How does the system test POST-based search services without creating test data in production systems?
- **Services with dynamic content**: How does the system validate services where expected content changes frequently?
- **Cascading failures**: How does the system avoid cascading failures when multiple services depend on a shared backend?
- **Config file maintainability**: How does the system structure config.yaml to remain maintainable with 9500+ service entries?
- **Discovery completeness**: How does the research process ensure no major government services are missed?
- **Local government multi-tenancy**: How does the system handle platforms serving 300+ local authorities without duplicating entries?
- **Service consolidation tracking**: How does the system track when multiple legacy services are consolidated into a single platform?

## Requirements _(mandatory)_

### Functional Requirements

#### Service Discovery and Research

- **FR-001**: System MUST provide research methodology for discovering *.services.gov.uk subdomains using DNS enumeration, certificate transparency logs, and web crawling
- **FR-002**: System MUST provide research methodology for discovering NHS digital services across NHS England, Scotland, Wales, and Northern Ireland
- **FR-003**: System MUST provide research methodology for discovering local government services across all UK local authorities (estimated 300+ councils)
- **FR-004**: System MUST provide research methodology for discovering emergency service digital platforms (police, fire, ambulance, coast guard)
- **FR-005**: System MUST provide research methodology for discovering third-party contracted service providers used by government
- **FR-006**: System MUST provide research methodology for discovering government booking systems (appointments, tests, facilities)
- **FR-007**: System MUST validate discovered services are publicly accessible before adding to monitoring configuration
- **FR-008**: System MUST document discovery source and method for each service (web search, DNS enumeration, government directory, etc.)
- **FR-009**: System MUST identify appropriate HTTP method (GET, POST, HEAD) for each discovered service
- **FR-010**: System MUST identify expected HTTP status codes for each discovered service
- **FR-011**: System MUST identify validation text patterns for each discovered service to distinguish working pages from error pages
- **FR-011a**: Research process MUST follow breadth-first discovery strategy (minimum coverage across all categories) before deepening any single department, then prioritize by department criticality (NHS, emergency services, HMRC, DWP, then others)

#### Service Categorization and Tagging

- **FR-012**: System MUST assign department tags to services (hmrc, dvla, dwp, nhs, moj, home-office, etc.)
- **FR-013**: System MUST assign service type tags to services (authentication, application, information, booking, payment, etc.)
- **FR-014**: System MUST assign criticality tags to services (critical, high-volume, standard) based on usage patterns
- **FR-015**: System MUST assign geographic tags to services where applicable (england, scotland, wales, northern-ireland, local-authority-name)
- **FR-016**: System MUST assign technology tags to services where relevant (gds-platform, nhs-platform, third-party)
- **FR-017**: System MUST use consistent tag naming conventions (lowercase, hyphenated, max 100 characters)
- **FR-018**: System MUST apply multiple tags per service to support different filtering and grouping perspectives

#### Config.yaml Structure and Organization

- **FR-019**: System MUST organize config.yaml entries by logical grouping to maintain readability (department, criticality, or alphabetical)
- **FR-020**: System MUST include inline comments in config.yaml documenting service categories and organizational structure
- **FR-021**: System MUST maintain existing config.yaml settings section unchanged
- **FR-022**: System MUST maintain existing config.yaml comment structure explaining text validation and search services
- **FR-023**: System MUST deduplicate services accessible via multiple URLs by following HTTP redirects to final destination URL and using that as canonical URL
- **FR-024**: System MUST group related services together (e.g., all HMRC tax services, all NHS booking services)
- **FR-025**: System MUST include service full name in 'name' field for clear identification

#### Health Check Configuration

- **FR-026**: System MUST configure appropriate check intervals for high-criticality services (60-300 seconds)
- **FR-027**: System MUST configure appropriate check intervals for standard services (300-900 seconds)
- **FR-028**: System MUST configure appropriate warning thresholds based on service type (1-5 seconds)
- **FR-029**: System MUST configure appropriate timeouts based on service type (5-15 seconds)
- **FR-030**: System MUST configure expected HTTP status codes for authentication-protected services (200, 401, 403 as appropriate)
- **FR-031**: System MUST configure text validation patterns using positive patterns (text present) or inverse patterns (!text present)
- **FR-032**: System MUST configure POST requests with realistic test payloads for search and form services
- **FR-033**: System MUST configure custom request headers where required (User-Agent, Accept headers, etc.)

#### Service Type Coverage

- **FR-034**: System MUST include all major HMRC digital services (Self Assessment, VAT, PAYE, Corporation Tax, Customs, etc.)
- **FR-035**: System MUST include all major DVLA digital services (vehicle tax, licensing, registration, enforcement)
- **FR-036**: System MUST include all major DWP benefit services (Universal Credit, PIP, ESA, JSA, State Pension, etc.)
- **FR-037**: System MUST include all major NHS digital services (NHS App, NHS 111, booking systems, GP services)
- **FR-038**: System MUST include all major Home Office services (passports, visas, immigration, border control, police)
- **FR-039**: System MUST include all major MOJ/HMCTS services (courts, tribunals, legal services, prisons)
- **FR-040**: System MUST include all major DfE services (student finance, teacher services, schools data, apprenticeships)
- **FR-041**: System MUST include all major DEFRA services (agriculture, environment, fishing, rural payments)
- **FR-042**: System MUST include all major Companies House and IPO services
- **FR-043**: System MUST include all major local government shared platforms (Planning Portal, waste management, etc.)
- **FR-044**: System MUST include NHS services across all UK health systems (NHS England, NHS Scotland, NHS Wales, NI Health)
- **FR-045**: System MUST include emergency service reporting and booking portals
- **FR-046**: System MUST include police force digital services across all UK police forces where publicly accessible
- **FR-047**: System MUST include fire and rescue service booking and reporting systems
- **FR-048**: System MUST include court and tribunal booking and case management portals
- **FR-049**: System MUST include government payment platforms (GOV.UK Pay, departmental payment services)
- **FR-050**: System MUST include government authentication platforms (GOV.UK One Login, departmental SSO services)

#### Research and Documentation

- **FR-051**: System MUST document all research sources used (search engines, government directories, DNS tools, CT logs)
- **FR-052**: System MUST document search strategies and queries used for discovery
- **FR-053**: System MUST document services identified but excluded (with reasons: internal-only, deprecated, duplicates)
- **FR-054**: System MUST document service ownership mapping (URL to responsible department/agency)
- **FR-055**: System MUST document validation criteria rationale for complex services
- **FR-056**: System MUST document discovered services in JSON format for programmatic validation and transformation before adding to config.yaml
- **FR-057**: System MUST validate that total service count meets or exceeds 9500 services requirement

#### Performance and Scalability

- **FR-058**: System MUST configure worker pool size appropriate for 9500+ services (default: 2x CPU cores, configurable)
- **FR-059**: System MUST configure check intervals to avoid overwhelming monitored services with requests
- **FR-060**: System MUST stagger initial health checks to avoid thundering herd problem on system startup
- **FR-061**: System MUST handle DNS resolution for 9500+ unique domains without DNS resolver exhaustion
- **FR-062**: System MUST complete one full monitoring cycle across all services within reasonable time (target: 15 minutes for highest priority services)

#### Quality and Validation

- **FR-063**: System MUST validate that all config.yaml entries conform to JSON Schema before deployment
- **FR-064**: System MUST validate that all service URLs return responses (or documented expected failures) before adding to config
- **FR-065**: System MUST validate that text validation patterns successfully match expected content
- **FR-066**: System MUST validate that POST payloads are correctly formatted and accepted by services
- **FR-067**: System MUST avoid adding services that return consistent failures (likely internal-only or deprecated)
- **FR-068**: System MUST avoid adding duplicate services with identical functionality but different URLs

### Key Entities _(include if feature involves data)_

- **Service Entry**: Represents one monitored service in config.yaml with attributes: name (string), protocol (HTTP/HTTPS), method (GET/POST/HEAD), resource (URL), tags (array), expected (status code, text, headers), custom headers (optional), payload (optional), interval (optional), warning_threshold (optional), timeout (optional)

- **Service Category**: Logical grouping of related services by department, service type, or criticality. Used for config.yaml organization and status page display. Attributes: category_name, tag_pattern, display_order, description

- **Research Source**: Documentation of how a service was discovered. Attributes: discovery_method (dns-enumeration, web-search, certificate-transparency, gov-directory, manual), source_url, discovery_date, discovered_by

- **Tag Taxonomy**: Hierarchical structure defining valid tags and their relationships. Attributes: tag_name, tag_category (department, service-type, geography, criticality, technology), parent_tag, description, usage_count

- **Validation Rule**: Defines how to validate a service's health. Attributes: rule_type (status-code, text-present, text-absent, header-match, redirect-follow), rule_value, rule_rationale

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Configuration file contains minimum 9500 unique public service endpoints with exhaustive coverage across all discoverable UK public sector categories (no upper limit)
- **SC-002**: All major UK government departments have representative service coverage (minimum 50 services per major department: HMRC, DVLA, DWP, NHS, Home Office, MOJ)
- **SC-003**: All 4 UK health systems have NHS service coverage (NHS England, NHS Scotland, NHS Wales, Northern Ireland Health and Social Care)
- **SC-004**: Emergency services have representative coverage across police, fire, ambulance, and coast guard digital services (minimum 100 emergency service endpoints)
- **SC-005**: Local government services include shared platforms and representative coverage of individual local authorities (minimum 200 local government service endpoints)
- **SC-006**: At least 50 unique *.services.gov.uk subdomains are discovered and added to monitoring
- **SC-007**: Third-party contracted service providers are included where they deliver government services (minimum 100 third-party endpoints)
- **SC-008**: All configured services successfully complete health checks without system resource exhaustion or crashes
- **SC-009**: Configuration validation passes with zero schema errors after adding all services
- **SC-010**: Complete monitoring cycle across all 9500+ services completes within 15 minutes for priority services
- **SC-011**: Research methodology is documented with reproducible steps for future service discovery
- **SC-012**: Tag taxonomy covers at least 50 unique tags across department, service-type, geography, and criticality dimensions
- **SC-013**: Status page displays and filters 9500+ services without performance degradation (page load under 2 seconds)

## Assumptions

1. **Public accessibility**: Services to be monitored are publicly accessible without authentication, or authentication-protected services can be validated by checking login page availability
2. **Service stability**: Discovered services are production services (not development/staging environments)
3. **Health check methods**: Simple HTTP requests are sufficient to validate service availability (no complex multi-step workflows required)
4. **URL permanence**: Service URLs are relatively stable and not subject to frequent changes
5. **Department cooperation**: Government departments publish service lists or have discoverable service directories
6. **DNS availability**: DNS resolution for *.services.gov.uk and *.nhs.uk domains is reliable and performant
7. **Rate limiting tolerance**: Government services tolerate periodic health check requests without rate limiting or blocking
8. **Documentation accuracy**: Official government service directories (where they exist) accurately reflect current service URLs
9. **Third-party identification**: Third-party contracted services can be identified through government procurement data or service branding
10. **Local authority patterns**: Local government services follow discoverable patterns (shared platforms or consistent URL structures)
11. **Research tool access**: Research tools (DNS enumeration, certificate transparency logs, web scraping) are accessible and legal to use
12. **Geographic distribution**: Services are accessible from UK-based monitoring infrastructure without geographic restrictions
13. **Service criticality classification**: Service criticality can be inferred from service type, user base, and department documentation
14. **Config file size**: YAML file containing 9500+ services remains manageable (under 5MB) and parsable by standard YAML libraries
15. **Maintenance resources**: Development team has capacity to perform exhaustive research and validate 9500+ service configurations

## Research Strategies

### Discovery Methods

1. **DNS Enumeration**: Use tools like `subfinder`, `amass`, `dnsrecon` to enumerate *.services.gov.uk, *.nhs.uk, *.police.uk, *.gov.uk subdomains
2. **Certificate Transparency Logs**: Query CT logs via crt.sh or similar services to discover subdomains from TLS certificates
3. **Web Search**: Use search engines with operators like `site:*.services.gov.uk`, `site:*.nhs.uk`, `inurl:apply`, `inurl:service`
4. **Government Directories**: Scrape/API query GOV.UK service directories, NHS Digital service catalogs, department service lists
5. **API Discovery**: Check for public APIs (GOV.UK Digital Marketplace, NHS API Directory, data.gov.uk)
6. **Wayback Machine**: Use Internet Archive to discover deprecated or historical services
7. **GitHub Search**: Search government organization GitHub repositories for service URLs in config files
8. **Manual Department Review**: Systematically review each department's website for service links
9. **Third-Party Aggregators**: Use service aggregators like gov.uk/browse, nhs.uk/services
10. **Procurement Databases**: Review government procurement data for contracted service providers

### Validation Strategy

For each discovered service:
1. Follow HTTP redirects to determine canonical final destination URL
2. Validate canonical URL is accessible (returns 200, 401, or 403 - not 404/500)
3. Determine appropriate HTTP method (GET for info pages, POST for search/submit)
4. Identify unique text pattern for validation (page title, heading, or distinctive text)
5. Classify service by department, type, geography
6. Assign appropriate check interval based on criticality
7. Document discovery source and validation rationale

### Discovery Prioritization Strategy

Research execution follows breadth-first then depth approach:
1. **Phase 1 - Breadth**: Ensure minimum coverage across all categories (government departments, NHS, emergency, local gov, third-party) to establish baseline
2. **Phase 2 - Depth by Criticality**: Deepen coverage prioritizing life-critical services (NHS, emergency services, HMRC, DWP) before lower-priority categories
3. **Phase 3 - Exhaustive**: Continue discovery beyond 9500 minimum until all discoverable services documented

### Organizational Strategy

Structure config.yaml by:
1. **Criticality tier**: critical services (60s checks) → high-volume services (300s checks) → standard services (900s checks)
2. **Department grouping**: Within each tier, group by department (HMRC, DVLA, DWP, NHS, etc.)
3. **Service type subgrouping**: Within departments, group by service type (applications, information, booking, etc.)
4. **Alphabetical within groups**: Services alphabetically ordered within final grouping

## Out of Scope

- Internal government services requiring VPN or special network access
- Development or staging environments (only production services)
- Services operated by devolved administrations outside UK government responsibility
- International government services not serving UK residents
- Historical services that have been decommissioned
- Services requiring complex authentication flows beyond checking login page availability
- Real-time monitoring of service functionality beyond HTTP availability
- Automated service discovery as an ongoing system feature (this is one-time research and configuration)
- Performance testing or load testing of discovered services
- Security scanning or vulnerability assessment of discovered services
- Automated config.yaml maintenance and update workflows (future enhancement)

## Dependencies

- **Research Tools**: Access to DNS enumeration tools, certificate transparency query tools, web scraping libraries
- **Research Time**: Estimated 80-120+ hours of exhaustive research effort to discover, validate, and document all discoverable services (9500+ minimum baseline)
- **Review Resources**: Capacity for peer review of discovered services to validate appropriateness and accuracy
- **Government Documentation**: Access to government service directories, department websites, and procurement data
- **Network Access**: Ability to make HTTP requests to all discovered services for validation
- **Testing Infrastructure**: Ability to run test health checks against 9500+ services to validate configuration before deployment

## Open Questions

None - informed assumptions have been made based on standard government service patterns and established monitoring practices.
