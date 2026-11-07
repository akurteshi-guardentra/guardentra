import { defineConfig, devices } from '@playwright/test';
import { resolveTarget } from './lib/targets.mjs';

const target = resolveTarget();
const UA = 'GuardEntra-PostRelease-QA (Playwright)';

// The repo is public and CI artifacts can be downloaded by anyone signed in to
// GitHub. Traces and videos record typed values (passwords), so they stay off for
// every project. Screenshots are taken on failure only for the signed-out smoke suite.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: target.baseURL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'smoke',
      testDir: './tests/smoke',
      use: { ...devices['Desktop Chrome'], userAgent: UA, screenshot: 'only-on-failure' },
    },
    {
      name: 'regression',
      testDir: './tests/regression',
      use: { ...devices['Desktop Chrome'], userAgent: UA },
    },
  ],
});
