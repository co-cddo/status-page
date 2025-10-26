/**
 * Unit tests for URL and path utilities
 * Tests: src/utils/url.ts
 */

import { describe, it, expect } from 'vitest';
import {
  extractPathFromUrl,
  isAbsoluteUrl,
  isAbsolutePath,
  safeResolvePath,
} from '@/utils/url.js';
import { resolve } from 'path';

describe('extractPathFromUrl', () => {
  it('should extract pathname from HTTP URL', () => {
    const result = extractPathFromUrl('http://localhost:8080/assets/file.css');
    expect(result).toBe('/assets/file.css');
  });

  it('should extract pathname from HTTPS URL', () => {
    const result = extractPathFromUrl('https://example.com/path/file.js');
    expect(result).toBe('/path/file.js');
  });

  it('should extract pathname from URL with query string', () => {
    const result = extractPathFromUrl('https://example.com/file.css?v=123');
    expect(result).toBe('/file.css');
  });

  it('should extract pathname from URL with hash', () => {
    const result = extractPathFromUrl('https://example.com/file.css#section');
    expect(result).toBe('/file.css');
  });

  it('should return absolute path unchanged', () => {
    const result = extractPathFromUrl('/absolute/path.css');
    expect(result).toBe('/absolute/path.css');
  });

  it('should return relative path unchanged', () => {
    const result = extractPathFromUrl('relative/path.css');
    expect(result).toBe('relative/path.css');
  });

  it('should return empty string unchanged', () => {
    const result = extractPathFromUrl('');
    expect(result).toBe('');
  });

  it('should return path with special characters unchanged', () => {
    const result = extractPathFromUrl('./assets/file with spaces.css');
    expect(result).toBe('./assets/file with spaces.css');
  });
});

describe('isAbsoluteUrl', () => {
  it('should return true for HTTP URLs', () => {
    expect(isAbsoluteUrl('http://example.com/file.css')).toBe(true);
  });

  it('should return true for HTTPS URLs', () => {
    expect(isAbsoluteUrl('https://example.com/file.css')).toBe(true);
  });

  it('should return false for absolute paths', () => {
    expect(isAbsoluteUrl('/absolute/path.css')).toBe(false);
  });

  it('should return false for relative paths', () => {
    expect(isAbsoluteUrl('relative/path.css')).toBe(false);
  });

  it('should return false for protocol-relative URLs', () => {
    expect(isAbsoluteUrl('//example.com/file.css')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isAbsoluteUrl('')).toBe(false);
  });

  it('should return false for FTP URLs', () => {
    expect(isAbsoluteUrl('ftp://example.com/file.css')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isAbsoluteUrl('HTTP://example.com/file.css')).toBe(false);
    expect(isAbsoluteUrl('HTTPS://example.com/file.css')).toBe(false);
  });
});

