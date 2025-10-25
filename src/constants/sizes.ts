/**
 * Size limit constants for assets and data processing
 * All values in bytes unless otherwise specified
 */

export const SIZE_LIMITS = {
  /**
   * Maximum allowed size for self-contained HTML output (5 MB)
   * Target limit per spec.md FR-030
   */
  HTML_MAX: 5 * 1024 * 1024, // 5 MB

  /**
   * Warning threshold for CSS file size (500 KB)
   * Used in: inlining/size-validator.ts
   */
  CSS_WARNING: 500 * 1024, // 500 KB

  /**
   * Warning threshold for JavaScript file size (500 KB)
   * Used in: inlining/size-validator.ts
   */
  JS_WARNING: 500 * 1024, // 500 KB

  /**
   * Warning threshold for HTML file size before inlining (200 KB)
   * Used in: inlining/size-validator.ts
   */
  HTML_WARNING: 200 * 1024, // 200 KB

  /**
   * Warning threshold for individual image file size (2 MB)
   * Used in: inlining/size-validator.ts
   */
  IMAGE_WARNING: 2 * 1024 * 1024, // 2 MB

  /**
   * Maximum response body text to read for validation (100 KB)
   * Per spec.md FR-014
   */
  MAX_RESPONSE_TEXT: 100 * 1024, // 100 KB
} as const;
