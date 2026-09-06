import { defineConfig } from '@playwright/test';

const managedWebServers = [
  {
    command: 'node tools/static-server.mjs apps/guest-web/dist',
    env: { STATIC_PORT: '4173' },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  {
    command: 'node tools/static-server.mjs apps/staff-web/dist',
    env: { STATIC_PORT: '4174' },
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
];

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './tests/e2e',
  timeout: 60_000,
  ...(process.env.PLAYWRIGHT_EXTERNAL_SERVERS === '1' ? {} : { webServer: managedWebServers }),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 851 },
        // Keep the narrow viewport for responsive QA without Chromium's
        // mobile meta-viewport scaling, which makes CSS coordinates diverge
        // from screenshot coordinates in the headless test environment.
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
});
