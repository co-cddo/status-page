# Tasks: Comprehensive UK Public Service Monitoring

**Feature Branch**: `002-add-9500-public-services`
**Input**: Design documents from `/specs/002-add-9500-public-services/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. This is a **data collection and configuration feature**, not traditional software development - tasks focus on research, validation, and transformation workflows.

**Tests**: Validation scripts ensure data quality (analogous to test quality in code development). 100% validation pass rate required before services added to config.yaml.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Install discovery tools, create validation scripts structure, initialize research data directories

- [X] T001 Install Node.js dependencies for validation (undici, ajv, yaml, normalize-url) via npm install
- [ ] T002 [P] Install Subfinder v2.6+ via go install for DNS enumeration
- [ ] T003 [P] Install Amass v4+ via go install for comprehensive DNS discovery
- [X] T004 [P] Create research data directory structure at specs/002-add-9500-public-services/research-data/ with subdirectories: discovered/, validated/, reports/
- [X] T005 [P] Create validation scripts directory structure at scripts/ for validate-services.ts, deduplicate.ts, transform-to-yaml.ts, validate-config.ts
- [ ] T006 Configure Subfinder API keys in ~/.config/subfinder/provider-config.yaml (Censys, VirusTotal, GitHub, SecurityTrails free tier)
- [X] T007 [P] Create taxonomy.json file defining 74-tag structure across 6 dimensions (department, service-type, geography, criticality, channel, lifecycle)
- [X] T008 [P] Create categories.json file defining 15 service categories by criticality tier and department

**Checkpoint**: Tools installed, directory structure ready, taxonomy defined

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation infrastructure that MUST be complete before ANY user story discovery can begin

**⚠️ CRITICAL**: No user story discovery work can begin until this phase is complete

- [X] T009 Implement URL normalization script in scripts/normalize-urls.ts (RFC 3986: lowercase scheme/host, remove default ports, sort query params, remove trailing slashes)
- [X] T010 [P] Implement redirect resolution script in scripts/resolve-redirects.ts using undici with max 5 hops, circular redirect detection, redirect chain tracking
- [X] T011 [P] Implement deduplication script in scripts/deduplicate.ts using canonical URL Set for O(1) lookup, mark is_duplicate flag
- [X] T012 [P] Implement accessibility validation script in scripts/validate-accessibility.ts with HTTP status checks (200/301/302/401/403 = accessible), latency measurement, retry logic (3 attempts)
- [ ] T013 Implement tag application script in scripts/apply-tags.ts reading taxonomy.json, applying tags by department/service-type/geography/criticality/channel/lifecycle
- [ ] T014 [P] Implement service entry transformation script in scripts/transform-to-entries.ts converting Discovered Services to Service Entry format per data-model.md
- [ ] T015 [P] Implement category grouping script in scripts/group-by-category.ts organizing services by 15 predefined categories from categories.json
- [ ] T016 Implement YAML generation script in scripts/generate-yaml.ts using yaml package (eemeli) with programmatic comment insertion, section headers
- [ ] T017 [P] Implement JSON Schema validation script in scripts/validate-schema.ts using ajv to validate discovered-services.json against contracts/service-discovery-api.json
- [X] T018 Implement config.yaml validation script in scripts/validate-config.ts to verify final config against existing JSON Schema
- [X] T019 [P] Create research progress reporting script in scripts/generate-report.ts for statistics (total discovered, validation pass/fail, coverage by department/type)

**Checkpoint**: Foundation ready - all validation and transformation scripts operational - user story discovery can now begin in parallel

---

## Phase 3: User Story 1 - Government Services Discovery (Priority: P1) 🎯 MVP

**Goal**: Discover and validate core government department services (HMRC, DVLA, DWP, Home Office, MOJ, DfE, DEFRA, Companies House) ensuring minimum 50 services per major department

**Independent Test**: Verify that major government departments have representative services monitored (HMRC tax services, DVLA vehicle services, DWP benefits, etc.) and status page displays them organized by department categories

**Discovery Strategy**: Breadth-first across all major departments to meet minimum coverage requirements

### Discovery for User Story 1

- [ ] T020 [P] [US1] DNS enumeration for *.services.gov.uk using subfinder with enhanced sources, output to research-data/discovered/services-gov-uk.txt
- [ ] T021 [P] [US1] Certificate Transparency query for %.services.gov.uk via crt.sh API, output to research-data/discovered/services-gov-uk-crtsh.txt
- [ ] T022 [P] [US1] DNS enumeration for *.gov.uk using amass (comprehensive 20+ minute scan), output to research-data/discovered/gov-uk-amass.txt
- [ ] T023 [P] [US1] Web search discovery for HMRC services (site:*.service.gov.uk hmrc OR tax OR vat OR paye), minimum 50 services discovered, document results in research-data/discovered/hmrc-services.json
- [ ] T024 [P] [US1] Web search discovery for DVLA services (site:*.service.gov.uk dvla OR vehicle OR license OR driving), minimum 50 services discovered, document results in research-data/discovered/dvla-services.json
- [ ] T025 [P] [US1] Web search discovery for DWP services (site:*.service.gov.uk dwp OR benefits OR universal OR pension), minimum 50 services discovered, document results in research-data/discovered/dwp-services.json
- [ ] T026 [P] [US1] Web search discovery for Home Office services (site:*.service.gov.uk passport OR visa OR immigration OR border), minimum 50 services discovered, document results in research-data/discovered/home-office-services.json
- [ ] T027 [P] [US1] Web search discovery for MOJ/HMCTS services (site:*.service.gov.uk court OR tribunal OR legal OR prison), minimum 30 services discovered, document results in research-data/discovered/moj-services.json
- [ ] T028 [P] [US1] Web search discovery for DfE services (site:*.service.gov.uk education OR student OR teacher OR school), minimum 30 services discovered, document results in research-data/discovered/dfe-services.json
- [ ] T029 [P] [US1] Web search discovery for DEFRA services (site:*.service.gov.uk agriculture OR environment OR fishing OR rural), minimum 30 services discovered, document results in research-data/discovered/defra-services.json
- [ ] T030 [P] [US1] Web search discovery for Companies House and IPO services (site:*.companieshouse.gov.uk OR site:*.ipo.gov.uk), minimum 20 services discovered, document results in research-data/discovered/companies-house-ipo-services.json

### Validation and Transformation for User Story 1

- [ ] T031 [US1] Merge all government services discovery sources into research-data/discovered/government-services-all.txt and deduplicate
- [ ] T032 [US1] Run URL normalization on government-services-all.txt, output to research-data/government-services-normalized.json
- [ ] T033 [US1] Run redirect resolution on government-services-normalized.json with max 5 hops, 5s timeout, output to research-data/government-services-canonical.json
- [ ] T034 [US1] Run deduplication on government-services-canonical.json, mark duplicates with is_duplicate flag, output to research-data/government-services-unique.json
- [ ] T035 [US1] Run accessibility validation on government-services-unique.json with 50 concurrent connections, output to research-data/government-services-validated.json
- [ ] T036 [US1] Apply tag taxonomy to validated government services (department, service-type, criticality=high-volume/standard, channel=citizen-facing/business-facing), output to research-data/government-services-tagged.json
- [ ] T037 [US1] Transform tagged government services to Service Entry format per data-model.md, output to research-data/government-service-entries.json
- [ ] T038 [US1] Group government service entries by category (Tier 2: HMRC, DVLA, DWP, Home Office; Tier 3: MOJ, DfE, DEFRA, Companies House), output to research-data/government-services-categorized.json
- [ ] T039 [US1] Generate YAML for government services with inline comments and section headers, output to research-data/government-services.yaml
- [ ] T040 [US1] Validate government-services.yaml against JSON Schema using scripts/validate-config.ts
- [ ] T041 [US1] Verify minimum 50 services per major department (HMRC, DVLA, DWP, Home Office) using scripts/generate-report.ts, document in research-data/reports/government-services-coverage.md

**Checkpoint**: User Story 1 complete - major government departments have minimum coverage, services validated and ready for config.yaml merge

---

## Phase 4: User Story 2 - NHS and Healthcare Services Visibility (Priority: P1)

**Goal**: Discover and validate NHS digital services across all 4 UK health systems (NHS England, NHS Scotland, NHS Wales, Northern Ireland Health) including emergency, booking, and routine healthcare services

**Independent Test**: Verify that NHS services (NHS 111, NHS App, NHS Jobs, booking systems, GP services) are monitored across all 4 health systems and health check failures trigger appropriate status updates

**Discovery Strategy**: Comprehensive coverage across England, Scotland, Wales, Northern Ireland health systems

### Discovery for User Story 2

- [ ] T042 [P] [US2] DNS enumeration for *.nhs.uk (NHS England) using subfinder with enhanced sources, output to research-data/discovered/nhs-england.txt
- [ ] T043 [P] [US2] DNS enumeration for *.scot.nhs.uk (NHS Scotland) using subfinder, output to research-data/discovered/nhs-scotland.txt
- [ ] T044 [P] [US2] DNS enumeration for *.nhs.wales (NHS Wales) using subfinder, output to research-data/discovered/nhs-wales.txt
- [ ] T045 [P] [US2] DNS enumeration for *.hscni.net (Northern Ireland Health) using subfinder, output to research-data/discovered/nhs-ni.txt
- [ ] T046 [P] [US2] Certificate Transparency query for %.nhs.uk via crt.sh API, output to research-data/discovered/nhs-uk-crtsh.txt
- [ ] T047 [P] [US2] Web search discovery for NHS emergency services (site:*.nhs.uk 111 OR urgent OR emergency OR a&e), document results in research-data/discovered/nhs-emergency-services.json
- [ ] T048 [P] [US2] Web search discovery for NHS booking services (site:*.nhs.uk book OR appointment OR gp OR vaccine), document results in research-data/discovered/nhs-booking-services.json
- [ ] T049 [P] [US2] Web search discovery for NHS Apps and digital tools (site:*.nhs.uk app OR digital OR online OR login), document results in research-data/discovered/nhs-digital-services.json
- [ ] T050 [P] [US2] Manual directory review of NHS Digital service catalog (https://digital.nhs.uk/services), extract service URLs to research-data/discovered/nhs-digital-catalog.json

### Validation and Transformation for User Story 2

- [ ] T051 [US2] Merge all NHS discovery sources into research-data/discovered/nhs-services-all.txt and deduplicate
- [ ] T052 [US2] Run URL normalization on nhs-services-all.txt, output to research-data/nhs-services-normalized.json
- [ ] T053 [US2] Run redirect resolution on nhs-services-normalized.json, output to research-data/nhs-services-canonical.json
- [ ] T054 [US2] Run deduplication on nhs-services-canonical.json, output to research-data/nhs-services-unique.json
- [ ] T055 [US2] Run accessibility validation on nhs-services-unique.json, output to research-data/nhs-services-validated.json
- [ ] T056 [US2] Apply tag taxonomy to validated NHS services (department=nhs, service-type=emergency/booking/information, criticality=critical/high-volume, geography=england/scotland/wales/northern-ireland), output to research-data/nhs-services-tagged.json
- [ ] T057 [US2] Transform tagged NHS services to Service Entry format, output to research-data/nhs-service-entries.json
- [ ] T058 [US2] Group NHS service entries by category (Tier 1: NHS Emergency & Urgent Care; Tier 2: NHS Routine Healthcare Services), output to research-data/nhs-services-categorized.json
- [ ] T059 [US2] Generate YAML for NHS services with inline comments, output to research-data/nhs-services.yaml
- [ ] T060 [US2] Validate nhs-services.yaml against JSON Schema
- [ ] T061 [US2] Verify coverage across all 4 UK health systems using scripts/generate-report.ts, document in research-data/reports/nhs-services-coverage.md

**Checkpoint**: User Story 2 complete - NHS services across all 4 health systems validated and ready for config.yaml merge

---

## Phase 5: User Story 3 - Emergency Services and Public Safety Monitoring (Priority: P1)

**Goal**: Discover and validate emergency service digital platforms (police, fire, ambulance, coast guard) including incident reporting, emergency response, and public safety portals with minimum 100 emergency service endpoints

**Independent Test**: Verify that police, fire, ambulance, and emergency reporting services are monitored and health check failures are detected within one check interval

**Discovery Strategy**: Systematic coverage across all emergency service types

### Discovery for User Story 3

- [ ] T062 [P] [US3] DNS enumeration for *.police.uk using subfinder, output to research-data/discovered/police-uk.txt
- [ ] T063 [P] [US3] Web search discovery for police force digital services (site:*.police.uk report OR crime OR contact OR online), document results in research-data/discovered/police-services.json
- [ ] T064 [P] [US3] Web search discovery for fire and rescue services (site:*.fire.uk OR site:*.fireservice.co.uk OR inurl:fire safety OR prevention), document results in research-data/discovered/fire-services.json
- [ ] T065 [P] [US3] Web search discovery for ambulance services (site:*.ambulance.nhs.uk OR site:*.nhs.uk ambulance), document results in research-data/discovered/ambulance-services.json
- [ ] T066 [P] [US3] Web search discovery for coast guard and maritime rescue (site:*.mcga.gov.uk OR site:*.rnli.org.uk safety OR report), document results in research-data/discovered/coast-guard-services.json
- [ ] T067 [P] [US3] Manual review of Police.UK force list (https://www.police.uk/pu/contact-the-police/), extract force-specific digital services to research-data/discovered/police-force-specific.json
- [ ] T068 [P] [US3] Manual review of UK Fire and Rescue Services list, extract digital service URLs to research-data/discovered/fire-rescue-specific.json

### Validation and Transformation for User Story 3

- [ ] T069 [US3] Merge all emergency services discovery sources into research-data/discovered/emergency-services-all.txt and deduplicate
- [ ] T070 [US3] Run URL normalization on emergency-services-all.txt, output to research-data/emergency-services-normalized.json
- [ ] T071 [US3] Run redirect resolution on emergency-services-normalized.json, output to research-data/emergency-services-canonical.json
- [ ] T072 [US3] Run deduplication on emergency-services-canonical.json, output to research-data/emergency-services-unique.json
- [ ] T073 [US3] Run accessibility validation on emergency-services-unique.json, output to research-data/emergency-services-validated.json
- [ ] T074 [US3] Apply tag taxonomy to validated emergency services (department=home-office/nhs, service-type=emergency/reporting, criticality=critical, channel=emergency/citizen-facing), output to research-data/emergency-services-tagged.json
- [ ] T075 [US3] Transform tagged emergency services to Service Entry format, output to research-data/emergency-service-entries.json
- [ ] T076 [US3] Group emergency service entries by category (Tier 1: Emergency Services - Police/Fire/Ambulance), output to research-data/emergency-services-categorized.json
- [ ] T077 [US3] Generate YAML for emergency services with 60-second check intervals, output to research-data/emergency-services.yaml
- [ ] T078 [US3] Validate emergency-services.yaml against JSON Schema
- [ ] T079 [US3] Verify minimum 100 emergency service endpoints using scripts/generate-report.ts, document in research-data/reports/emergency-services-coverage.md

**Checkpoint**: User Story 3 complete - emergency services (police, fire, ambulance, coast guard) validated and ready for config.yaml merge

---

## Phase 6: User Story 4 - Local Government Services Coverage (Priority: P2)

**Goal**: Discover and validate local government digital services (council tax, planning applications, waste management, housing) with minimum 200 local government service endpoints across shared platforms and individual local authorities

**Independent Test**: Verify that representative local government services (Planning Portal, council tax, waste collection booking) are monitored with multi-tenant service handling

**Discovery Strategy**: Focus on shared platforms serving multiple councils, then representative individual local authority services

### Discovery for User Story 4

- [ ] T080 [P] [US4] Web search discovery for shared local government platforms (site:planningportal.co.uk OR site:*.localgov.uk OR site:*.gov.uk planning application), document results in research-data/discovered/local-gov-shared-platforms.json
- [ ] T081 [P] [US4] Web search discovery for council tax services (site:*.gov.uk council tax OR pay OR online), document results in research-data/discovered/council-tax-services.json
- [ ] T082 [P] [US4] Web search discovery for waste management services (site:*.gov.uk waste OR bin OR recycling OR collection), document results in research-data/discovered/waste-services.json
- [ ] T083 [P] [US4] Web search discovery for housing and homelessness services (site:*.gov.uk housing OR homelessness OR apply), document results in research-data/discovered/housing-services.json
- [ ] T084 [P] [US4] Manual review of GOV.UK local authority directory (https://www.gov.uk/find-local-council), sample 50 representative councils, extract digital service URLs to research-data/discovered/local-authority-sample.json

### Validation and Transformation for User Story 4

- [ ] T085 [US4] Merge all local government discovery sources into research-data/discovered/local-gov-services-all.txt and deduplicate
- [ ] T086 [US4] Run URL normalization on local-gov-services-all.txt, output to research-data/local-gov-services-normalized.json
- [ ] T087 [US4] Run redirect resolution on local-gov-services-normalized.json, output to research-data/local-gov-services-canonical.json
- [ ] T088 [US4] Run deduplication on local-gov-services-canonical.json, output to research-data/local-gov-services-unique.json
- [ ] T089 [US4] Run accessibility validation on local-gov-services-unique.json, output to research-data/local-gov-services-validated.json
- [ ] T090 [US4] Apply tag taxonomy to validated local government services (service-type=application/booking/information, geography=local-authority-*, criticality=standard, channel=citizen-facing), output to research-data/local-gov-services-tagged.json
- [ ] T091 [US4] Transform tagged local government services to Service Entry format, output to research-data/local-gov-service-entries.json
- [ ] T092 [US4] Group local government service entries by category (Tier 3: Local Government Shared Platforms), output to research-data/local-gov-services-categorized.json
- [ ] T093 [US4] Generate YAML for local government services with 900-second check intervals, output to research-data/local-gov-services.yaml
- [ ] T094 [US4] Validate local-gov-services.yaml against JSON Schema
- [ ] T095 [US4] Verify minimum 200 local government service endpoints using scripts/generate-report.ts, document in research-data/reports/local-gov-coverage.md

**Checkpoint**: User Story 4 complete - local government services validated and ready for config.yaml merge

---

## Phase 7: User Story 5 - Third-Party and Contracted Service Provider Monitoring (Priority: P2)

**Goal**: Discover and validate third-party services contracted by government (booking platforms, payment processors, specialized service providers) with minimum 100 third-party endpoints

**Independent Test**: Verify that third-party booking systems, payment gateways, and contracted platforms are monitored with appropriate validation criteria

**Discovery Strategy**: Focus on government booking systems, payment platforms, and known contracted service providers

### Discovery for User Story 5

- [ ] T096 [P] [US5] Web search discovery for government booking services (site:*.gov.uk book OR booking OR appointment OR reserve third-party), document results in research-data/discovered/booking-services.json
- [ ] T097 [P] [US5] Web search discovery for GOV.UK Pay and payment platforms (site:*.payments.service.gov.uk OR site:*.pay.service.gov.uk), document results in research-data/discovered/payment-services.json
- [ ] T098 [P] [US5] Web search discovery for Notify and communication platforms (site:*.notifications.service.gov.uk), document results in research-data/discovered/notification-services.json
- [ ] T099 [P] [US5] Manual review of GOV.UK Digital Marketplace contracted services, extract service URLs from major framework agreements to research-data/discovered/contracted-services.json
- [ ] T100 [P] [US5] Web search discovery for testing and appointment booking platforms (site:*.gov.uk test OR exam OR appointment booking), document results in research-data/discovered/testing-services.json

### Validation and Transformation for User Story 5

- [ ] T101 [US5] Merge all third-party discovery sources into research-data/discovered/third-party-services-all.txt and deduplicate
- [ ] T102 [US5] Run URL normalization on third-party-services-all.txt, output to research-data/third-party-services-normalized.json
- [ ] T103 [US5] Run redirect resolution on third-party-services-normalized.json, output to research-data/third-party-services-canonical.json
- [ ] T104 [US5] Run deduplication on third-party-services-canonical.json, output to research-data/third-party-services-unique.json
- [ ] T105 [US5] Run accessibility validation on third-party-services-unique.json with custom validation for booking/payment workflows, output to research-data/third-party-services-validated.json
- [ ] T106 [US5] Apply tag taxonomy to validated third-party services (service-type=booking/payment/notification, technology=third-party, criticality=high-volume/standard), output to research-data/third-party-services-tagged.json
- [ ] T107 [US5] Transform tagged third-party services to Service Entry format with POST payloads for booking services, output to research-data/third-party-service-entries.json
- [ ] T108 [US5] Group third-party service entries by category (Tier 3: Third-Party Contracted Services), output to research-data/third-party-services-categorized.json
- [ ] T109 [US5] Generate YAML for third-party services with appropriate warning thresholds and timeouts, output to research-data/third-party-services.yaml
- [ ] T110 [US5] Validate third-party-services.yaml against JSON Schema
- [ ] T111 [US5] Verify minimum 100 third-party endpoints using scripts/generate-report.ts, document in research-data/reports/third-party-coverage.md

**Checkpoint**: User Story 5 complete - third-party contracted services validated and ready for config.yaml merge

---

## Phase 8: User Story 6 - *.services.gov.uk Domain Discovery and Monitoring (Priority: P2)

**Goal**: Perform automated discovery of all services hosted on *.services.gov.uk domain pattern with minimum 50 unique subdomains using DNS enumeration and certificate transparency

**Independent Test**: Verify that DNS enumeration and web scraping of *.services.gov.uk subdomains successfully discovers services and adds them to config.yaml with correct health check parameters

**Discovery Strategy**: Combine DNS enumeration (Subfinder + Amass) with Certificate Transparency logs for comprehensive *.services.gov.uk coverage

### Discovery for User Story 6

- [ ] T112 [US6] Run Subfinder enhanced scan for *.services.gov.uk with all configured API sources (Censys, VirusTotal, GitHub, SecurityTrails), output to research-data/discovered/services-gov-uk-subfinder-enhanced.txt
- [ ] T113 [US6] Run Amass comprehensive passive scan for *.services.gov.uk (20+ minute scan), output to research-data/discovered/services-gov-uk-amass-passive.txt
- [ ] T114 [US6] Query crt.sh PostgreSQL interface for %.services.gov.uk certificates (pagination for >999 results), output to research-data/discovered/services-gov-uk-crtsh-postgres.txt
- [ ] T115 [US6] Query CertSpotter API as backup for *.services.gov.uk subdomains, output to research-data/discovered/services-gov-uk-certspotter.txt

### Validation and Transformation for User Story 6

- [ ] T116 [US6] Merge all *.services.gov.uk discovery sources (Subfinder, Amass, crt.sh, CertSpotter) into research-data/discovered/services-gov-uk-comprehensive.txt and deduplicate
- [ ] T117 [US6] Run URL normalization on services-gov-uk-comprehensive.txt, output to research-data/services-gov-uk-normalized.json
- [ ] T118 [US6] Run redirect resolution on services-gov-uk-normalized.json, output to research-data/services-gov-uk-canonical.json
- [ ] T119 [US6] Run deduplication on services-gov-uk-canonical.json, output to research-data/services-gov-uk-unique.json
- [ ] T120 [US6] Run accessibility validation on services-gov-uk-unique.json with detection of authentication-required services (401/403 expected status), output to research-data/services-gov-uk-validated.json
- [ ] T121 [US6] Apply tag taxonomy to validated *.services.gov.uk services (auto-detect department from subdomain, service-type from URL path), output to research-data/services-gov-uk-tagged.json
- [ ] T122 [US6] Transform tagged *.services.gov.uk services to Service Entry format with appropriate expected status codes (200/401/403), output to research-data/services-gov-uk-entries.json
- [ ] T123 [US6] Group *.services.gov.uk service entries by department and criticality tier, output to research-data/services-gov-uk-categorized.json
- [ ] T124 [US6] Generate YAML for *.services.gov.uk services, output to research-data/services-gov-uk.yaml
- [ ] T125 [US6] Validate services-gov-uk.yaml against JSON Schema
- [ ] T126 [US6] Verify minimum 50 unique *.services.gov.uk subdomains using scripts/generate-report.ts, document in research-data/reports/services-gov-uk-coverage.md

**Checkpoint**: User Story 6 complete - *.services.gov.uk domain comprehensively discovered and validated

---

## Phase 9: User Story 7 - Policing and Justice Digital Services Monitoring (Priority: P2)

**Goal**: Discover and validate policing and justice system digital services (HMCTS courts/tribunals, police force portals, tribunal services, justice system platforms)

**Independent Test**: Verify that HMCTS services, police force digital services, and justice system portals are monitored with appropriate health checks and tagged by force area/jurisdiction

**Discovery Strategy**: Focus on HMCTS centralized platforms, then individual police force digital services

### Discovery for User Story 7

- [ ] T127 [P] [US7] Web search discovery for HMCTS court and tribunal services (site:*.justice.gov.uk court OR tribunal OR case OR booking), document results in research-data/discovered/hmcts-services.json
- [ ] T128 [P] [US7] Web search discovery for police force digital services beyond Police.UK (individual force websites), document results in research-data/discovered/police-force-services.json
- [ ] T129 [P] [US7] Web search discovery for legal aid and justice services (site:*.gov.uk legal aid OR solicitor OR barrister), document results in research-data/discovered/legal-services.json
- [ ] T130 [P] [US7] Manual review of HMCTS service directory (https://www.gov.uk/courts-tribunals), extract digital service URLs to research-data/discovered/hmcts-catalog.json

### Validation and Transformation for User Story 7

- [ ] T131 [US7] Merge all policing and justice discovery sources into research-data/discovered/justice-services-all.txt and deduplicate
- [ ] T132 [US7] Run URL normalization on justice-services-all.txt, output to research-data/justice-services-normalized.json
- [ ] T133 [US7] Run redirect resolution on justice-services-normalized.json, output to research-data/justice-services-canonical.json
- [ ] T134 [US7] Run deduplication on justice-services-canonical.json, output to research-data/justice-services-unique.json
- [ ] T135 [US7] Run accessibility validation on justice-services-unique.json, output to research-data/justice-services-validated.json
- [ ] T136 [US7] Apply tag taxonomy to validated justice services (department=moj/home-office, service-type=case-management/booking, geography by force area, criticality=high-volume/standard), output to research-data/justice-services-tagged.json
- [ ] T137 [US7] Transform tagged justice services to Service Entry format with 2-second warning thresholds for time-sensitive court services, output to research-data/justice-service-entries.json
- [ ] T138 [US7] Group justice service entries by category (Tier 3: MOJ/HMCTS Court & Tribunal Services), output to research-data/justice-services-categorized.json
- [ ] T139 [US7] Generate YAML for justice services with appropriate check intervals, output to research-data/justice-services.yaml
- [ ] T140 [US7] Validate justice-services.yaml against JSON Schema
- [ ] T141 [US7] Generate justice services coverage report using scripts/generate-report.ts, document in research-data/reports/justice-services-coverage.md

**Checkpoint**: User Story 7 complete - policing and justice digital services validated and ready for config.yaml merge

---

## Phase 10: User Story 8 - Service Categorization and Organizational Taxonomy (Priority: P3)

**Goal**: Ensure services are organized by meaningful categories (department, service type, geographic region, criticality) using consistent 74-tag taxonomy for status page navigation

**Independent Test**: Verify that config.yaml uses consistent tagging taxonomy and status page groups/filters services by these tags

**Implementation Strategy**: Validate and refine tag application across all user stories

### Taxonomy Refinement for User Story 8

- [ ] T142 [US8] Review all tagged services from US1-US7, identify inconsistent tag usage in research-data/reports/tag-usage-analysis.md
- [ ] T143 [US8] Validate tag hierarchy (parent-child relationships, no circular dependencies) using scripts/validate-taxonomy.ts
- [ ] T144 [US8] Generate tag usage statistics (service count per tag, top 20 most-used tags) using scripts/generate-report.ts
- [ ] T145 [US8] Review and standardize geography tags (uk-wide vs country-specific vs local-authority-*) across all services
- [ ] T146 [US8] Review and standardize service-type tags (application vs booking vs portal vs case-management) for clarity
- [ ] T147 [US8] Verify all services have minimum 2 tags and maximum 10 tags per data-model.md validation rules
- [ ] T148 [US8] Verify criticality tag distribution (critical: emergency only, high-volume: HMRC/DVLA/DWP/NHS, standard: others)
- [ ] T149 [US8] Document final taxonomy in research-data/reports/taxonomy-final.md with usage counts and examples

**Checkpoint**: User Story 8 complete - consistent taxonomy applied across all 9500+ services

---

## Phase 11: User Story 9 - Service Research and Documentation (Priority: P3)

**Goal**: Create structured research outputs documenting discovered services, endpoints, validation criteria, organizational ownership, and discovery sources for maintainability

**Independent Test**: Verify that research outputs include service URLs, expected status codes, validation text patterns, ownership departments, and discovery sources

**Implementation Strategy**: Generate comprehensive documentation from research artifacts

### Documentation for User Story 9

- [ ] T150 [P] [US9] Generate comprehensive research report summarizing all discovery sources used (DNS, CT logs, web search, manual review) in research-data/reports/discovery-methodology.md
- [ ] T151 [P] [US9] Generate service ownership mapping (URL → department/agency) in research-data/reports/service-ownership.csv
- [ ] T152 [P] [US9] Generate excluded services report (services discovered but excluded with reasons: internal-only, deprecated, duplicates) in research-data/reports/excluded-services.md
- [ ] T153 [P] [US9] Generate validation criteria rationale report (complex services with text validation patterns, POST payloads) in research-data/reports/validation-rationale.md
- [ ] T154 [US9] Generate discovery timeline (when services were discovered, by which method) in research-data/reports/discovery-timeline.csv
- [ ] T155 [US9] Generate final statistics report (total discovered, validated, added to config, success criteria verification) in research-data/reports/final-statistics.md

**Checkpoint**: User Story 9 complete - comprehensive documentation generated for long-term maintainability

---

## Phase 12: Final Integration and Quality Verification

**Purpose**: Merge all user story outputs, validate against success criteria, verify 9500+ service requirement met

- [ ] T156 Merge all user story YAML files (government-services.yaml, nhs-services.yaml, emergency-services.yaml, local-gov-services.yaml, third-party-services.yaml, services-gov-uk.yaml, justice-services.yaml) into single config-additions.yaml with proper section ordering by criticality tier
- [ ] T157 Validate merged config-additions.yaml against JSON Schema using scripts/validate-config.ts (zero schema errors required)
- [ ] T158 Verify total service count meets SC-001 (minimum 9500 unique endpoints) using jq query on merged file
- [ ] T159 Verify major department coverage meets SC-002 (minimum 50 services per HMRC, DVLA, DWP, NHS, Home Office, MOJ) using scripts/generate-report.ts
- [ ] T160 Verify UK health systems coverage meets SC-003 (NHS England, Scotland, Wales, Northern Ireland represented) using tag filtering
- [ ] T161 Verify emergency services coverage meets SC-004 (minimum 100 emergency service endpoints) using tag filtering
- [ ] T162 Verify local government coverage meets SC-005 (minimum 200 local government endpoints) using tag filtering
- [ ] T163 Verify *.services.gov.uk coverage meets SC-006 (minimum 50 unique subdomains) using domain filtering
- [ ] T164 Verify third-party coverage meets SC-007 (minimum 100 third-party endpoints) using tag filtering
- [ ] T165 Verify tag taxonomy coverage meets SC-012 (at least 50 unique tags used) using scripts/generate-report.ts
- [ ] T166 Check config-additions.yaml file size is under 5MB target to meet maintainability requirements
- [ ] T167 Generate final research report documenting methodology reproducibility (SC-011) in research-data/reports/research-methodology-final.md
- [ ] T168 Manual review of config-additions.yaml for YAML syntax correctness, comment quality, section organization
- [ ] T169 Backup existing config.yaml to config-backup-$(date +%Y%m%d).yaml before merge
- [ ] T170 Merge config-additions.yaml into config.yaml at appropriate section locations (Tier 1 Critical, Tier 2 High-Volume, Tier 3 Standard)
- [ ] T171 Run full config.yaml validation after merge using scripts/validate-config.ts
- [ ] T172 Commit config.yaml changes to feature branch 002-add-9500-public-services with descriptive commit message documenting total services added and coverage achieved

**Checkpoint**: All 9500+ services validated, merged into config.yaml, all success criteria verified, ready for pull request

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-9)**: All depend on Foundational phase completion
  - User Stories 1-3 (P1 - Government, NHS, Emergency): Can proceed in parallel after Foundational complete
  - User Stories 4-7 (P2 - Local Gov, Third-Party, services.gov.uk, Justice): Can proceed in parallel after Foundational complete
  - User Stories 8-9 (P3 - Taxonomy, Documentation): Depend on US1-US7 data collection
- **Final Integration (Phase 12)**: Depends on all desired user stories being complete (US1-US9 for full 9500+ coverage)

### User Story Dependencies

- **User Story 1 (P1 - Government)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1 - NHS)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P1 - Emergency)**: Can start after Foundational (Phase 2) - Independent of US1-US2
- **User Story 4 (P2 - Local Gov)**: Can start after Foundational (Phase 2) - Independent of US1-US3
- **User Story 5 (P2 - Third-Party)**: Can start after Foundational (Phase 2) - Independent of US1-US4
- **User Story 6 (P2 - services.gov.uk)**: Can start after Foundational (Phase 2) - Independent of US1-US5
- **User Story 7 (P2 - Justice)**: Can start after Foundational (Phase 2) - Independent of US1-US6
- **User Story 8 (P3 - Taxonomy)**: Depends on US1-US7 tag data - Cannot start until tag application complete
- **User Story 9 (P3 - Documentation)**: Depends on US1-US7 research data - Can start as US1-US7 complete

### Within Each User Story

- Discovery tasks marked [P] can run in parallel (different discovery methods)
- Validation and transformation must run sequentially: normalization → redirect resolution → deduplication → accessibility validation → tag application → transformation → grouping → YAML generation
- YAML validation must complete before moving to next user story

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T004, T005, T007, T008)
- All Foundational scripts marked [P] can run in parallel (T010-T019 after T009 completes)
- User Stories 1-7 can all start in parallel after Foundational phase (maximum parallelization)
- Within each user story, all discovery tasks marked [P] can run in parallel
- US8 and US9 can run in parallel once US1-US7 complete

---

## Parallel Example: User Story 1 (Government Services)

```bash
# Launch all discovery tasks for User Story 1 together:
Task T020: "DNS enumeration for *.services.gov.uk using subfinder"
Task T021: "Certificate Transparency query for %.services.gov.uk"
Task T022: "DNS enumeration for *.gov.uk using amass"
Task T023: "Web search discovery for HMRC services"
Task T024: "Web search discovery for DVLA services"
Task T025: "Web search discovery for DWP services"
Task T026: "Web search discovery for Home Office services"
Task T027: "Web search discovery for MOJ/HMCTS services"
Task T028: "Web search discovery for DfE services"
Task T029: "Web search discovery for DEFRA services"
Task T030: "Web search discovery for Companies House and IPO services"

