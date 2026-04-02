import { defineConfig, devices } from '@playwright/test';

const isFullStack = process.env.FULL_STACK === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: isFullStack ? 60000 : 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // When full-stack mode is active (Docker or external server), don't start local server
  webServer: isFullStack
    ? undefined
    : {
        command: 'npx vite preview --port 4173',
        port: 4173,
        reuseExistingServer: false,
      },
});
