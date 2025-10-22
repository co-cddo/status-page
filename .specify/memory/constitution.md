<!--
SYNC IMPACT REPORT
==================
Version Change: 1.1.0 → 1.1.1 (PATCH: Clarification of tool costs)
Principles Modified:
  - VIII. Research-Driven Technical Decisions: Added token cost guidance
Sections Modified:
  - Core Principles: Updated Principle VIII with cost-aware tool prioritization
  - Development Process Guidance: Added cost guidance for each tool
Templates Status:
  ✅ plan-template.md - No changes required
  ✅ spec.md - No changes required
  ✅ tasks-template.md - No changes required
  ✅ speckit.constitution.md - This command file
Follow-up TODOs: None
-->

# GDS Status Application Constitution

## Core Principles

### I. GDS Design System Compliance (NON-NEGOTIABLE)

**All user-facing components MUST adhere to the Government Digital Service (GDS) Design System.**

- Use the GOV.UK Frontend toolkit as the foundation for all UI components
- Follow GDS component patterns exactly as documented (buttons, form inputs, navigation, error messages, etc.)
- Implement GDS page templates and layouts without deviation
- Use only GDS-approved typography (GDS Transport, Arial fallback), spacing, and color schemes
- All custom components MUST be justified and documented with rationale for why no GDS component exists
- Component library MUST maintain parity with the latest stable GOV.UK Frontend release

**Rationale**: Consistency across government services ensures users can seamlessly interact with all government digital services. Non-compliance creates accessibility barriers and erodes public trust.

### II. Accessibility-First Development (NON-NEGOTIABLE)

**All features MUST meet WCAG 2.2 Level AA standards as a minimum requirement, with AAA as a target.**

- Every component MUST pass automated accessibility audits (axe-core, Pa11y)
- Manual testing MUST include keyboard-only navigation, screen reader testing (NVDA, JAWS, VoiceOver)
- All interactive elements MUST have visible focus indicators meeting GDS contrast requirements (3:1 minimum)
- Forms MUST include clear error messages, fieldset grouping, and labels following GDS patterns
- All non-text content MUST have text alternatives
- Color MUST NOT be the only means of conveying information
- Touch targets MUST be minimum 44x44px (mobile) following GDS mobile-first principles
- Accessibility testing MUST occur before code review, not after

**Rationale**: Government services serve all citizens. Accessibility is a legal requirement (Public Sector Bodies Accessibility Regulations 2018) and moral obligation.

### III. Test-Driven Development (NON-NEGOTIABLE)

**All development follows strict TDD: Write tests → Tests fail → Implement → Tests pass → Refactor.**

- Unit tests MUST be written before implementation code
- Integration tests MUST verify component contracts and API endpoints
- End-to-end tests MUST validate complete user journeys for all user stories
- Tests MUST cover accessibility requirements (automated accessibility assertions in test suites)
- Minimum code coverage: 80% for new code, with gradual improvement for legacy code
- All tests MUST run in CI/CD pipeline; failing tests BLOCK merges
- Visual regression tests MUST catch unintended UI changes
- Performance tests MUST validate performance budgets (see Principle V)

**Test Categories**:
- **Contract Tests**: Verify API endpoint schemas, response codes, data contracts
- **Integration Tests**: Verify interactions between services, database queries, external APIs
- **Unit Tests**: Verify individual functions, component logic, utilities
- **E2E Tests**: Verify complete user flows from browser perspective
- **Accessibility Tests**: Automated and manual WCAG compliance verification

**Rationale**: Tests are living documentation. TDD prevents regression, enables refactoring confidence, and ensures features work as specified before deployment.

### IV. Progressive Enhancement

**All features MUST work without JavaScript; enhanced experience with JavaScript is optional.**

- Core content and functionality MUST be accessible with HTML and CSS only
- Forms MUST submit via standard HTTP POST with server-side validation
- Navigation MUST work with plain anchor links
- JavaScript enhancements improve experience but are NOT required for core tasks
- Server-side rendering MUST provide complete, functional HTML
- No client-side-only routing for core journeys
- Graceful degradation for older browsers (IE11 baseline, as per GDS guidance)

**Rationale**: Government services must be resilient. Network failures, JavaScript errors, assistive technologies, and older devices must not prevent citizens from accessing services.

### V. Performance Budgets (NON-NEGOTIABLE)

**All pages MUST meet or exceed these performance standards on median mobile devices (3G connection).**

- **First Contentful Paint (FCP)**: < 1.8 seconds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Time to Interactive (TTI)**: < 3.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Total Blocking Time (TBT)**: < 300ms
- **Page Weight**:
  - HTML: < 14KB (compressed)
  - CSS: < 50KB (compressed)
  - JavaScript: < 100KB (compressed, only for enhancements)
  - Images: Use responsive images, WebP with fallbacks, lazy loading
  - Total page weight: < 500KB (uncompressed)

