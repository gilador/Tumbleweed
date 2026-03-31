import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ...(process.env.CI ? [["github"]] : [])],
  use: {
    baseURL: "http://localhost:5273",
    trace: "on-first-retry",
    headless: !process.env.HEADED,
    launchOptions: {
      slowMo: parseInt(process.env.SLOW_MO || "0"),
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5273",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      testMatch: /mobile-.+\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
