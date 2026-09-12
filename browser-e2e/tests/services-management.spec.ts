import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const SERVICES_ROUTE = `/tenants/${TENANT_SLUG}/services`;
const SERVICE_GROUPS_ROUTE = `/tenants/${TENANT_SLUG}/service-groups`;

type CreatedService = {
  id: string;
  code: string;
};

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Tenant Admin lists services with server-side search, filter, sort, and pagination", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  const serviceGroupId = await createServiceGroupViaApi(
    request,
    "Synthetic browser group",
  );
  for (let index = 1; index <= 10; index += 1) {
    await createServiceViaApi(
      request,
      {
        code: `browser-list-${String(index).padStart(2, "0")}`,
        name: `Synthetic Browser Service ${String(index).padStart(2, "0")}`,
      },
      serviceGroupId,
    );
  }
  const inactiveService = await createServiceViaApi(
    request,
    {
      code: "browser-inactive",
      name: "Synthetic Browser Inactive Service",
    },
    serviceGroupId,
  );
  await deactivateServiceViaApi(request, inactiveService.id);

  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  const initialList = waitForServiceList(
    page,
    (url) =>
      url.searchParams.get("page") === "1" &&
      url.searchParams.get("limit") === "10",
  );
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/services`);
  await expect(
    page.getByRole("heading", { name: "Service management" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Services" }),
  ).toBeVisible();
  await initialList;

  const search = page.getByPlaceholder("Search code, name, or group…");
  const searchResponse = waitForServiceList(
    page,
    (url) => url.searchParams.get("search") === "browser-list-09",
  );
  await search.fill("browser-list-09");
  await searchResponse;
  await expect(
    page.getByText("Synthetic Browser Service 09", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page
    .getByRole("button", { name: "Toggle sort options" })
    .first()
    .click();
  const sortResponse = waitForServiceList(
    page,
    (url) =>
      url.searchParams.get("sortBy") === "name" &&
      url.searchParams.get("sortOrder") === "DESC",
  );
  await page.getByRole("menuitem", { name: "Sort descending" }).click();
  await sortResponse;

  await page.reload();
  await page.getByRole("button", { name: "Toggle filter options" }).click();
  const filterResponse = waitForServiceList(
    page,
    (url) => url.searchParams.get("isActive") === "false",
  );
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Inactive" }).click();
  await filterResponse;
  await expect(
    page.getByText("Synthetic Browser Inactive Service", { exact: true }),
  ).toBeVisible();

  await page.reload();
  const nextPageResponse = waitForServiceList(
    page,
    (url) => url.searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await nextPageResponse;
});

test("Tenant Admin creates, edits, deactivates, and reactivates a service", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  const serviceGroupId = await createServiceGroupViaApi(
    request,
    "Synthetic Group",
  );
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/services`);

  await page.getByRole("button", { name: "Create service" }).click();
  const dialog = page.getByRole("dialog", { name: "Create service" });
  await dialog.getByRole("button", { name: "Create service" }).click();
  await expect(dialog.getByText("Service code is required.")).toBeVisible();

  await fillServiceForm(page, dialog, {
    code: "synthetic-browser-service",
    name: "Synthetic Browser Service",
    serviceGroupName: "Synthetic Group",
    price: "150000",
    durationMinutes: "60",
  });
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith(SERVICES_ROUTE),
  );
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(SERVICES_ROUTE),
  );
  await dialog.getByRole("button", { name: "Create service" }).click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toEqual({
    code: "synthetic-browser-service",
    name: "Synthetic Browser Service",
    serviceGroupId,
    amount: 150000,
    currency: "VND",
    durationMinutes: 60,
  });
  const createdService = (await (
    await createResponse
  ).json()) as CreatedService;
  await expect(dialog).toHaveCount(0);

  const createdServiceSearch = waitForServiceList(
    page,
    (url) => url.searchParams.get("search") === "synthetic-browser-service",
  );
  await page
    .getByPlaceholder("Search code, name, or group…")
    .fill("synthetic-browser-service");
  await createdServiceSearch;
  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Browser Service" });
  await expect(createdRow).toBeVisible();
  await createdRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Service" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit service" });
  await expect(editDialog.getByLabel("Service code")).toBeDisabled();
  await editDialog.getByLabel("Currency").click();
  await page.getByRole("option", { name: /USD/ }).click();
  await editDialog.getByLabel("List price").fill("1750.5");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    editDialog.getByText("Enter a reason for the price or currency change."),
  ).toBeVisible();
  await editDialog
    .getByLabel("Reason")
    .fill("Synthetic currency and price update");
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith(`${SERVICES_ROUTE}/${createdService.id}`),
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const update = await updateRequest;
  expect(update.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(update.postDataJSON()).toEqual({
    amount: 175050,
    currency: "USD",
    reason: "Synthetic currency and price update",
  });
  await expect(editDialog).toHaveCount(0);
  await expect(createdRow).toContainText("$1,750.50");

  await createdRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Service" })
    .click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const deactivateDialog = page.getByRole("alertdialog", {
    name: "Deactivate service",
  });
  await deactivateDialog
    .getByRole("button", { name: "Deactivate service" })
    .click();
  await expect(
    deactivateDialog.getByText("Enter a reason for this action."),
  ).toBeVisible();
  await deactivateDialog.getByLabel("Reason").fill("Synthetic catalog pause");
  const deactivateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request
        .url()
        .endsWith(`${SERVICES_ROUTE}/${createdService.id}/deactivate`),
  );
  await deactivateDialog
    .getByRole("button", { name: "Deactivate service" })
    .click();
  expect((await deactivateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(deactivateDialog).toHaveCount(0);
  await expect(createdRow.getByText("Inactive", { exact: true })).toBeVisible();

  await createdRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Service" })
    .click();
  await page.getByRole("menuitem", { name: "Reactivate service" }).click();
  const activateDialog = page.getByRole("alertdialog", {
    name: "Reactivate service",
  });
  await activateDialog.getByLabel("Reason").fill("Synthetic catalog reopening");
  const activateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(`${SERVICES_ROUTE}/${createdService.id}/activate`),
  );
  await activateDialog
    .getByRole("button", { name: "Reactivate service" })
    .click();
  expect((await activateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(activateDialog).toHaveCount(0);
  await expect(createdRow.getByText("Active", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create service" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Create service" });
  await fillServiceForm(page, duplicateDialog, {
    code: "synthetic-browser-service",
    name: "Duplicate Synthetic Browser Service",
    serviceGroupName: "Synthetic Group",
    price: "1",
    durationMinutes: "30",
  });
  await duplicateDialog.getByRole("button", { name: "Create service" }).click();
  await expect(
    duplicateDialog.getByText(
      "A service with this code already exists in the tenant.",
    ),
  ).toBeVisible();
});

test("Tenant Admin lists service groups with server-side search, filter, sort, and pagination", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  for (let index = 1; index <= 10; index += 1) {
    await createServiceGroupViaApi(
      request,
      `Synthetic Browser Group ${String(index).padStart(2, "0")}`,
    );
  }
  const inactiveServiceGroupId = await createServiceGroupViaApi(
    request,
    "Synthetic Browser Inactive Group",
  );
  await deactivateServiceGroupViaApi(request, inactiveServiceGroupId);

  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/services`);

  const initialList = waitForServiceGroupList(
    page,
    (url) =>
      url.searchParams.get("page") === "1" &&
      url.searchParams.get("limit") === "10",
  );
  await page.getByRole("tab", { name: "Service groups" }).click();
  await expect(page).toHaveURL(/\/tenant\/services\?tab=groups$/);
  await initialList;

  const search = page.getByPlaceholder("Search service group name…");
  const searchResponse = waitForServiceGroupList(
    page,
    (url) => url.searchParams.get("search") === "group 09",
  );
  await search.fill("group 09");
  await searchResponse;
  await expect(
    page.getByText("Synthetic Browser Group 09", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/tenant\/services\?tab=groups$/);
  await page
    .getByRole("button", { name: "Toggle sort options" })
    .first()
    .click();
  const sortResponse = waitForServiceGroupList(
    page,
    (url) =>
      url.searchParams.get("sortBy") === "name" &&
      url.searchParams.get("sortOrder") === "DESC",
  );
  await page.getByRole("menuitem", { name: "Sort descending" }).click();
  await sortResponse;

  await page.reload();
  await page.getByRole("button", { name: "Toggle filter options" }).click();
  const filterResponse = waitForServiceGroupList(
    page,
    (url) => url.searchParams.get("isActive") === "false",
  );
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Inactive" }).click();
  const filteredResponse = await filterResponse;
  expect(filteredResponse.status()).toBe(200);
  expect(
    ((await filteredResponse.json()) as {
      items: Array<{ name: string; isActive: boolean }>;
    }).items,
  ).toContainEqual(
    expect.objectContaining({
      name: "Synthetic Browser Inactive Group",
      isActive: false,
    }),
  );
  await expect(
    page.getByText("Synthetic Browser Inactive Group", { exact: true }),
  ).toBeVisible();

  await page.reload();
  const nextPageResponse = waitForServiceGroupList(
    page,
    (url) => url.searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await nextPageResponse;
});

test("Tenant Admin manages a service group without deactivating its existing services", async ({
  page,
  request,
}) => {
  await loginTenantAdminApi(request);
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/services?tab=groups`);

  await page.getByRole("button", { name: "Create service group" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Create service group",
  });
  await createDialog
    .getByRole("button", { name: "Create service group" })
    .click();
  await expect(
    createDialog.getByText("Service group name is required."),
  ).toBeVisible();
  await createDialog
    .getByLabel("Service group name")
    .fill("  Synthetic Managed Group  ");
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith(SERVICE_GROUPS_ROUTE),
  );
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(SERVICE_GROUPS_ROUTE),
  );
  await createDialog
    .getByRole("button", { name: "Create service group" })
    .click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toEqual({ name: "Synthetic Managed Group" });
  const managedServiceGroup = (await (
    await createResponse
  ).json()) as { id: string };
  await expect(createDialog).toHaveCount(0);

  const groupSearch = waitForServiceGroupList(
    page,
    (url) => url.searchParams.get("search") === "synthetic managed group",
  );
  await page
    .getByPlaceholder("Search service group name…")
    .fill("synthetic managed group");
  await groupSearch;
  const groupRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Managed Group" });
  await groupRow
    .getByRole("button", { name: "Open actions for Synthetic Managed Group" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit service group" });
  await editDialog
    .getByLabel("Service group name")
    .fill("  Renamed Service Group  ");
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith(`${SERVICE_GROUPS_ROUTE}/${managedServiceGroup.id}`),
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const update = await updateRequest;
  expect(update.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(update.postDataJSON()).toEqual({ name: "Renamed Service Group" });
  await expect(editDialog).toHaveCount(0);

  const renamedGroupSearch = waitForServiceGroupList(
    page,
    (url) => url.searchParams.get("search") === "renamed service group",
  );
  await page
    .getByPlaceholder("Search service group name…")
    .fill("renamed service group");
  await renamedGroupSearch;

  const activeService = await createServiceViaApi(
    request,
    {
      code: "managed-group-service",
      name: "Synthetic Managed Group Service",
    },
    managedServiceGroup.id,
  );
  const renamedGroupRow = page
    .getByRole("row")
    .filter({ hasText: "Renamed Service Group" });
  await renamedGroupRow
    .getByRole("button", { name: "Open actions for Renamed Service Group" })
    .click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  const deactivateDialog = page.getByRole("alertdialog", {
    name: "Deactivate service group",
  });
  await expect(
    deactivateDialog.getByText(
      "Existing services remain active, but this group cannot be selected for new services or group changes until it is reactivated.",
    ),
  ).toBeVisible();
  await deactivateDialog
    .getByRole("button", { name: "Deactivate service group" })
    .click();
  await expect(
    deactivateDialog.getByText("Enter a reason for this action."),
  ).toBeVisible();
  await deactivateDialog.getByLabel("Reason").fill("Synthetic group pause");
  const deactivateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request
        .url()
        .endsWith(`${SERVICE_GROUPS_ROUTE}/${managedServiceGroup.id}/deactivate`),
  );
  await deactivateDialog
    .getByRole("button", { name: "Deactivate service group" })
    .click();
  expect((await deactivateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(deactivateDialog).toHaveCount(0);
  await expect(renamedGroupRow.getByText("Inactive", { exact: true })).toBeVisible();

  const servicesResponse = await request.get(`${API_URL}${SERVICES_ROUTE}`, {
    params: { search: "managed-group-service" },
  });
  await expect(servicesResponse).toBeOK();
  const services = (await servicesResponse.json()) as {
    items: Array<{ id: string; isActive: boolean }>;
  };
  expect(services.items).toContainEqual(
    expect.objectContaining({
      id: activeService.id,
      isActive: true,
    }),
  );

  await page.getByRole("tab", { name: "Services" }).click();
  await page
    .getByPlaceholder("Search code, name, or group…")
    .fill("managed-group-service");
  const activeServiceRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Managed Group Service" });
  await expect(activeServiceRow.getByText("Active", { exact: true })).toBeVisible();
  await activeServiceRow
    .getByRole("button", { name: "Open actions for Synthetic Managed Group Service" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const serviceEditDialog = page.getByRole("dialog", { name: "Edit service" });
  await expect(
    serviceEditDialog.getByLabel("Service group"),
  ).toContainText("Renamed Service Group");
  await serviceEditDialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Service groups" }).click();
  const reactivatedGroupRow = page
    .getByRole("row")
    .filter({ hasText: "Renamed Service Group" });
  await reactivatedGroupRow
    .getByRole("button", { name: "Open actions for Renamed Service Group" })
    .click();
  await page.getByRole("menuitem", { name: "Reactivate service group" }).click();
  const activateDialog = page.getByRole("alertdialog", {
    name: "Reactivate service group",
  });
  await activateDialog.getByLabel("Reason").fill("Synthetic group reopening");
  const activateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request
        .url()
        .endsWith(`${SERVICE_GROUPS_ROUTE}/${managedServiceGroup.id}/activate`),
  );
  await activateDialog
    .getByRole("button", { name: "Reactivate service group" })
    .click();
  expect((await activateRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(activateDialog).toHaveCount(0);
  await expect(reactivatedGroupRow.getByText("Active", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create service group" }).click();
  const duplicateDialog = page.getByRole("dialog", {
    name: "Create service group",
  });
  await duplicateDialog
    .getByLabel("Service group name")
    .fill("renamed service group");
  await duplicateDialog
    .getByRole("button", { name: "Create service group" })
    .click();
  await expect(
    duplicateDialog.getByText(
      "A service group with this name already exists in the tenant.",
    ),
  ).toBeVisible();
});

test("A user without service-catalog.manage is denied the service route", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/services`);
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

async function createServiceViaApi(
  request: APIRequestContext,
  input: { code: string; name: string },
  serviceGroupId: string,
): Promise<CreatedService> {
  const response = await request.post(`${API_URL}${SERVICES_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      ...input,
      serviceGroupId,
      amount: 150000,
      currency: "VND",
      durationMinutes: 60,
    },
  });
  await expect(response).toBeOK();
  return response.json() as Promise<CreatedService>;
}

async function createServiceGroupViaApi(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const response = await request.post(`${API_URL}${SERVICE_GROUPS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { name },
  });
  await expect(response).toBeOK();
  return ((await response.json()) as { id: string }).id;
}

async function deactivateServiceViaApi(
  request: APIRequestContext,
  serviceId: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}${SERVICES_ROUTE}/${serviceId}/deactivate`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { reason: "Synthetic E2E inactive service" },
    },
  );
  await expect(response).toBeOK();
}

async function deactivateServiceGroupViaApi(
  request: APIRequestContext,
  serviceGroupId: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}${SERVICE_GROUPS_ROUTE}/${serviceGroupId}/deactivate`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { reason: "Synthetic E2E inactive service group" },
    },
  );
  await expect(response).toBeOK();
}

function waitForServiceList(page: Page, predicate: (url: URL) => boolean) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return url.pathname === SERVICES_ROUTE && predicate(url);
  });
}

function waitForServiceGroupList(
  page: Page,
  predicate: (url: URL) => boolean,
) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return url.pathname === SERVICE_GROUPS_ROUTE && predicate(url);
  });
}

async function fillServiceForm(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
  values: {
    code: string;
    name: string;
    serviceGroupName: string;
    price: string;
    durationMinutes: string;
  },
): Promise<void> {
  await dialog.getByLabel("Service code").fill(values.code);
  await dialog.getByLabel("Service name").fill(values.name);
  await dialog.getByLabel("Service group").click();
  await page
    .getByRole("option", { name: values.serviceGroupName, exact: true })
    .click();
  await dialog.getByLabel("List price").fill(values.price);
  await dialog.getByLabel("Duration (minutes)").fill(values.durationMinutes);
}