# All 11 discovery tasks can run concurrently (estimated 20-30 minutes total vs 3+ hours sequential)
```

---

## Parallel Example: Multiple User Stories

```bash
# After Foundational phase completes, launch all P1 user stories in parallel:
Agent 1: Execute User Story 1 (Government Services Discovery)
Agent 2: Execute User Story 2 (NHS and Healthcare Services)
Agent 3: Execute User Story 3 (Emergency Services)

# All 3 agents can work independently, discovering and validating services in parallel
# Estimated time: 4-6 hours parallel vs 12-18 hours sequential
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only - P1 Priority)

1. Complete Phase 1: Setup (tools installed, directories created)
2. Complete Phase 2: Foundational (validation scripts operational) ← CRITICAL BLOCKER
3. Complete Phase 3: User Story 1 (Government Services - HMRC, DVLA, DWP, etc.)
4. Complete Phase 4: User Story 2 (NHS across all 4 health systems)
5. Complete Phase 5: User Story 3 (Emergency Services - police, fire, ambulance)
6. **STOP and VALIDATE**: Merge US1-US3 YAML, verify minimum coverage thresholds
7. Estimated services from US1-US3: 3000-5000 services (critical + high-volume tiers)

### Incremental Delivery (All User Stories for 9500+ Coverage)

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Merge to config.yaml (est. 1500 services)
3. Add User Story 2 → Test independently → Merge to config.yaml (est. 800 services)
4. Add User Story 3 → Test independently → Merge to config.yaml (est. 400 services)
5. Add User Story 4 → Test independently → Merge to config.yaml (est. 1000 services)
6. Add User Story 5 → Test independently → Merge to config.yaml (est. 600 services)
7. Add User Story 6 → Test independently → Merge to config.yaml (est. 4000 services)
8. Add User Story 7 → Test independently → Merge to config.yaml (est. 1200 services)
9. Add User Stories 8-9 → Taxonomy refinement and documentation
10. Final integration → Verify 9500+ total services across all categories

