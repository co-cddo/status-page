/**
 * Timestamp Localization Module
 *
 * Progressive enhancement for timestamp display:
 * - Converts UTC timestamps to local timezone
 * - Shows relative time ("X minutes ago")
 * - Updates in real-time
 * - Provides UTC tooltip on hover
 * - Works without JavaScript (degrades gracefully to UTC display)
 *
 * Requirements:
 * - Issue #30: Localized timestamps with hover tooltips
 * - WCAG 2.2 AAA compliance
 * - Progressive enhancement
 * - No external dependencies
 */

/**
 * Format a timestamp as localized date and time
 * @param {Date} date - The date to format
 * @param {string} locale - The locale to use (defaults to browser locale)
 * @returns {string} Formatted localized date and time
 */
export function formatLocalizedDateTime(date, locale = navigator.language) {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
    return formatter.format(date);
  } catch (error) {
    // Fallback to ISO string if formatting fails
    console.error('Error formatting date:', error);
    return date.toISOString();
  }
}

/**
 * Calculate relative time from now
 * @param {Date} date - The date to compare
 * @returns {string} Relative time string (e.g., "5 minutes ago", "just now")
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Handle future dates
  if (diffSeconds < 0) {
    return 'in the future';
  }

  // Just now (less than 10 seconds ago)
  if (diffSeconds < 10) {
    return 'just now';
  }

  // Seconds ago (10-59 seconds)
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  // Minutes ago (1-59 minutes)
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  // Hours ago (1-23 hours)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  // Days ago (1-6 days)
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  // Weeks ago (7+ days)
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }

  // Months ago (4+ weeks)
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  // Years ago (12+ months)
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

/**
 * Enhance a single timestamp element
 * @param {HTMLTimeElement} timeElement - The time element to enhance
 */
export function enhanceTimestamp(timeElement) {
  // Get UTC timestamp from datetime attribute
  const utcTimestamp = timeElement.getAttribute('datetime');
  if (!utcTimestamp) {
    console.warn('Time element missing datetime attribute:', timeElement);
    return;
  }

  // Parse UTC timestamp
  const date = new Date(utcTimestamp);
  if (isNaN(date.getTime())) {
    console.warn('Invalid datetime value:', utcTimestamp);
    return;
  }

  // Store original UTC text for tooltip
  const originalUtcText = timeElement.textContent || utcTimestamp;

  // Format localized time
  const localizedTime = formatLocalizedDateTime(date);
  const relativeTime = formatRelativeTime(date);

  // Update element content with localized time and relative time
  timeElement.innerHTML = `
    <span class="timestamp-localized" aria-label="${localizedTime}, ${relativeTime}">
      ${localizedTime}
    </span>
    <span class="timestamp-relative" aria-live="polite">
      (${relativeTime})
    </span>
  `;

  // Add tooltip showing original UTC time on hover
  timeElement.setAttribute('title', `UTC: ${originalUtcText}`);

  // Store date for real-time updates
  timeElement.dataset.timestamp = date.toISOString();

  // Mark as enhanced to avoid double processing
  timeElement.dataset.enhanced = 'true';
}

/**
 * Update relative times for all enhanced timestamps
 * Called periodically to keep "X ago" displays current
 */
export function updateRelativeTimes() {
  const enhancedTimestamps = document.querySelectorAll('time[data-enhanced="true"]');

  enhancedTimestamps.forEach((timeElement) => {
    const isoTimestamp = timeElement.dataset.timestamp;
    if (!isoTimestamp) return;

    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return;

    // Update only the relative time span (keep localized time unchanged)
    const relativeSpan = timeElement.querySelector('.timestamp-relative');
    if (relativeSpan) {
      const newRelativeTime = formatRelativeTime(date);
      relativeSpan.textContent = `(${newRelativeTime})`;
    }
  });
}

/**
 * Initialize timestamp localization
 * Enhances all <time> elements with datetime attributes
 * Sets up real-time updates every 10 seconds
 */
export function initializeTimestampLocalization() {
  // Find all time elements with datetime attributes
  const timeElements = document.querySelectorAll('time[datetime]');

  if (timeElements.length === 0) {
    console.info('No timestamps found to enhance');
    return;
  }

  console.info(`Enhancing ${timeElements.length} timestamps`);

  // Enhance each timestamp
  timeElements.forEach((timeElement) => {
    // Skip already enhanced elements
    if (timeElement.dataset.enhanced === 'true') {
      return;
    }
    enhanceTimestamp(timeElement);
  });

  // Update relative times every 10 seconds
  setInterval(updateRelativeTimes, 10000);

  console.info('Timestamp localization initialized');
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimestampLocalization);
  } else {
    // DOM already loaded
    initializeTimestampLocalization();
  }
}
