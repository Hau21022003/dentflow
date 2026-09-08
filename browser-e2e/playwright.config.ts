import { defineConfig, devices } from "@playwright/test";
import { E2E_TENANT_INVITATION_TOKEN_SECRET } from "./tests/support/tenant-invitation";

const apiUrl = "http://127.0.0.1:3001";
const frontendUrl = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run migration:test:run && npm run start:test",
      cwd: "../backend",
      url: apiUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        APP_URL: apiUrl,
        FRONTEND_ORIGIN: frontendUrl,
        AUDIT_IP_HMAC_SECRET: "secret",
        IDEMPOTENCY_HMAC_SECRET: "idempotency-test-secret",
        TENANT_INVITATION_TOKEN_SECRET: E2E_TENANT_INVITATION_TOKEN_SECRET,
        PORT: "3001",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      cwd: "../client",
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_ENDPOINT: apiUrl,
      },
    },
  ],
});
