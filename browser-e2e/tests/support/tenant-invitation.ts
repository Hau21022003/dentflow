/**
 * Test-only HMAC secret shared by the browser test process and its backend
 * web server. It intentionally overrides any value from backend/.env.test so
 * invitation capabilities are deterministic in local runs and CI.
 */
export const E2E_TENANT_INVITATION_TOKEN_SECRET =
  "browser-e2e-tenant-invitation-token-secret";
