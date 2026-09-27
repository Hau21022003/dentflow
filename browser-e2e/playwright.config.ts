import { defineConfig } from "@playwright/test";
import { browserRuntimeConfig } from "./playwright.shared";

export default defineConfig({
  ...browserRuntimeConfig,
  testDir: "./tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    ...browserRuntimeConfig.use,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
