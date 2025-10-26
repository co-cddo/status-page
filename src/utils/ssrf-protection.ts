/**
 * SSRF (Server-Side Request Forgery) Protection Utilities
 *
 * Prevents health checks from accessing internal network resources,
 * cloud metadata endpoints, and other potentially dangerous URLs.
 *
 * Blocked Targets:
 * - Private IP ranges (RFC 1918): 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Localhost: 127.0.0.0/8, ::1
 * - Link-local addresses: 169.254.0.0/16
 * - Cloud metadata endpoints (AWS, GCP, Azure)
 * - Non-HTTP/HTTPS protocols
 */

/**
 * Validates a URL to prevent SSRF attacks
 * @param url The URL to validate
 * @param options Validation options
 * @param options.skipValidation If true, skip SSRF validation (for testing only)
 * @throws Error if URL is blocked for security reasons
 */
export function validateUrlForSSRF(url: string, options?: { skipValidation?: boolean }): void {
  // Allow tests to bypass validation
  if (options?.skipValidation || process.env.NODE_ENV === 'test') {
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }

  // Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Blocked: Only HTTP/HTTPS protocols allowed, got ${parsed.protocol} in URL: ${url}`
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Strip IPv6 brackets if present (e.g., '[::1]' -> '::1')
  // Node.js URL parser keeps brackets in hostname for IPv6 addresses
  const cleanedHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // Block localhost variants
  if (
    cleanedHostname === 'localhost' ||
    cleanedHostname === '127.0.0.1' ||
    cleanedHostname === '::1' ||
    cleanedHostname === '0.0.0.0' ||
    cleanedHostname === '::' ||
    cleanedHostname.startsWith('127.') ||
    cleanedHostname.startsWith('0.')
  ) {
    throw new Error(`Blocked: Localhost access not allowed: ${url}`);
  }

  // Block link-local addresses (169.254.0.0/16 - AWS metadata service)
  if (cleanedHostname.startsWith('169.254.')) {
    throw new Error(`Blocked: Link-local address access not allowed: ${url}`);
  }

  // Block private IP ranges (RFC 1918)
  if (
    cleanedHostname.startsWith('10.') || // 10.0.0.0/8
    cleanedHostname.startsWith('192.168.') || // 192.168.0.0/16
    isPrivateIPv4Range172(cleanedHostname) // 172.16.0.0/12
  ) {
    throw new Error(`Blocked: Private IP range access not allowed: ${url}`);
  }

  // Block IPv6 private/link-local ranges
  // IPv6 addresses use bracket notation in URLs, but cleanedHostname has brackets stripped
  // Check if it's an IPv6 address (contains colons)
  if (cleanedHostname.includes(':')) {
    // fc00::/7 - Unique local addresses (includes both fc and fd prefixes)
    // This covers fc00::/8 through fdff::/8
    if (cleanedHostname.startsWith('fc') || cleanedHostname.startsWith('fd')) {
      throw new Error(`Blocked: Private IPv6 address access not allowed: ${url}`);
    }

    // fe80::/10 - Link-local addresses
    // Covers fe80:: through febf::
    if (cleanedHostname.startsWith('fe8') || cleanedHostname.startsWith('fe9') ||
        cleanedHostname.startsWith('fea') || cleanedHostname.startsWith('feb')) {
      throw new Error(`Blocked: Private IPv6 address access not allowed: ${url}`);
    }
  }

  // Block common cloud metadata endpoints
  const blockedHostnames = [
    'metadata.google.internal', // GCP metadata
    'metadata', // Generic metadata hostname
    '100.100.100.200', // Alibaba Cloud
    'kubernetes.default.svc', // Kubernetes internal
    'consul', // Consul service discovery
  ];

  if (blockedHostnames.includes(cleanedHostname)) {
    throw new Error(`Blocked: Access to ${cleanedHostname} not allowed: ${url}`);
  }

  // Block wildcard DNS that might resolve to internal IPs
  if (cleanedHostname.endsWith('.internal') || cleanedHostname.endsWith('.local')) {
    throw new Error(`Blocked: Internal/local domain access not allowed: ${url}`);
  }
}

/**
 * Checks if hostname is in 172.16.0.0/12 range
 * Valid range: 172.16.0.0 to 172.31.255.255
 */
function isPrivateIPv4Range172(hostname: string): boolean {
  const parts = hostname.split('.');

  if (parts.length !== 4 || parts[0] !== '172' || !parts[1]) {
    return false;
  }

  const secondOctet = parseInt(parts[1], 10);

  // 172.16.0.0/12 means second octet from 16 to 31
  return secondOctet >= 16 && secondOctet <= 31;
}
