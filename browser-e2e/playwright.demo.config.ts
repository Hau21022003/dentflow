import { defineConfig } from "@playwright/test";
import { browserRuntimeConfig } from "./playwright.shared";

/**
 * Intentionally isolated from playwright.config.ts: `npm run test` can never
 * discover demo files or overwrite their video/report artifacts.
 */
export default defineConfig({
  ...browserRuntimeConfig,
  testDir: "./demo",
  forbidOnly: true,
  retries: 0,
  outputDir: "demo-results",
  reporter: [["html", { outputFolder: "demo-report", open: "never" }], ["list"]],
  use: {
    ...browserRuntimeConfig.use,
    video: "on",
    trace: "on",
    screenshot: "on",
  },
});
