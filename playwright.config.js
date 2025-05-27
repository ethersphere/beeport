const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for wallet state consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for wallet tests
  reporter: 'html',
  timeout: 300000, // 5 minutes for real transactions
  expect: {
    timeout: 30000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'real-wallet-tests',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          headless: false,
          slowMo: 1000,
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions-except=*',
            '--load-extension=*',
          ],
        },
      },
    },
    {
      name: 'walletconnect-tests',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          headless: false,
          slowMo: 1000,
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