describe('isAbsolutePath', () => {
  it('should return true for absolute paths', () => {
    expect(isAbsolutePath('/absolute/path.css')).toBe(true);
  });

  it('should return true for root path', () => {
    expect(isAbsolutePath('/')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(isAbsolutePath('relative/path.css')).toBe(false);
  });

  it('should return false for current directory paths', () => {
    expect(isAbsolutePath('./file.css')).toBe(false);
  });

  it('should return false for parent directory paths', () => {
    expect(isAbsolutePath('../file.css')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isAbsolutePath('')).toBe(false);
  });

  it('should return false for Windows-style paths', () => {
    expect(isAbsolutePath('C:\\absolute\\path.css')).toBe(false);
  });
});

describe('safeResolvePath', () => {
  describe('Valid path resolutions', () => {
    it('should resolve simple path within base directory', () => {
      const result = safeResolvePath('_site', 'assets/app.css');
      expect(result).toBe(resolve('_site/assets/app.css'));
    });

    it('should resolve nested path within base directory', () => {
      const result = safeResolvePath('_site', 'assets/css/main.css');
      expect(result).toBe(resolve('_site/assets/css/main.css'));
    });

    it('should resolve path with current directory reference', () => {
      const result = safeResolvePath('_site', './assets/app.css');
      expect(result).toBe(resolve('_site/assets/app.css'));
    });

    it('should resolve absolute base path correctly', () => {
      const result = safeResolvePath('/var/www/site', 'assets/app.css');
      expect(result).toBe('/var/www/site/assets/app.css');
    });

    it('should resolve path with parent reference staying within base', () => {
      const result = safeResolvePath('_site', 'assets/../css/app.css');
      expect(result).toBe(resolve('_site/css/app.css'));
    });
  });

  describe('Path traversal attack prevention', () => {
    it('should block simple parent directory traversal', () => {
      expect(() => safeResolvePath('_site', '../../etc/passwd')).toThrow(
        /Path traversal attempt detected/
      );
    });

    it('should block complex parent directory traversal', () => {
      expect(() => safeResolvePath('_site', '../../../etc/passwd')).toThrow(
        /Path traversal attempt detected/
      );
    });

    it('should block traversal with mixed path separators', () => {
      expect(() => safeResolvePath('_site', 'assets/../../etc/passwd')).toThrow(
        /Path traversal attempt detected/
      );
    });

    it('should block absolute path escape', () => {
      expect(() => safeResolvePath('_site', '/etc/passwd')).toThrow(
        /Path traversal attempt detected/
      );
    });

    it('should provide detailed error message with paths', () => {
      expect(() => safeResolvePath('_site', '../../etc/passwd')).toThrow(
        /"..\/..\/etc\/passwd"/
      );
    });
  });

  describe('Null byte injection prevention', () => {
    it('should block null byte in user path', () => {
      expect(() => safeResolvePath('_site', 'assets/file.css\0.txt')).toThrow(
        /Invalid path: null byte detected/
      );
    });

    it('should block null byte in base path', () => {
      expect(() => safeResolvePath('_site\0', 'assets/file.css')).toThrow(
        /Invalid path: null byte detected/
      );
    });

    it('should block null byte in middle of path', () => {
      expect(() => safeResolvePath('_site', 'assets\0/file.css')).toThrow(
        /Invalid path: null byte detected/
      );
    });

    it('should provide security warning in error message', () => {
      expect(() => safeResolvePath('_site', 'file\0.css')).toThrow(/security attack attempt/);
    });
  });

  describe('Input validation', () => {
    it('should reject empty basePath', () => {
      expect(() => safeResolvePath('', 'assets/file.css')).toThrow(
        /basePath must be a non-empty string/
      );
    });

    it('should reject non-string basePath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath(null, 'assets/file.css')).toThrow(/basePath must be/);
    });

    it('should reject undefined basePath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath(undefined, 'assets/file.css')).toThrow(/basePath must be/);
    });

    it('should reject empty userPath', () => {
      expect(() => safeResolvePath('_site', '')).toThrow(/userPath must be a non-empty string/);
    });

    it('should reject non-string userPath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath('_site', null)).toThrow(/userPath must be/);
    });

    it('should reject undefined userPath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath('_site', undefined)).toThrow(/userPath must be/);
    });

    it('should reject numeric basePath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath(123, 'assets/file.css')).toThrow(/basePath must be/);
    });

    it('should reject numeric userPath', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => safeResolvePath('_site', 456)).toThrow(/userPath must be/);
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with special characters', () => {
      const result = safeResolvePath('_site', 'assets/file with spaces.css');
      expect(result).toBe(resolve('_site/assets/file with spaces.css'));
    });

    it('should handle paths with Unicode characters', () => {
      const result = safeResolvePath('_site', 'assets/文件.css');
      expect(result).toBe(resolve('_site/assets/文件.css'));
    });

    it('should handle paths with dots in filename', () => {
      const result = safeResolvePath('_site', 'assets/file.min.css');
      expect(result).toBe(resolve('_site/assets/file.min.css'));
    });

    it('should handle paths with hyphens and underscores', () => {
      const result = safeResolvePath('_site', 'assets/main-app_style.css');
      expect(result).toBe(resolve('_site/assets/main-app_style.css'));
    });

    it('should handle deeply nested paths', () => {
      const result = safeResolvePath('_site', 'a/b/c/d/e/f/file.css');
      expect(result).toBe(resolve('_site/a/b/c/d/e/f/file.css'));
    });

    it('should handle base path with trailing slash', () => {
      const result = safeResolvePath('_site/', 'assets/file.css');
      expect(result).toBe(resolve('_site/assets/file.css'));
    });
  });
});
