/**
 * CSV parsing and escaping utilities
 * RFC 4180 compliant implementation for reuse across storage modules
 */

/**
 * Parses a CSV line handling RFC 4180 quoted values
 * Handles commas, quotes, and newlines within quoted fields
 *
 * @param line CSV line to parse
 * @returns Array of field values
 */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Double quote - add single quote to value
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add final value
  values.push(current);

  return values;
}

/**
 * Escapes a CSV value per RFC 4180
 * - Wraps in quotes if value contains comma, quote, or newline
 * - Doubles any quotes within the value
 *
 * @param value Value to escape
 * @returns Escaped CSV value
 */
export function escapeCsvValue(value: string): string {
  // Empty values don't need escaping
  if (!value) {
    return '';
  }

  // Check if escaping is needed (comma, quote, newline, or carriage return)
  const needsQuoting = /[,"\r\n]/.test(value);

  if (!needsQuoting) {
    return value;
  }

  // Double any existing quotes and wrap in quotes
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Type predicate for valid CSV status values
 *
 * @param status Status string to validate
 * @returns true if status is valid PASS/DEGRADED/FAIL
 */
export function isValidStatus(status: string): status is 'PASS' | 'DEGRADED' | 'FAIL' {
  return ['PASS', 'DEGRADED', 'FAIL'].includes(status);
}

/**
 * CSV column headers for historical health check data
 */
export const CSV_HEADERS = [
  'timestamp',
  'service_name',
  'status',
  'latency_ms',
  'http_status_code',
  'failure_reason',
  'correlation_id',
] as const;

/**
 * CSV header line with newline
 */
export const CSV_HEADER_LINE = CSV_HEADERS.join(',') + '\n';
