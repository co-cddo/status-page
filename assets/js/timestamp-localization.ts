/**
 * Timestamp Localization Module
 *
 * Progressive enhancement for displaying timestamps in browser local timezone
 * with relative time indicators and UTC tooltips.
 *
 * Requirements:
 * - Issue #30: Localized timestamp display
 * - Progressive enhancement (works without JS)
 * - WCAG 2.2 AAA accessible
 * - Self-contained (will be inlined by post-build script)
 *
 * Features:
 * 1. Convert ISO 8601 UTC timestamps to browser local timezone
 * 2. Display relative time ("5 minutes ago") with realtime updates
 * 3. Show original UTC time as tooltip on hover
 * 4. Add visual indicator for auto-refresh
 */

/**
 * Format ISO 8601 UTC timestamp to localized date/time string
 */
export function formatLocalTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    // Use browser's locale and timezone
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return timestamp;
  }
}

/**
 * Format timestamp as relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    const now = Date.now();
    const diff = now - date.getTime();

    // Handle future dates (shouldn't happen, but be defensive)
    if (diff < 0) return 'just now';

    // Just now (< 30 seconds)
    if (diff < 30000) return 'just now';

    // Seconds ago (30-60 seconds)
    if (diff < 60000) {
      const seconds = Math.floor(diff / 1000);
      return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} ago`;
    }

    // Minutes ago (1-60 minutes)
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    // Hours ago (1-24 hours)
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }

    // Days ago (1-7 days)
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }

    // Older than 7 days: show formatted date
    return formatLocalTimestamp(timestamp);
  } catch {
    return timestamp;
  }
}

/**
 * Get formatted UTC string for tooltip
 */
export function getOriginalUTCString(timestamp: string | null | undefined): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    // Format as UTC string with "UTC" label for clarity
    return `${date.toUTCString()} (UTC)`;
  } catch {
    return timestamp;
  }
}

/**
 * Update a single <time> element with localized timestamp and tooltip
 */
export function updateTimestamp(element: HTMLTimeElement): void {
  const datetime = element.getAttribute('datetime');
  if (!datetime) return;

  try {
    // Update visible text to local timezone
    const localTime = formatLocalTimestamp(datetime);
    if (localTime && localTime !== datetime) {
      element.textContent = localTime;
    }

    // Add UTC time as tooltip
    const utcString = getOriginalUTCString(datetime);
    if (utcString) {
      element.setAttribute('title', `UTC: ${utcString}`);
    }
  } catch (error) {
    console.warn('Failed to update timestamp:', error);
  }
}

/**
 * Add relative time indicator after timestamp element
 */
export function addRelativeTime(element: HTMLTimeElement): void {
  const datetime = element.getAttribute('datetime');
  if (!datetime) return;

  try {
    // Create relative time element
    const relativeElement = document.createElement('span');
    relativeElement.className = 'govuk-body-s govuk-!-margin-left-2';
    relativeElement.setAttribute('data-relative-time', datetime);
    relativeElement.setAttribute('aria-live', 'polite');

    // Set initial relative time
    const relativeTime = formatRelativeTime(datetime);
    relativeElement.textContent = `(${relativeTime})`;
    relativeElement.setAttribute('aria-label', `Updated ${relativeTime}`);

    // Insert after the timestamp
    if (element.nextSibling) {
      element.parentNode?.insertBefore(relativeElement, element.nextSibling);
    } else {
      element.parentNode?.appendChild(relativeElement);
    }

    // Mark for periodic updates
    element.setAttribute('data-update-relative-time', 'true');
  } catch (error) {
    console.warn('Failed to add relative time:', error);
  }
}

/**
 * Update all relative time indicators
 * Optimized to only update when text changes
 */
function updateAllRelativeTimes(): void {
  const relativeElements = document.querySelectorAll('[data-relative-time]');

  relativeElements.forEach((element) => {
    const datetime = element.getAttribute('data-relative-time');
    if (!datetime) return;

    const newRelativeTime = formatRelativeTime(datetime);
    const newText = `(${newRelativeTime})`;
    const currentText = element.textContent;

    // Only update if text actually changes (performance optimization)
    if (currentText !== newText) {
      element.textContent = newText;
      element.setAttribute('aria-label', `Updated ${newRelativeTime}`);
    }
  });
}

/**
 * Add auto-refresh indicator to page
 */
function addAutoRefreshIndicator(): void {
  // Find the meta refresh tag to get the interval
  const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
  const refreshInterval = metaRefresh
    ? parseInt(metaRefresh.getAttribute('content') || '60', 10)
    : 60;

  // Create indicator element
  const indicator = document.createElement('div');
  indicator.className = 'govuk-body-s govuk-!-margin-top-4 govuk-!-text-align-right';
  indicator.setAttribute('data-auto-refresh-indicator', 'true');
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');

  const icon = document.createElement('span');
  icon.textContent = '🔄 ';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = `Page auto-refreshes every ${refreshInterval} seconds`;

  indicator.appendChild(icon);
  indicator.appendChild(text);

  // Insert at the top of main content
  const mainContent = document.getElementById('main-content');
  if (mainContent && mainContent.firstChild) {
    mainContent.insertBefore(indicator, mainContent.firstChild);
  }
}

// Store interval reference for cleanup
let updateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize timestamp localization
 * Called when DOM is ready
 */
function initTimestampLocalization(): void {
  try {
    // Find all <time> elements with datetime attribute
    const timestamps = document.querySelectorAll('time[datetime]');

    timestamps.forEach((element) => {
      const timeElement = element as HTMLTimeElement;

      // Update to local timezone
      updateTimestamp(timeElement);

      // Add relative time for recent timestamps (within last 24 hours)
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        const date = new Date(datetime);
        const now = Date.now();
        const diff = now - date.getTime();

        // Only add relative time for recent timestamps
        if (diff >= 0 && diff < 86400000) {
          addRelativeTime(timeElement);
        }
      }
    });

    // Add auto-refresh indicator
    addAutoRefreshIndicator();

    // Clear any existing interval to prevent memory leaks
    if (updateInterval) {
      clearInterval(updateInterval);
    }

    // Update relative times every 10 seconds
    updateInterval = setInterval(updateAllRelativeTimes, 10000);

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    });

    console.log(`✓ Timestamp localization initialized for ${timestamps.length} timestamps`);
  } catch (error) {
    console.error('Failed to initialize timestamp localization:', error);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimestampLocalization);
} else {
  // DOM already loaded
  initTimestampLocalization();
}
