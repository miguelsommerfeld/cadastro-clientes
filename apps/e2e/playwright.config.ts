import { defineConfig } from '@playwright/test'

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:18080'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-1280x800',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-360x640',
      use: { browserName: 'chromium', viewport: { width: 360, height: 640 } },
    },
    {
      name: 'mobile-390x844',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
  ],
})
