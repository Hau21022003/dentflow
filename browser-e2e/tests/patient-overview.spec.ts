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
const PATIENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/patients`;
const APPOINTMENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/appointments`;
const OPERATORIES_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/operatories`;
const PATIENTS_WORKSPACE =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/patients`;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Patient list opens Overview, edits email, and deep-links to the next appointment", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  const patient = await createPatient(request, {
    fullName: "Synthetic Overview Patient",
    phone: "0908800001",
    email: "overview.patient@example.test",
  });
  const operatory = await createOperatory(request, {
    code: "OV-01",
    name: "Synthetic Overview Room",
    type: "ROOM",
  });
  await createAppointment(request, patient.id, operatory.id);

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(PATIENTS_WORKSPACE);

  const row = page.getByRole("row").filter({ hasText: patient.fullName });
  await row
    .getByRole("link", { name: `View profile for ${patient.fullName}` })
    .click();
  const detailPath = `${PATIENTS_WORKSPACE}/${patient.id}`;
  await expect(page).toHaveURL(detailPath);
  await expect(
    page.getByRole("heading", { name: patient.fullName }),
  ).toBeVisible();
  await expect(page.getByText(patient.code, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("overview.patient@example.test", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("No active safety alerts.")).toBeVisible();
  await expect(page.getByText("Synthetic overview check-up")).toBeVisible();
  await expect(page.getByText(operatory.name, { exact: true })).toBeVisible();
  await expect(page.getByText("No active treatment plan")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", {
    name: "Edit patient profile",
  });
  await editDialog
    .getByLabel("Email")
    .fill("overview.updated@example.test");
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === `${PATIENTS_ROUTE}/${patient.id}`,
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const update = await updateRequest;
  expect(update.postDataJSON()).toEqual({
    email: "overview.updated@example.test",
  });
  await expect(editDialog).toHaveCount(0);
  await expect(
    page.getByText("overview.updated@example.test", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "View appointment" }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/reception/appointments\\?.*appointmentId=[0-9a-f-]+`,
    ),
  );
  const appointmentDialog = page.getByRole("dialog", {
    name: "Appointment details",
  });
  await expect(appointmentDialog).toContainText(patient.fullName);
  await expect(appointmentDialog).toContainText(operatory.name);
});

test("Patient Overview renders not-found and remains usable on a mobile viewport", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PATIENTS_WORKSPACE}/${randomUUID()}`);

  await expect(page.getByText("Patient not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to patients" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

async function loginBranchActorApi(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.branchAdminReceptionist,
  });
  await expect(response).toBeOK();
}

async function createPatient(
  request: APIRequestContext,
  input: { fullName: string; phone: string; email: string },
): Promise<{ id: string; code: string; fullName: string }> {
  const response = await request.post(`${API_URL}${PATIENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { ...input, gender: "FEMALE", dateOfBirth: "1998-05-10" },
  });
  await expect(response).toBeOK();
  return (await response.json()) as {
    id: string;
    code: string;
    fullName: string;
  };
}

async function createOperatory(
  request: APIRequestContext,
  input: { code: string; name: string; type: "ROOM" | "CHAIR" },
): Promise<{ id: string; name: string }> {
  const response = await request.post(`${API_URL}${OPERATORIES_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: input,
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string; name: string };
}

async function createAppointment(
  request: APIRequestContext,
  patientId: string,
  operatoryId: string,
): Promise<void> {
  const response = await request.post(`${API_URL}${APPOINTMENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      patientId,
      source: "PHONE",
      startAt: "2030-01-15T02:00:00.000Z",
      endAt: "2030-01-15T02:30:00.000Z",
      serviceId: null,
      assignedDentistUserId: null,
      operatoryId,
      visitReason: "Synthetic overview check-up",
      operationalNote: null,
    },
  });
  await expect(response).toBeOK();
}

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
