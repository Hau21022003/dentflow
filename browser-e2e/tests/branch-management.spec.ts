import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const BRANCHES_ROUTE = `/tenants/${TENANT_SLUG}/branches`;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Tenant Admin lists only tenant branches with server-side search, filter, sort, and pagination", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  for (let index = 1; index <= 9; index += 1) {
    await createBranchViaApi(request, {
      slug: `browser-list-${String(index).padStart(2, "0")}`,
      name: `Synthetic Browser List ${String(index).padStart(2, "0")}`,
    });
  }
  const inactiveBranch = await createBranchViaApi(request, {
    slug: "browser-inactive",
    name: "Synthetic Browser Inactive",
  });
  await deactivateBranchViaApi(request, inactiveBranch.slug);

  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  const initialList = waitForBranchList(page, (url) =>
    url.searchParams.get("page") === "1" && url.searchParams.get("limit") === "10",
  );
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/branches`);
  await expect(page.getByRole("heading", { name: "Branch management" })).toBeVisible();
  await expect(page.getByText("BrightSmile Test Central", { exact: true })).toBeVisible();
  await expect(page.getByText("Harmony Test City", { exact: true })).toHaveCount(0);
  await initialList;

  const search = page.getByPlaceholder(
    "Search name, slug, address, or phone...",
  );
  const searchResponse = waitForBranchList(
    page,
    (url) => url.searchParams.get("search") === "browser-list-09",
  );
  await search.fill("browser-list-09");
  await searchResponse;
  await expect(
    page.getByText("Synthetic Browser List 09", { exact: true }),
  ).toBeVisible();

  await page.reload();
  const sortMenu = page.getByRole("button", { name: "Toggle sort options" }).first();
  await sortMenu.click();
  const sortResponse = waitForBranchList(
    page,
    (url) =>
      url.searchParams.get("sortBy") === "name" &&
      url.searchParams.get("sortOrder") === "DESC",
  );
  await page.getByRole("menuitem", { name: "Sort descending" }).click();
  await sortResponse;

  await page.reload();
  await page.getByRole("button", { name: "Toggle filter options" }).click();
  const filterResponse = waitForBranchList(
    page,
    (url) => url.searchParams.get("status") === "INACTIVE",
  );
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Inactive" }).click();
  await filterResponse;
  await expect(
    page.getByText("Synthetic Browser Inactive", { exact: true }),
  ).toBeVisible();

  await page.reload();
  const nextPageResponse = waitForBranchList(
    page,
    (url) => url.searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await nextPageResponse;
});

test("Tenant Admin creates, edits, deactivates, and reactivates a branch", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/branches`);

  await page.getByRole("button", { name: "Create branch" }).click();
  const dialog = page.getByRole("dialog", { name: "Create branch" });
  await dialog.getByRole("button", { name: "Create branch" }).click();
  await expect(dialog.getByText("Branch slug is required.")).toBeVisible();

  await fillBranchForm(dialog, {
    slug: "synthetic-browser-branch",
    name: "Synthetic Browser Branch",
    timezone: "Asia/Ho_Chi_Minh",
  });
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith(BRANCHES_ROUTE),
  );
  await dialog.getByRole("button", { name: "Create branch" }).click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toEqual({
    slug: "synthetic-browser-branch",
    name: "Synthetic Browser Branch",
    address: "500 Synthetic Browser Street",
    phone: "+84900000099",
    timezone: "Asia/Ho_Chi_Minh",
  });
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Synthetic Browser Branch", { exact: true }),
  ).toBeVisible();

  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Browser Branch" });
  await createdRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Branch" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit branch" });
  await expect(editDialog.getByLabel("Branch slug")).toBeDisabled();
  await editDialog
    .getByLabel("Branch name")
    .fill("Synthetic Browser Branch Updated");
  await editDialog.getByLabel("Time zone").fill("");
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith(`${BRANCHES_ROUTE}/synthetic-browser-branch`),
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const update = await updateRequest;
  expect(update.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(update.postDataJSON()).toEqual({
    name: "Synthetic Browser Branch Updated",
    timezone: null,
  });
  await expect(
    page.getByText("Synthetic Browser Branch Updated", { exact: true }),
  ).toBeVisible();

  const updatedRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Browser Branch Updated" });
  await updatedRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Branch Updated" })
    .click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const deactivateDialog = page.getByRole("alertdialog", {
    name: "Deactivate branch",
  });
  await deactivateDialog.getByRole("button", { name: "Deactivate branch" }).click();
  await expect(
    deactivateDialog.getByText("Enter a reason for this action."),
  ).toBeVisible();
  await deactivateDialog
    .getByLabel("Reason")
    .fill("Synthetic browser closure");
  const deactivateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(`${BRANCHES_ROUTE}/synthetic-browser-branch/deactivate`),
  );
  await deactivateDialog.getByRole("button", { name: "Deactivate branch" }).click();
  expect((await deactivateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(deactivateDialog).toHaveCount(0);
  await expect(updatedRow.getByText("Inactive", { exact: true })).toBeVisible();

  await updatedRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Branch Updated" })
    .click();
  await page.getByRole("menuitem", { name: "Reactivate branch" }).click();
  const activateDialog = page.getByRole("alertdialog", {
    name: "Reactivate branch",
  });
  await activateDialog.getByLabel("Reason").fill("Synthetic browser reopening");
  const activateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(`${BRANCHES_ROUTE}/synthetic-browser-branch/activate`),
  );
  await activateDialog.getByRole("button", { name: "Reactivate branch" }).click();
  expect((await activateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(activateDialog).toHaveCount(0);
  await expect(updatedRow.getByText("Active", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create branch" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Create branch" });
  await fillBranchForm(duplicateDialog, {
    slug: "central",
    name: "Duplicate Synthetic Browser Branch",
  });
  await duplicateDialog.getByRole("button", { name: "Create branch" }).click();
  await expect(
    duplicateDialog.getByText(
      "A branch with this slug already exists in the tenant.",
    ),
  ).toBeVisible();
});

test("A user without branch.manage is denied the Tenant Admin branch route", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/branches`);
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function loginTenantAdminApi(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.tenantAdmin,
  });
  await expect(response).toBeOK();
}

async function createBranchViaApi(
  request: APIRequestContext,
  input: { slug: string; name: string },
): Promise<{ slug: string }> {
  const response = await request.post(`${API_URL}${BRANCHES_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      ...input,
      address: "500 Synthetic Browser Street",
      phone: "+84900000099",
    },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<{ slug: string }>;
}

async function deactivateBranchViaApi(
  request: APIRequestContext,
  branchSlug: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}${BRANCHES_ROUTE}/${branchSlug}/deactivate`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { reason: "Synthetic E2E inactive branch" },
    },
  );
  await expect(response).toBeOK();
}

function waitForBranchList(
  page: Page,
  predicate: (url: URL) => boolean,
) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return url.pathname === BRANCHES_ROUTE && predicate(url);
  });
}

async function fillBranchForm(
  dialog: ReturnType<Page["getByRole"]>,
  values: { slug: string; name: string; timezone?: string },
): Promise<void> {
  await dialog.getByLabel("Branch slug").fill(values.slug);
  await dialog.getByLabel("Branch name").fill(values.name);
  await dialog.getByLabel("Address").fill("500 Synthetic Browser Street");
  await dialog.getByLabel("Phone").fill("+84900000099");
  if (values.timezone) {
    await dialog.getByLabel("Time zone").fill(values.timezone);
  }
}
