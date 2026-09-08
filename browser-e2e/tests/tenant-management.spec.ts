import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
  await createPlanViaApi(request);
});

test("Platform Admin creates, updates, and runs tenant lifecycle commands in the browser", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/tenants");

  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Tenant management" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tenant management" })).toBeVisible();

  await page.getByRole("button", { name: "Create tenant" }).click();
  const dialog = page.getByRole("dialog", { name: "Create tenant" });
  await dialog.getByRole("button", { name: "Create tenant" }).click();
  await expect(dialog.getByText("Legal name is required.")).toBeVisible();

  await fillTenantForm(page, dialog);
  const createRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/platform/tenants"),
  );
  await dialog.getByRole("button", { name: "Create tenant" }).click();
  expect((await createRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]+$/i);
  await expect(page.getByRole("heading", { name: "Synthetic Browser Tenant" })).toBeVisible();
  await expect(page.getByText("Pending acceptance", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit tenant" });
  await expect(editDialog.getByLabel("Tenant slug")).toBeDisabled();
  await editDialog.getByLabel("Display name").fill("Synthetic Browser Plus");
  await editDialog.getByLabel("Contact phone").fill("+842811999999");
  const patchRequest = page.waitForRequest(
    (request) => request.method() === "PATCH" && /\/platform\/tenants\/[0-9a-f-]+$/i.test(request.url()),
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const patch = await patchRequest;
  expect(patch.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(patch.postDataJSON()).toEqual({
    contactPhone: "+842811999999",
    displayName: "Synthetic Browser Plus",
  });
  await expect(page.getByRole("heading", { name: "Synthetic Browser Plus" })).toBeVisible();

  await page.getByRole("button", { name: "Resend invitation" }).click();
  const resendDialog = page.getByRole("alertdialog", { name: "Resend owner invitation" });
  const resendRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/resend-owner-invite"),
  );
  await resendDialog.getByRole("button", { name: "Resend invitation" }).click();
  expect((await resendRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(resendDialog).toHaveCount(0);

  await page.getByRole("button", { name: "Extend trial" }).click();
  const extendDialog = page.getByRole("alertdialog", { name: "Extend trial" });
  await extendDialog.getByRole("button", { name: "Extend trial" }).click();
  await expect(extendDialog.getByText("Enter a reason for this action.")).toBeVisible();
  await extendDialog.getByLabel("Trial days").fill("3");
  await extendDialog.getByLabel("Reason").fill("Synthetic browser extension");
  const extendRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/extend-trial"),
  );
  await extendDialog.getByRole("button", { name: "Extend trial" }).click();
  expect((await extendRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(extendDialog).toHaveCount(0);

  await page.getByRole("button", { name: "Suspend tenant" }).click();
  const suspendDialog = page.getByRole("alertdialog", { name: "Suspend tenant" });
  await suspendDialog.getByLabel("Reason").fill("Synthetic policy review");
  const suspendRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/suspend"),
  );
  await suspendDialog.getByRole("button", { name: "Suspend tenant" }).click();
  expect((await suspendRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(page.getByText("Suspended", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reactivate tenant" }).click();
  const reactivateDialog = page.getByRole("alertdialog", { name: "Reactivate tenant" });
  await reactivateDialog.getByLabel("Reason").fill("Synthetic review complete");
  const reactivateRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/reactivate"),
  );
  await reactivateDialog.getByRole("button", { name: "Reactivate tenant" }).click();
  expect((await reactivateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(page.getByText("Trial", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back to tenant catalog" }).click();
  const search = page.getByPlaceholder("Search...");
  await search.fill("Synthetic Browser Plus");
  await expect(page.getByText("Synthetic Browser Plus", { exact: true })).toBeVisible();
});

test("Tenant Admin cannot open Platform tenant catalog or a tenant detail deep link", async ({
  page,
  request,
}) => {
  const tenantId = await createTenantViaApi(request);
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto("/platform/tenants");
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();

  await page.goto(`/platform/tenants/${tenantId}`);
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function fillTenantForm(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
): Promise<void> {
  await dialog.getByLabel("Legal name").fill("Synthetic Browser Dental LLC");
  await dialog.getByLabel("Display name").fill("Synthetic Browser Tenant");
  await dialog.getByLabel("Tenant slug").fill("synthetic-browser-tenant");
  await dialog.getByLabel("Billing email").fill("billing@synthetic-browser.test");
  await dialog.getByLabel("Tenant Admin name").fill("Synthetic Browser Owner");
  await dialog.getByLabel("Tenant Admin email").fill("owner@synthetic-browser.test");
  await dialog.getByRole("combobox", { name: "Subscription plan" }).click();
  await page.getByRole("option", { name: "Tenant E2E Monthly · tenant-e2e-monthly" }).click();
}

async function createPlanViaApi(request: APIRequestContext): Promise<void> {
  const loginResponse = await request.post(`${API_URL}/auth/login`, { data: E2E_USERS.platformAdmin });
  await expect(loginResponse).toBeOK();
  const response = await request.post(`${API_URL}/platform/plans`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      amount: 250000,
      billingInterval: "MONTHLY",
      code: "tenant-e2e-monthly",
      currency: "VND",
      entitlements: { analytics: false, maxBranches: 3, maxUsers: 20 },
      name: "Tenant E2E Monthly",
      trialDays: 14,
    },
  });
  await expect(response).toBeOK();
}

async function createTenantViaApi(request: APIRequestContext): Promise<string> {
  const planResponse = await request.get(`${API_URL}/platform/plans`);
  await expect(planResponse).toBeOK();
  const plans = (await planResponse.json()) as Array<{ id: string; code: string }>;
  const plan = plans.find((entry) => entry.code === "tenant-e2e-monthly");
  if (!plan) throw new Error("Expected synthetic tenant test plan.");

  const response = await request.post(`${API_URL}/platform/tenants`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      billingEmail: "detail@synthetic-browser.test",
      defaultLocale: "vi",
      defaultTimezone: "Asia/Ho_Chi_Minh",
      displayName: "Synthetic Detail Tenant",
      legalName: "Synthetic Detail Tenant LLC",
      ownerEmail: "detail-owner@synthetic-browser.test",
      ownerFullName: "Synthetic Detail Owner",
      planId: plan.id,
      slug: "synthetic-detail-tenant",
    },
  });
  await expect(response).toBeOK();
  return (await response.json() as { id: string }).id;
}
