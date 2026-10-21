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
const BRANCH_SLUG = "central";
const OPERATORIES_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/operatories`;
const PATIENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/patients`;
const APPOINTMENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/appointments`;
const OPERATORIES_WORKSPACE =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/operatories`;
const APPOINTMENTS_WORKSPACE =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/appointments`;

test.setTimeout(60_000);

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Branch Admin manages an Operatory and appointment booking only offers active resources", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(OPERATORIES_WORKSPACE);

  await expect(
    page.getByRole("heading", { name: "Treatment rooms and chairs" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Treatment rooms / chairs" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add room / chair" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Add room or chair",
  });
  await createDialog.getByLabel("Code").fill("OP-01");
  await createDialog.getByLabel("Name").fill("Synthetic Browser Operatory");
  await createDialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Room", exact: true }).click();
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === OPERATORIES_ROUTE,
  );
  await createDialog.getByRole("button", { name: "Save" }).click();
  const create = await createResponse;
  expect(create.request().headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  const operatory = (await create.json()) as { id: string; type: string };
  expect(operatory.type).toBe("ROOM");

  let row = page.getByRole("row").filter({ hasText: "OP-01" });
  await expect(row).toContainText("Synthetic Browser Operatory");
  await expect(row).toContainText("Room");
  await row.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", {
    name: "Edit room or chair",
  });
  await expect(editDialog.getByLabel("Code")).toBeDisabled();
  await editDialog
    .getByLabel("Name")
    .fill("Synthetic Browser Operatory Updated");
  await editDialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Chair", exact: true }).click();
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(editDialog).toHaveCount(0);
  row = page.getByRole("row").filter({ hasText: "OP-01" });
  await expect(row).toContainText("Synthetic Browser Operatory Updated");
  await expect(row).toContainText("Chair");

  const searchResponse = page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return (
      url.pathname === OPERATORIES_ROUTE &&
      url.searchParams.get("search") === "OP-01"
    );
  });
  await page.getByPlaceholder("Search by code or name...").fill("OP-01");
  await searchResponse;

  const patient = await createPatient(request);
  const appointment = await createAppointment(
    request,
    patient.id,
    operatory.id,
  );
  await row.getByRole("button", { name: "Deactivate" }).click();
  const deactivateDialog = page.getByRole("dialog", {
    name: "Deactivate Synthetic Browser Operatory Updated?",
  });
  await deactivateDialog
    .getByLabel("Reason")
    .fill("Synthetic browser maintenance");
  await deactivateDialog.getByRole("button", { name: "Deactivate" }).click();
  await expect(
    deactivateDialog.getByText(
      "The Operatory still has non-terminal appointments. Reassign them before deactivation.",
    ),
  ).toBeVisible();

  await cancelAppointment(request, appointment.id);
  await deactivateDialog.getByRole("button", { name: "Deactivate" }).click();
  await expect(deactivateDialog).toHaveCount(0);
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible();

  await page.goto(`${APPOINTMENTS_WORKSPACE}?view=list&date=2030-01-15`);
  await page.getByRole("button", { name: "Create appointment" }).click();
  let appointmentDialog = page.getByRole("dialog", {
    name: "Create appointment",
  });
  await appointmentDialog
    .getByRole("combobox", { name: "Room / chair" })
    .click();
  await expect(page.getByRole("option", { name: /OP-01/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await appointmentDialog.getByRole("button", { name: "Cancel" }).click();

  await page.goto(OPERATORIES_WORKSPACE);
  await page.getByPlaceholder("Search by code or name...").fill("OP-01");
  row = page.getByRole("row").filter({ hasText: "OP-01" });
  await row.getByRole("button", { name: "Activate" }).click();
  const activateDialog = page.getByRole("dialog", {
    name: "Activate Synthetic Browser Operatory Updated?",
  });
  await activateDialog
    .getByLabel("Reason")
    .fill("Synthetic browser reopening");
  await activateDialog.getByRole("button", { name: "Activate" }).click();
  await expect(activateDialog).toHaveCount(0);

  await page.goto(`${APPOINTMENTS_WORKSPACE}?view=list&date=2030-01-15`);
  await page.getByRole("button", { name: "Create appointment" }).click();
  appointmentDialog = page.getByRole("dialog", {
    name: "Create appointment",
  });
  await appointmentDialog
    .getByRole("combobox", { name: "Room / chair" })
    .click();
  await expect(
    page.getByRole("option", {
      name: "OP-01 · Synthetic Browser Operatory Updated",
    }),
  ).toBeVisible();
});

async function loginBranchActorApi(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.branchAdminReceptionist,
  });
  await expect(response).toBeOK();
}

async function createPatient(
  request: APIRequestContext,
): Promise<{ id: string }> {
  const response = await request.post(`${API_URL}${PATIENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      fullName: "Synthetic Operatory Patient",
      phone: "0908800002",
      gender: "OTHER",
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string };
}

async function createAppointment(
  request: APIRequestContext,
  patientId: string,
  operatoryId: string,
): Promise<{ id: string }> {
  const response = await request.post(`${API_URL}${APPOINTMENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      patientId,
      source: "PHONE",
      startAt: "2030-01-15T03:00:00.000Z",
      endAt: "2030-01-15T03:30:00.000Z",
      serviceId: null,
      assignedDentistUserId: null,
      operatoryId,
      visitReason: "Synthetic Operatory appointment",
      operationalNote: null,
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string };
}

async function cancelAppointment(
  request: APIRequestContext,
  appointmentId: string,
): Promise<void> {
  const response = await request.post(
    `${API_URL}${APPOINTMENTS_ROUTE}/${appointmentId}/cancel`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: { reasonCode: "CLINIC_CANCELLED" },
    },
  );
  await expect(response).toBeOK();
}

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