### Parallel Team Strategy

With multiple researchers/developers:

1. Team completes Setup + Foundational together (1-2 days)
2. Once Foundational is done:
   - Researcher A: User Story 1 (Government Services)
   - Researcher B: User Story 2 (NHS Services)
   - Researcher C: User Story 3 (Emergency Services)
   - Researcher D: User Story 4 (Local Government)
   - Researcher E: User Story 6 (*.services.gov.uk comprehensive)
3. Stories complete independently, merge incrementally
4. User Stories 8-9 (Taxonomy + Documentation) after US1-US7 data collected

---

## Estimated Timeline

**Sequential Execution** (single researcher):
- Setup: 0.5 days
- Foundational: 2 days
- User Story 1: 10-15 hours (government services)
- User Story 2: 8-12 hours (NHS services)
- User Story 3: 4-6 hours (emergency services)
- User Story 4: 6-8 hours (local government)
- User Story 5: 4-6 hours (third-party)
- User Story 6: 15-20 hours (*.services.gov.uk comprehensive)
- User Story 7: 6-8 hours (justice services)
- User Story 8: 4 hours (taxonomy refinement)
- User Story 9: 4 hours (documentation)
- Final Integration: 4 hours
- **Total: 80-120 hours (10-15 working days)**

**Parallel Execution** (5 researchers):
- Setup + Foundational: 2 days (shared)
- User Stories 1-7 in parallel: 20 hours max (2.5 days)
- User Stories 8-9: 8 hours (1 day)
- Final Integration: 4 hours (0.5 days)
- **Total: 6-7 working days with team of 5**

