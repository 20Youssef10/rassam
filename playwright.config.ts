import { defineConfig, devices } from "@playwright/test";

/**
 * Rassam E2E harness.
 *
 * Requires the stack to be running:
 *   npm run start:storage   (:8080)
 *   npm run start:room      (:3002)
 *   npm run dev             (:3001)
 *
 * Uses the locally installed Google Chrome (channel: "chrome") so no browser
 * download is required. Set RASSAM_E2E_HEADED=1 for a visible browser.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e/artifacts/results.json" }],
    ["html", { outputFolder: "e2e/artifacts/html", open: "never" }],
  ],
  outputDir: "e2e/artifacts/test-results",
  use: {
    baseURL: process.env.RASSAM_E2E_BASE_URL || "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1440, height: 900 },
    locale: "ar-SA",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        headless: process.env.RASSAM_E2E_HEADED ? false : true,
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
