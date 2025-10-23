/**
 * String manipulation utilities for formatting and sanitization
 */

/**
 * Escape special Markdown characters in text to prevent rendering issues
 * @param text - Text to escape
 * @returns Escaped text safe for Markdown tables
 * @example
 * ```typescript
 * escapeMarkdown('Service | Name') // Returns: 'Service \\| Name'
 * ```
 */
export function escapeMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/\|/g, '\\|')   // Pipe (table delimiter)
    .replace(/\*/g, '\\*')   // Asterisk (bold/italic)
    .replace(/_/g, '\\_')    // Underscore (italic)
    .replace(/`/g, '\\`')    // Backtick (code)
    .replace(/\[/g, '\\[')   // Opening bracket (link)
    .replace(/\]/g, '\\]');  // Closing bracket (link)
}

/**
 * Truncate long text to max length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text
 * @example
 * ```typescript
 * truncate('A very long error message...', 20) // Returns: 'A very long error...'
 * ```
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}