---

## Notes

- [P] tasks = different files/discovery sources, no dependencies - run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Research data in research-data/ directory is ephemeral (not committed to repository)
- Only final config.yaml is committed to repository
- Validation pass rate: 100% required before services added to config.yaml
- Service count targets are minimums - exhaustive discovery should continue beyond thresholds
- Commit after each user story completion or logical checkpoint
- Stop at any checkpoint to validate story independently before proceeding

---

## Total Task Count

- **Setup (Phase 1)**: 8 tasks
- **Foundational (Phase 2)**: 11 tasks
- **User Story 1 (P1)**: 22 tasks (T020-T041)
- **User Story 2 (P1)**: 20 tasks (T042-T061)
- **User Story 3 (P1)**: 18 tasks (T062-T079)
- **User Story 4 (P2)**: 16 tasks (T080-T095)
- **User Story 5 (P2)**: 16 tasks (T096-T111)
- **User Story 6 (P2)**: 15 tasks (T112-T126)
- **User Story 7 (P2)**: 15 tasks (T127-T141)
- **User Story 8 (P3)**: 8 tasks (T142-T149)
- **User Story 9 (P3)**: 6 tasks (T150-T155)
- **Final Integration (Phase 12)**: 17 tasks (T156-T172)

**Total: 172 tasks**

**Parallelizable tasks**: 89 tasks marked [P] (51% of total) - significant parallel execution opportunity

**Estimated service coverage by user story**:
- US1 (Government): ~1500 services
- US2 (NHS): ~800 services
- US3 (Emergency): ~400 services
- US4 (Local Gov): ~1000 services
- US5 (Third-Party): ~600 services
- US6 (*.services.gov.uk): ~4000 services
- US7 (Justice): ~1200 services
- **Total: 9500+ services** (meets SC-001 minimum baseline)
