import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const APPOINTMENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/appointments`;
const WORKSPACE_ROUTE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/appointments`;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Branch Admin creates an appointment from the daily agenda and confirms it", async ({ page }) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(WORKSPACE_ROUTE);
  await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();

  await page.getByRole("button", { name: "Create appointment" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Create appointment" });
  await appointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const patientDialog = page.getByRole("dialog", { name: "Add patient" });
  await patientDialog.getByLabel("Full name").fill("Synthetic Agenda Patient");
  await patientDialog.getByLabel("Phone number").fill("0909999999");
  await patientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await patientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(patientDialog).toHaveCount(0);

  await appointmentDialog.getByLabel("Start time").fill("2030-01-15T09:00");
  await appointmentDialog.getByLabel("End time").fill("2030-01-15T09:30");
  await appointmentDialog.getByLabel("Visit reason").fill("Synthetic agenda reason");

  const createRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith(APPOINTMENTS_ROUTE),
  );
  await appointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toMatchObject({
    source: "PHONE",
    serviceId: null,
    visitReason: "Synthetic agenda reason",
  });
  await expect(appointmentDialog).toHaveCount(0);

  const agendaRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET"
      && url.pathname === APPOINTMENTS_ROUTE
      && url.searchParams.get("from") === "2030-01-14T17:00:00.000Z";
  });
  await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2030-01-15`);
  await agendaRequest;
  await expect(page.getByText("Synthetic Agenda Patient", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "View details" }).click();
  const detailDialog = page.getByRole("dialog", { name: "Appointment details" });
  await detailDialog.getByRole("button", { name: "Confirm" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Confirm appointment?" });
  const confirmRequest = page.waitForRequest(
    (request) => request.method() === "POST" && /\/confirm$/.test(request.url()),
  );
  await confirmDialog.getByRole("button", { name: "Confirm action" }).click();
  const confirm = await confirmRequest;
  expect(confirm.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(confirmDialog).toHaveCount(0);
});

test("agenda uses the resolved branch time zone across the fall DST transition", async ({ page, request }) => {
  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.tenantAdmin,
  });
  await expect(loginResponse).toBeOK();
  const updateResponse = await request.patch(
    `${API_URL}/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { timezone: "America/New_York" },
    },
  );
  await expect(updateResponse).toBeOK();

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(WORKSPACE_ROUTE);
  const agendaRequest = page.waitForRequest((request) => {
    if (request.method() !== "GET") return false;
    const url = new URL(request.url());
    return url.pathname === APPOINTMENTS_ROUTE
      && url.searchParams.get("from") === "2026-11-01T04:00:00.000Z"
      && url.searchParams.get("to") === "2026-11-02T05:00:00.000Z";
  });
  await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2026-11-01`);
  await agendaRequest;
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
