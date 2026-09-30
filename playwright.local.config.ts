import { defineConfig, devices } from '@playwright/test';

/**
 * Local full-stack test run. Uses installed Microsoft Edge and the app started by
 * scripts/dev-local.ps1 (local Supabase only). Never point this at production.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
if (!/127\.0\.0\.1|localhost/.test(baseURL)) {
  throw new Error(`Refusing to run write tests against ${baseURL}`);
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/local-report.json' }]],
  use: {
    baseURL,
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
});
