# Post-Build Asset Inlining for Self-Contained HTML

**Status**: Accepted

**Date**: 2025-10-22

**Decision Makers**: Development Team

## Context

The GOV.UK Public Services Status Monitor must generate self-contained HTML that works as a single HTTP request according to FR-021. This requirement ensures:
- **Offline functionality**: Page works after initial load, even without network
- **Single HTTP request**: Minimize latency and network dependencies
- **GitHub Pages compatibility**: Static hosting without asset serving complexity
- **Performance**: < 2 second load time on 3G networks
- **File size constraint**: < 5MB target for complete page
- **Auditability**: Government transparency requires traceable, self-contained artifacts

From research.md: "Self-contained HTML eliminates external dependencies post-build, ensuring the status page functions reliably even if CDN or external asset servers fail."

The challenge: Eleventy generates HTML with external `<link>` and `<script>` references to CSS/JS files, plus `<img>` tags pointing to separate image files. These external references violate the single HTTP request requirement.

## Decision

We will implement a **custom Node.js post-build script** using native Node.js 22+ features (zero external dependencies) to inline all assets after Eleventy build completes.

Post-build inlining process:
1. **Read generated HTML** from `_site/index.html`
2. **Inline CSS**: Replace `<link rel="stylesheet">` with `<style>` tags containing file contents
3. **Inline JavaScript**: Replace `<script src="">` with `<script>` tags containing file contents
4. **Inline images**: Replace `<img src="">` and CSS `url()` with base64-encoded data URIs
5. **Validate size**: Fail build if final HTML exceeds 5MB target
6. **Write output**: Save self-contained HTML to `output/index.html`

The script will:
- Use native Node.js fs/path modules (no dependencies)
- Process GOV.UK Design System assets from @x-govuk/govuk-eleventy-plugin
- Handle errors gracefully (fail build with clear error message)
- Provide size breakdown (CSS bytes, JS bytes, image bytes)

## Consequences

### Positive Consequences

- **Zero external dependencies**: No npm packages required for post-build process
- **Single HTTP request**: All assets embedded in HTML
- **Offline functionality**: Page works without network after initial load
- **GitHub Pages compatible**: No special asset serving configuration needed
- **Auditable**: Self-contained HTML is a complete artifact for archival
- **Simple deployment**: One file to deploy (`output/index.html`)
- **Cacheable**: Entire page can be cached as single unit

### Negative Consequences

- **Large file size**: HTML grows from ~10KB to ~200KB-1MB with inlined assets
- **No cache reuse**: Browsers can't cache CSS/JS/images separately across page loads
- **Slower first load**: Must download entire page before rendering begins
- **Build time**: Post-build script adds ~500ms-1s to build time
- **Maintenance burden**: Custom script requires ongoing maintenance vs npm package

## Alternatives Considered

### Option 1: Build-Time Bundling (Webpack, Rollup, esbuild)

**Description**: Use a bundler to inline assets during the build process.

**Pros**:
- Industry-standard tools
- Advanced optimization (tree-shaking, minification)
- Large ecosystem of plugins

**Cons**:
- Heavy dependencies (Webpack ~40MB, esbuild ~10MB)
- Complex configuration
- Incompatible with Eleventy's plugin architecture
- Overkill for simple inlining task
- Requires understanding bundler internals

**Verdict**: Over-engineered. Bundlers are designed for JavaScript applications, not static HTML post-processing.

### Option 2: inline-source npm package

**Description**: Use [inline-source](https://www.npmjs.com/package/inline-source) to inline assets.

**Pros**:
- Maintained npm package
- HTML comment annotations for selective inlining
- Handles CSS/JS/SVG

**Cons**:
- External dependency (9 transitive dependencies)
- Limited customization
- May not handle GOV.UK Design System assets correctly
- No size validation
- Adds dependency bloat

**Verdict**: Unnecessary dependency. Custom script provides better control and zero dependencies.

### Option 3: eleventy-plugin-inline

**Description**: Use Eleventy plugin for asset inlining.

**Pros**:
- Integrates with Eleventy build process
- No separate post-build step

**Cons**:
- Plugin ecosystem for inlining is immature
- May conflict with @x-govuk/govuk-eleventy-plugin
- Limited control over inlining logic
- Not actively maintained

**Verdict**: Too risky. Plugin compatibility with GOV.UK plugin is unknown.

### Option 4: Critical CSS + External Assets

**Description**: Inline only critical CSS, load remaining assets externally.

**Pros**:
- Faster initial render
- Smaller initial HTML
- Browser can cache external assets
- Better performance for repeat visitors

**Cons**:
- Violates single HTTP request requirement (FR-021)
- Requires CDN or GitHub Pages asset serving
- Not self-contained (offline functionality lost)
- Adds complexity (critical CSS extraction)

**Verdict**: Fails core requirement. Self-contained HTML is non-negotiable.

### Option 5: Service Workers for Offline Functionality

**Description**: Use Service Workers to cache assets instead of inlining.

**Pros**:
- Progressive Web App (PWA) pattern
- Efficient caching
- Smaller HTML size

**Cons**:
- Requires JavaScript (violates progressive enhancement)
- Service Workers are complex to implement correctly
- Doesn't work on first visit (cache empty)
- Not supported in all browsers (though widely supported now)
- Fails single HTTP request requirement

**Verdict**: Requires JavaScript, violates progressive enhancement principle.

## References

- [MDN: Data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)
- [Node.js fs module](https://nodejs.org/api/fs.html)
- [Node.js path module](https://nodejs.org/api/path.html)
- [research.md](../../specs/001-govuk-status-monitor/research.md) - Section 4: Post-Build Asset Inlining
- [spec.md FR-021](../../specs/001-govuk-status-monitor/spec.md#functional-requirements) - Self-contained HTML requirement
- [spec.md Assumption](../../specs/001-govuk-status-monitor/spec.md#assumptions) - Self-contained HTML < 5MB

## Notes

**Implementation Location**: `src/inlining/post-build.ts`, `src/inlining/css-inliner.ts`, `src/inlining/js-inliner.ts`, `src/inlining/image-inliner.ts`

**Asset Detection**:
- CSS: Match `<link rel="stylesheet" href="...">` tags
- JavaScript: Match `<script src="..."></script>` tags
- Images: Match `<img src="...">` tags and CSS `url(...)` references

**Base64 Encoding**: Images are base64-encoded as data URIs:
```html
<!-- Before -->
<img src="/assets/logo.png" alt="Logo">

<!-- After -->
<img src="data:image/png;base64,iVBORw0KGgoAAAA..." alt="Logo">
```

**Size Validation**: If final HTML exceeds 5MB, the build fails with:
- Actual file size
- Size breakdown by asset type (CSS, JS, images)
- Suggested optimizations (unused CSS removal, image compression)

**GOV.UK Design System Assets**: The @x-govuk/govuk-eleventy-plugin bundles GOV.UK Frontend CSS/JS/images. These must all be inlined:
- `govuk-frontend.min.css` (~120KB)
- `govuk-frontend.min.js` (~30KB)
- GOV.UK fonts and images (~50KB)

**Inline Strategy**:
1. Inline CSS in `<head>` for render-blocking content
2. Inline JavaScript before `</body>` for progressive enhancement
3. Inline images as encountered in HTML and CSS

**Future Optimizations**:
- Compress CSS/JS with native Node.js (Brotli/Gzip)
- Remove unused CSS (PurgeCSS/PurifyCSS)
- Optimize images before inlining (Sharp library)
- Implement size budget alerts at 80% of 5MB (4MB warning threshold)
