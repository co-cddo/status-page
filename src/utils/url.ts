/**
 * URL and Path Utilities
 *
 * Provides safe URL parsing and path resolution utilities for asset inlining.
 * Includes security validation to prevent path traversal attacks.
 *
 * Task: Refactor shared utilities from inlining modules
 * Security: Implements path traversal protection
 */

import { resolve, relative, normalize } from 'path';

/**
 * Extract pathname from URL or return path as-is
 *
 * Handles transformation of absolute URLs to paths:
 * - http://localhost:8080/assets/file.css → /assets/file.css
 * - https://example.com/path/file.js → /path/file.js
 * - /absolute/path.css → /absolute/path.css (unchanged)
 * - relative/path.css → relative/path.css (unchanged)
 *
 * @param urlOrPath - URL string or file path
 * @returns The pathname component if URL, or original path
 *
 * @example
 * extractPathFromUrl('http://localhost:8080/assets/app.css')
 * // Returns: '/assets/app.css'
 *
 * @example
 * extractPathFromUrl('/assets/app.css')
 * // Returns: '/assets/app.css'
 */
export function extractPathFromUrl(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath);
    return url.pathname;
  } catch {
    // Not a valid URL, return as-is (it's already a path)
    return urlOrPath;
  }
}

/**
 * Check if a string is an absolute URL (http/https)
 *
 * @param str - String to check
 * @returns True if string starts with http:// or https://
 *
 * @example
 * isAbsoluteUrl('http://example.com/file.css')
 * // Returns: true
 */
export function isAbsoluteUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Check if a path is absolute (starts with /)
 *
 * @param path - Path to check
 * @returns True if path starts with /
 *
 * @example
 * isAbsolutePath('/assets/file.css')
 * // Returns: true
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/');
}

/**
 * Safely resolve a path ensuring it stays within boundaries
 *
 * Prevents path traversal attacks by validating that the resolved path
 * stays within the base directory or its subdirectories. Throws error if
 * path attempts to escape the boundary.
 *
 * @param basePath - Base directory path to resolve from
 * @param userPath - User-provided path to resolve (potentially untrusted)
 * @returns Safely resolved absolute path
 * @throws Error if resolved path escapes the base path or contains null bytes
 *
 * @example
 * // Safe path resolution
 * safeResolvePath('_site', 'assets/app.css')
 * // Returns: '/project/_site/assets/app.css'
 *
 * @example
 * // Blocked path traversal attempt
 * safeResolvePath('_site', '../../etc/passwd')
 * // Throws: Error('Path traversal attempt detected...')
 */
export function safeResolvePath(basePath: string, userPath: string): string {
  // Validate inputs
  if (!basePath || typeof basePath !== 'string') {
    throw new TypeError('basePath must be a non-empty string');
  }
  if (!userPath || typeof userPath !== 'string') {
    throw new TypeError('userPath must be a non-empty string');
  }

  // Check for null byte injection (directory traversal attack)
  if (userPath.includes('\0') || basePath.includes('\0')) {
    throw new Error(
      `Invalid path: null byte detected in path. This may indicate a security attack attempt.`
    );
  }

  // Normalize to prevent bypasses like /foo/../../../etc/passwd
  const normalizedUserPath = normalize(userPath);

  // Resolve the base path to absolute
  const absoluteBasePath = resolve(basePath);

  // Resolve the full path
  const resolved = resolve(absoluteBasePath, normalizedUserPath);

  // Calculate relative path from base
  const relativePath = relative(absoluteBasePath, resolved);

  // Check if path escapes the base directory
  // If relativePath starts with '..', it means resolved path is outside basePath
  if (relativePath.startsWith('..') || resolve(absoluteBasePath, relativePath) !== resolved) {
    throw new Error(
      `Path traversal attempt detected: "${userPath}" resolves to "${resolved}" which is outside the allowed directory "${absoluteBasePath}"`
    );
  }

  return resolved;
}
