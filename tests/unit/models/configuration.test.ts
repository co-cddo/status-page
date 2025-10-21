/**
 * Unit tests for Configuration model
 */

import { describe, it, expect } from '@jest/globals';
import { getEffectiveSettings, DEFAULT_SETTINGS } from '../../../src/models/configuration.js';

describe('Configuration Model', () => {
  describe('getEffectiveSettings', () => {
    it('should return default settings when no user settings provided', () => {
      const settings = getEffectiveSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should merge user settings with defaults', () => {
      const userSettings = {
        check_interval: 120,
        warning_threshold: 3,
      };

      const settings = getEffectiveSettings(userSettings);

      expect(settings.check_interval).toBe(120);
      expect(settings.warning_threshold).toBe(3);
      expect(settings.timeout).toBe(DEFAULT_SETTINGS.timeout);
    });

    it('should allow overriding all settings', () => {
      const userSettings = {
        check_interval: 30,
        warning_threshold: 1,
        timeout: 10,
        page_refresh: 30,
        max_retries: 5,
        worker_pool_size: 4,
        history_file: 'custom.csv',
        output_dir: 'custom_site',
      };

      const settings = getEffectiveSettings(userSettings);

      expect(settings).toEqual(userSettings);
    });
  });
});