**Measurement**:
- Use Lighthouse CI in pipeline; scores below 90 (Performance) BLOCK merges
- Real User Monitoring (RUM) MUST track Core Web Vitals in production
- Test on real devices representing median UK user (mid-range Android, 3G)

**Rationale**: Many UK citizens access services on slow connections and older devices. Performance is accessibility. Slow services exclude users and cost citizens time and data.

### VI. Component Quality Standards

**All code MUST meet these quality standards before review.**

- **Code Style**:
  - Follow GDS Frontend coding standards for HTML, CSS, JavaScript
  - Use linting (ESLint, Stylelint) with GDS-recommended configurations
  - Consistent formatting via Prettier (GDS config)
  - BEM methodology for CSS class naming
  - Semantic HTML5 elements

- **Documentation**:
  - All components MUST include usage examples
  - Complex logic MUST include inline comments explaining "why" not "what"
  - API documentation MUST use OpenAPI 3.0+ specification
  - README MUST include setup, testing, deployment instructions

- **Code Review**:
  - All code MUST pass peer review before merge
  - Reviewers MUST verify GDS compliance, accessibility, tests, performance
  - No single-reviewer approvals; minimum 2 reviewers for critical paths

- **Security**:
  - Follow OWASP Top 10 mitigation strategies
  - All user input MUST be validated server-side
  - No secrets in code; use environment variables and secret management
  - Regular dependency updates; automated security scanning (npm audit, Snyk)
  - Content Security Policy (CSP) headers MUST be implemented

**Rationale**: Quality standards prevent technical debt, ensure maintainability, and protect users. Code reviews spread knowledge and catch errors.

### VII. User Research & Data-Driven Decisions

**All design decisions MUST be validated through user research and data.**

- Features MUST include measurable success criteria (see spec template)
- Changes to core journeys MUST undergo user testing before deployment
- Analytics MUST track user behavior to identify pain points (with user consent and privacy compliance)
- A/B testing SHOULD inform design iterations for non-critical improvements
- User feedback mechanisms MUST be present on all public-facing pages
- Research findings MUST be documented and shared with the team
- Follow GDS Service Manual guidance on user research

**Rationale**: Assumptions harm users. Data and research reveal real user needs, ensuring services work for citizens, not just stakeholders.

### VIII. Research-Driven Technical Decisions (NON-NEGOTIABLE)

**All technical decisions MUST be informed by exhaustive research using available tools to ensure optimal choices.**

