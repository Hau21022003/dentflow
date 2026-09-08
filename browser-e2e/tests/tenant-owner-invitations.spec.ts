import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login, submitLogin } from "./support/login";
import { E2E_TENANT_INVITATION_TOKEN_SECRET } from "./support/tenant-invitation";

const API_URL = "http://127.0.0.1:3001";

type PendingInvitationTenant = {
  id: string;
  slug: string;
  owner: {
    state: "PENDING";
    invitation: {
      id: string;
      expiresAt: string;
    };
  };
};

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
  await createPlanViaApi(request);
});

test("new owner activates an invitation, then signs in to its tenant workspace", async ({
  page,
  request,
}) => {
  const tenant = await createPendingTenant(request, {
    slug: "owner-invitation-new",
    ownerEmail: "new-owner@owner-invitation.test",
  });
  const token = invitationToken(tenant, "new-owner@owner-invitation.test");

  await page.goto(`/accept-tenant-owner-invitation?token=${encodeURIComponent(token)}`);
  await switchToEnglish(page);
  await expect(page.getByRole("heading", { name: "Activate your Tenant Admin account" })).toBeVisible();

  await page.getByRole("button", { name: "Activate account" }).click();
  await expect(page.getByText("Full name is required.")).toBeVisible();

  await page.getByLabel("Full name").fill("Synthetic Invited Owner");
  await page.getByLabel("Password").fill("synthetic-owner-password");
  const acceptRequest = page.waitForRequest(
    (entry) =>
      entry.method() === "POST" &&
      entry.url().endsWith("/auth/tenant-owner-invitations/accept"),
  );
  await page.getByRole("button", { name: "Activate account" }).click();
  expect((await acceptRequest).postDataJSON()).toEqual({
    token,
    fullName: "Synthetic Invited Owner",
    password: "synthetic-owner-password",
  });

  await expect(page).toHaveURL(/\/login$/);
  await submitLogin(page, {
    email: "new-owner@owner-invitation.test",
    password: "synthetic-owner-password",
  });
  await expect(page).toHaveURL(/\/workspace\/owner-invitation-new\/tenant$/);
});

test("an authenticated matching owner accepts an invitation and receives refreshed tenant access", async ({
  page,
  request,
}) => {
  const tenant = await createPendingTenant(request, {
    slug: "owner-invitation-existing",
    ownerEmail: E2E_USERS.tenantAdmin.email,
  });
  const token = invitationToken(tenant, E2E_USERS.tenantAdmin.email);

  await login(page, E2E_USERS.tenantAdmin);
  await page.goto(`/accept-tenant-owner-invitation?token=${encodeURIComponent(token)}`);
  await switchToEnglish(page);
  await expect(page.getByText(E2E_USERS.tenantAdmin.email, { exact: false })).toBeVisible();

  const acceptRequest = page.waitForRequest(
    (entry) =>
      entry.method() === "POST" &&
      entry.url().endsWith("/auth/tenant-owner-invitations/accept"),
  );
  await page.getByRole("button", { name: "Accept invitation" }).click();
  expect((await acceptRequest).postDataJSON()).toEqual({ token });
  await expect(page).toHaveURL(/\/workspace\/owner-invitation-existing\/tenant$/);
});

async function switchToEnglish(page: Page): Promise<void> {
  const switcher = page.getByRole("button", { name: /Chuyển sang tiếng Anh|Switch to English/ });
  if (await switcher.count()) await switcher.click();
}

async function createPlanViaApi(request: APIRequestContext): Promise<void> {
  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.platformAdmin,
  });
  await expect(loginResponse).toBeOK();

  const response = await request.post(`${API_URL}/platform/plans`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      amount: 250000,
      billingInterval: "MONTHLY",
      code: "owner-invitation-e2e-monthly",
      currency: "VND",
      entitlements: { analytics: false, maxBranches: 3, maxUsers: 20 },
      name: "Owner invitation E2E Monthly",
      trialDays: 14,
    },
  });
  await expect(response).toBeOK();
}

async function createPendingTenant(
  request: APIRequestContext,
  input: { slug: string; ownerEmail: string },
): Promise<PendingInvitationTenant> {
  const plansResponse = await request.get(`${API_URL}/platform/plans`);
  await expect(plansResponse).toBeOK();
  const plans = (await plansResponse.json()) as Array<{ id: string; code: string }>;
  const plan = plans.find((entry) => entry.code === "owner-invitation-e2e-monthly");
  if (!plan) throw new Error("Expected synthetic owner invitation test plan.");

  const response = await request.post(`${API_URL}/platform/tenants`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      billingEmail: `billing-${input.slug}@owner-invitation.test`,
      defaultLocale: "en",
      defaultTimezone: "Asia/Ho_Chi_Minh",
      displayName: `Synthetic ${input.slug}`,
      legalName: `Synthetic ${input.slug} LLC`,
      ownerEmail: input.ownerEmail,
      ownerFullName: "Synthetic Pending Owner",
      planId: plan.id,
      slug: input.slug,
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as PendingInvitationTenant;
}

function invitationToken(tenant: PendingInvitationTenant, ownerEmail: string): string {
  const invitation = tenant.owner.invitation;
  const payload = [
    "tenant-owner-invitation-v1",
    invitation.id,
    tenant.id,
    ownerEmail.toLowerCase(),
    new Date(invitation.expiresAt).toISOString(),
  ].join(":");
  const signature = createHmac("sha256", E2E_TENANT_INVITATION_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${invitation.id}.${signature}`;
}
