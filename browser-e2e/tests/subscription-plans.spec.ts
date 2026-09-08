import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";

type CreatedPlan = {
  id: string;
  code: string;
  entitlements: Record<string, unknown>;
  isActive: boolean;
};

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Platform Admin can reach the plan catalog from navigation", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);

  await page.goto("/platform/plans");
  await expect(page).toHaveURL(/\/platform\/plans$/);
  await expect(
    page.getByRole("heading", { name: "Subscription plans" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Plan catalog" }),
  ).toBeVisible();
});

test("Tenant Admin is denied the plan catalog", async ({ page }) => {
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto("/platform/plans");
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

test("creates a plan, validates inputs, and keeps a duplicate API error visible", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/plans");

  await page.getByRole("button", { name: "Create plan" }).click();
  const dialog = page.getByRole("dialog", { name: "Create subscription plan" });
  await dialog.getByRole("button", { name: "Create plan" }).click();
  await expect(dialog.getByText("Plan code is required.")).toBeVisible();

  await fillPlanForm(dialog, {
    code: "growth-monthly",
    name: "Growth Monthly",
  });
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/platform/plans"),
  );
  await dialog.getByRole("button", { name: "Create plan" }).click();
  expect((await createRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Growth Monthly", { exact: true })).toBeVisible();
  await expect(page.getByText("growth-monthly", { exact: true })).toBeVisible();
  await expect(page.getByText(/250,000/)).toBeVisible();

  await page.getByRole("button", { name: "Create plan" }).click();
  const duplicateDialog = page.getByRole("dialog", {
    name: "Create subscription plan",
  });
  await fillPlanForm(duplicateDialog, {
    code: "growth-monthly",
    name: "Growth Monthly",
  });
  await duplicateDialog.getByRole("button", { name: "Create plan" }).click();
  await expect(
    duplicateDialog.getByText(
      "Subscription plan code or provider plan ID already exists.",
    ),
  ).toBeVisible();
});

test("edits an unused plan without changing code and preserves unsupported entitlements", async ({
  page,
  request,
}) => {
  const plan = await createPlanViaApi(request, {
    code: "legacy-monthly",
    entitlements: {
      analytics: true,
      legacyFeature: { enabled: true },
      maxBranches: 3,
      maxUsers: 20,
    },
    name: "Legacy Monthly",
    description: "Legacy description",
    providerPlanId: "price_legacy_monthly",
  });
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/plans");

  await page.getByRole("button", { name: "Edit Legacy Monthly" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit subscription plan" });
  await expect(dialog.getByLabel("Plan code")).toBeDisabled();
  await expect(dialog.getByText("Additional entitlements")).toBeVisible();
  await expect(dialog.getByText(/legacyFeature/)).toBeVisible();
  await dialog.getByLabel("Plan name").fill("Legacy Plus");
  await dialog.getByLabel("Description").fill("");
  await dialog.getByLabel("Provider plan ID").fill("");
  await dialog.getByLabel("Maximum branches").fill("4");

  const patchRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith(`/platform/plans/${plan.id}`),
  );
  await dialog.getByRole("button", { name: "Save changes" }).click();
  const patch = await patchRequest;
  expect(patch.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(patch.postDataJSON()).toEqual({
    description: null,
    entitlements: {
      analytics: true,
      legacyFeature: { enabled: true },
      maxBranches: 4,
      maxUsers: 20,
    },
    name: "Legacy Plus",
    providerPlanId: null,
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Legacy Plus", { exact: true })).toBeVisible();

  const catalogResponse = await request.get(`${API_URL}/platform/plans`);
  await expect(catalogResponse).toBeOK();
  const catalog = (await catalogResponse.json()) as CreatedPlan[];
  expect(catalog.find((entry) => entry.id === plan.id)?.entitlements).toEqual({
    analytics: true,
    legacyFeature: { enabled: true },
    maxBranches: 4,
    maxUsers: 20,
  });
});

test("requires a reason to change availability and displays a commercial conflict", async ({
  page,
  request,
}) => {
  await createPlanViaApi(request, {
    code: "starter-monthly",
    name: "Starter Monthly",
  });
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/plans");

  await page
    .getByRole("button", { name: "Deactivate Starter Monthly" })
    .click();
  const availabilityDialog = page.getByRole("alertdialog", {
    name: "Deactivate plan",
  });
  await availabilityDialog
    .getByRole("button", { name: "Deactivate plan" })
    .click();
  await expect(
    availabilityDialog.getByText(
      "Enter a reason for this availability change.",
    ),
  ).toBeVisible();
  await availabilityDialog
    .getByLabel("Reason")
    .fill("Retired from the current catalog");
  await availabilityDialog
    .getByRole("button", { name: "Deactivate plan" })
    .click();
  await expect(availabilityDialog).toHaveCount(0);
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit Starter Monthly" }).click();
  const editDialog = page.getByRole("dialog", {
    name: "Edit subscription plan",
  });
  await editDialog.getByLabel("Plan name").fill("Starter Plus");
  await page.route("**/platform/plans/*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({
          message:
            "A subscription plan with subscription history can only change availability.",
        }),
      });
      return;
    }

    await route.continue();
  });
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    editDialog.getByText(
      "A subscription plan with subscription history can only change availability.",
    ),
  ).toBeVisible();
  await expect(editDialog.getByLabel("Plan name")).toHaveValue("Starter Plus");
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function fillPlanForm(
  dialog: Locator,
  { code, name }: { code: string; name: string },
): Promise<void> {
  await dialog.getByLabel("Plan code").fill(code);
  await dialog.getByLabel("Plan name").fill(name);
  await dialog.getByLabel("Price").fill("250000");
  await dialog.getByLabel("Default trial days").fill("14");
  await dialog.getByLabel("Maximum branches").fill("3");
  await dialog.getByLabel("Maximum users").fill("20");
}

async function createPlanViaApi(
  request: APIRequestContext,
  {
    code,
    description,
    entitlements = { analytics: false, maxBranches: 3, maxUsers: 20 },
    name,
    providerPlanId,
  }: {
    code: string;
    description?: string;
    entitlements?: Record<string, unknown>;
    name: string;
    providerPlanId?: string;
  },
): Promise<CreatedPlan> {
  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.platformAdmin,
  });
  await expect(loginResponse).toBeOK();

  const createResponse = await request.post(`${API_URL}/platform/plans`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      amount: 250000,
      billingInterval: "MONTHLY",
      code,
      currency: "VND",
      ...(description ? { description } : {}),
      entitlements,
      name,
      ...(providerPlanId ? { providerPlanId } : {}),
    },
  });
  await expect(createResponse).toBeOK();
  return (await createResponse.json()) as CreatedPlan;
}