- **Before implementation**, developers MUST research using cost-appropriate tools:
  - **Primary (no token cost - use extensively)**:
    - Context7 (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`): Retrieve up-to-date official documentation for any library
    - WebSearch (`WebSearch`): Explore current patterns, pitfalls, community consensus (2025 context)
    - WebFetch (`WebFetch`): Retrieve official documentation, changelogs, migration guides, GitHub READMEs
  - **Secondary (token cost - use judiciously for complex analysis)**:
    - Perplexity (`mcp__perplexity-researcher__perplexity_ask`): Compare approaches with synthesized expert analysis, nuanced architectural tradeoffs

- **Technology Choices**:
  - MUST query Context7 for library documentation before selecting dependencies (no cost - use liberally)
  - MUST search for "best practices 2025" using WebSearch before implementing patterns (no cost - use liberally)
  - MUST fetch official docs using WebFetch to verify API signatures, configuration options, breaking changes (no cost - use liberally)
  - SHOULD use Perplexity for complex architectural decisions requiring expert synthesis (token cost - reserve for high-value questions)

- **Documentation Requirements**:
  - Decision documents (e.g., research.md) MUST cite sources (Context7 library IDs, URLs fetched, search queries used)
  - When tools return conflicting information, MUST document rationale for chosen approach
  - Research findings MUST be preserved in spec/plan documentation for future reference

- **Prohibited Practices**:
  - Do NOT implement from memory or assumption when research tools are available
  - Do NOT copy patterns from outdated blog posts without verifying against current documentation
  - Do NOT select libraries without checking Context7 for official docs and version compatibility
  - Do NOT ignore tool suggestions when tools proactively offer to research unknowns

- **Quality Gates**:
  - Code review MUST verify that technical decisions cite research sources
  - Architecture Decision Records (ADRs) MUST reference Context7 library IDs or URLs consulted
  - Pull requests introducing new dependencies MUST include Context7 documentation links

**Rationale**: Government services require reliable, maintainable, secure code. Research tools provide access to current, authoritative information that prevents costly mistakes, outdated patterns, and technical debt. Exhaustive research ensures decisions are evidence-based, not assumption-based, leading to higher quality implementations that align with current best practices and official recommendations. Context7 and web research tools (WebSearch, WebFetch) have no token cost and should be used extensively; Perplexity has token cost and should be reserved for complex questions where synthesized expert analysis adds significant value.

**Cost-Aware Research Examples**:
- "Which testing framework?" → Context7 for Vitest docs + WebSearch "vitest vs jest 2025 comparison" (no cost)
- "Specific API usage?" → WebFetch Node.js docs for worker_threads API (no cost)
- "Best practices for pattern X?" → WebSearch "{pattern} best practices 2025" (no cost)
- "Complex architectural tradeoff?" → Perplexity "compare serverless vs containers for government services considering compliance, cost, vendor lock-in" (token cost - high-value synthesis question)

## Code Quality & Technical Standards

### Version Control
- **Branching Strategy**: Feature branches (`###-feature-name`) from `main`; merge via pull requests only
- **Commit Messages**: Follow Conventional Commits (feat:, fix:, docs:, test:, refactor:)
- **Protected Branches**: `main` branch requires passing CI, code review approval, and no merge commits

### Continuous Integration/Deployment
- **CI Pipeline MUST**:
  - Run all tests (unit, integration, e2e, accessibility)
  - Execute linting and code formatting checks
  - Run Lighthouse CI performance audits
  - Execute security scans
  - Build deployable artifacts
- **Deployment MUST**:
  - Use infrastructure as code (Terraform, CloudFormation, etc.)
  - Include smoke tests post-deployment
  - Support zero-downtime deployments
  - Enable instant rollback capability

### Dependency Management
- Pin exact versions in production dependencies
- Regular security updates (weekly automated PRs)
- Minimize dependencies; justify each addition (with Context7 documentation review)
- Prefer GOV.UK Frontend toolkit over external UI libraries
- Audit licenses for compatibility with open government requirements

### Development Process Guidance

**Research Tools Usage** (aligns with Principle VIII):

During all phases of development (specification, planning, implementation), teams MUST leverage available research tools with cost awareness:

**Primary Tools (No Token Cost - Use Extensively)**:

1. **Context7** (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`):
   - **Cost**: FREE - no token cost
   - **Use liberally** for retrieving up-to-date official documentation for any library
   - Resolve library names to Context7-compatible IDs
   - Fetch specific topics (e.g., "hooks", "routing") for focused documentation
   - Always verify API signatures, configuration options, breaking changes
   - **When to use**: Every time you need library documentation, API references, or version-specific guidance

2. **WebSearch** (`WebSearch`):
   - **Cost**: FREE - no token cost
   - **Use liberally** for exploring current best practices, patterns, comparisons
   - Search for "{technology} best practices 2025" to get current guidance
   - Research security vulnerabilities, performance considerations, common pitfalls
   - Verify community consensus on architectural decisions
   - **When to use**: Whenever you need current patterns, community wisdom, or comparative analysis

3. **WebFetch** (`WebFetch`):
   - **Cost**: FREE - no token cost
   - **Use liberally** for retrieving official documentation, changelogs, migration guides
   - Fetch GitHub READMEs, official API docs, release notes
   - Access specific documentation pages referenced in search results
   - **When to use**: To retrieve full text of specific documentation pages, READMEs, or changelogs

**Secondary Tool (Token Cost - Use Judiciously)**:

4. **Perplexity** (`mcp__perplexity-researcher__perplexity_ask`):
   - **Cost**: Token cost applies - use for high-value questions only
   - **Invaluable** for complex technical comparisons requiring synthesized expert analysis
   - Ask nuanced questions about architecture tradeoffs with multiple considerations
   - Get synthesized answers with citations that combine multiple sources
   - **When to use**: Reserve for complex questions where synthesized analysis adds significant value (e.g., comparing architectural approaches with government-specific constraints, evaluating tradeoffs across security/performance/cost dimensions)
   - **Cost management**: Start with WebSearch + Context7 + WebFetch; escalate to Perplexity when synthesis of multiple expert perspectives is needed

**When to Research**:
- **Specification Phase**: Research technical feasibility, existing solutions, design patterns
- **Planning Phase**: Research architecture approaches, library selection, integration patterns
- **Implementation Phase**: Research specific API usage, edge case handling, optimization techniques
- **Code Review**: Verify decisions align with current best practices and official recommendations

**Research Documentation**:
- Feature specs MUST include "Development Process Guidance" section recommending research tools
- Implementation plans MUST include research.md documenting all technical decisions with sources
- Pull requests introducing new patterns MUST reference research sources in description

## User Experience Standards

### Mobile-First Design
- Design for smallest screen first (320px width minimum)
- Touch-friendly interactions (44x44px minimum touch targets)
- Responsive typography using GDS type scale
- Test on real mobile devices, not just emulators

### Content Standards
- Use plain English (target reading age: 9 years old)
- Follow GDS content style guide for tone, terminology, formatting
- Use active voice, short sentences, bullet points
- Avoid jargon; explain technical terms when necessary
- All content MUST pass readability tests (Flesch-Kincaid Grade Level ≤ 9)

### Form Design
- One thing per page approach (reduce cognitive load)
- Clear labels and hint text following GDS patterns
- Inline validation with clear error messages
- Error summary at page top with anchor links to fields
- Autosave for long forms (with clear indication)
- Support browser autofill with proper autocomplete attributes

### Error Handling
- Meaningful error messages that explain what went wrong and how to fix it
- No technical jargon in user-facing errors
- Log detailed errors server-side for debugging
- Graceful degradation; never show stack traces to users
- Contact information for help on error pages

## Testing Requirements

### Test Environment Parity
- Development, staging, production environments MUST be identical (infrastructure as code)
- Use production-like data volumes in staging
- Test on representative browsers (Chrome, Firefox, Safari, Edge, IE11)
- Test on representative devices (iOS, Android, desktop)

### Automated Testing
- **Unit Tests**: Jest (JavaScript), pytest (Python), or equivalent
- **Integration Tests**: Supertest (API), Cypress component tests
- **E2E Tests**: Cypress, Playwright, or equivalent
- **Accessibility Tests**: axe-core, Pa11y CI
- **Visual Regression**: Percy, BackstopJS, or equivalent
- **Performance Tests**: Lighthouse CI, WebPageTest API

### Manual Testing
- Screen reader testing (NVDA on Windows, VoiceOver on macOS/iOS)
- Keyboard-only navigation
- Browser zoom to 200% (text must remain readable, no horizontal scrolling)
- High contrast mode testing
- User acceptance testing by product owner before release

## Performance Requirements

### Monitoring
- Real User Monitoring (RUM) MUST track Core Web Vitals
- Application Performance Monitoring (APM) for backend services
- Error tracking (Sentry, Rollbar, or equivalent)
- Uptime monitoring with alerting
- Log aggregation and analysis

### Optimization Techniques
- HTTP/2 or HTTP/3 for multiplexing
- Compression (Gzip, Brotli)
- CDN for static assets
- Image optimization (WebP, responsive images, lazy loading)
- Critical CSS inlining
- Defer non-critical JavaScript
- Database query optimization (N+1 query prevention)
- Caching strategy (Redis, CDN, browser cache headers)

### Scalability
- Horizontal scaling capability for stateless services
- Database connection pooling
- Asynchronous processing for long-running tasks
- Rate limiting to prevent abuse
- Load testing before major releases (target 10x expected traffic)

## Governance

### Amendment Process
1. Propose amendment via pull request to this constitution file
2. Document rationale for change
3. Assess impact on existing code and templates
4. Team review and approval (minimum 75% consensus)
5. Update dependent templates and documentation
6. Increment version according to semantic versioning rules

### Version Semantics
- **MAJOR**: Backward-incompatible principle removals or redefinitions requiring significant rework
- **MINOR**: New principles or sections added; expanded guidance
- **PATCH**: Clarifications, wording improvements, non-semantic refinements

### Compliance Review
- All pull requests MUST include constitution compliance checklist
- Non-compliance MUST be explicitly justified with plan to resolve
- Technical debt that violates constitution MUST be tracked and prioritized for resolution
- Quarterly constitution review to assess effectiveness and identify needed amendments

### Enforcement
- Automated checks in CI/CD pipeline enforce measurable standards (tests, accessibility, performance)
- Code review checklist includes constitution compliance verification
- Product owner validates user experience standards
- Security team reviews security-related changes
- Accessibility specialist reviews significant UI changes
- **Research compliance**: Reviewers verify technical decisions cite Context7/WebSearch/WebFetch sources

### Complexity Justification
- Any introduction of complexity that violates simplicity principles MUST be documented
- Document what simpler alternatives were considered and why they were rejected
- Re-evaluate complex solutions quarterly to check if simplification is now possible

### Living Document
- This constitution is a living document that evolves with team learning and technology changes
- All team members can propose amendments
- Constitution supersedes individual opinions and preferences
- When in doubt, refer to GDS Service Manual and GOV.UK Design System documentation
- **Research supersedes assumptions**: When research tools are available, use them instead of relying on memory

**Version**: 1.1.0 | **Ratified**: 2025-01-21 | **Last Amended**: 2025-10-22
