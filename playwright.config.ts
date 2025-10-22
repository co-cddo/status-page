import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E and accessibility testing
 * Per constitution.md: WCAG 2.2 AAA compliance testing required
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Test patterns
  testMatch: ['**/e2e/**/*.spec.ts', '**/accessibility/**/*.spec.ts'],

  // Timeout per test (5 minutes for accessibility tests with axe-core)
  timeout: 300000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests (assumes local dev server running)
    baseURL: process.env.BASE_URL || 'http://localhost:8080',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time for each action (click, fill, etc.)
    actionTimeout: 30000,

    // Navigation timeout
    navigationTimeout: 60000,
  },

  // Configure projects for multiple browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports for responsive testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    // Accessibility testing (dedicated project)
    {
      name: 'accessibility',
      testMatch: '**/accessibility/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Slower for detailed axe-core analysis
        actionTimeout: 60000,
      },
    },
  ],

  // Web server for local development testing
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm run dev',
        url: 'http://localhost:8080',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
      },

  // Output directory for test results
  outputDir: 'test-results',
});
