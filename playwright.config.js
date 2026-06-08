const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'logic', testMatch: /logic\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'api', testMatch: /api\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop', testMatch: /e2e\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: /e2e\//, use: { ...devices['Pixel 5'] } },
  ],
})
