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

test("Patient Appointments keeps tab state in the URL and reuses appointment workflows", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await loginBranchActorApi(request);
  const patient = await createPatient(request, {
    fullName: "Synthetic Appointment Tab Patient",
    phone: "0908800002",
    email: "appointment.tab@example.test",
  });
  const appointments = [];
  for (let day = 1; day <= 11; day += 1) {
    appointments.push(
      await createAppointment(request, patient.id, null, {
        startAt: `2030-02-${String(day).padStart(2, "0")}T02:00:00.000Z`,
        endAt: `2030-02-${String(day).padStart(2, "0")}T02:30:00.000Z`,
        visitReason:
          day === 1
            ? "Synthetic history needle"
            : `Synthetic history appointment ${day}`,
        operationalNote: day === 1 ? "Synthetic searchable note" : null,
      }),
    );
  }

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  const detailPath = `${PATIENTS_WORKSPACE}/${patient.id}`;
  await page.goto(detailPath);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const initialHistory = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) =>
      url.searchParams.get("page") === "1" &&
      url.searchParams.get("limit") === "10",
  );
  await page.getByRole("tab", { name: "Appointments" }).click();
  await initialHistory;
  await expect(page).toHaveURL(`${detailPath}?tab=appointments`);
  await expect(page.getByText("Upcoming appointment")).toBeVisible();
  await expect(page.getByText("Appointment history")).toBeVisible();
  await expect(
    page
      .getByText("Synthetic history appointment 11", { exact: true })
      .first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page).toHaveURL(`${detailPath}?tab=overview`);
  await page.goBack();
  await expect(page).toHaveURL(`${detailPath}?tab=appointments`);
  await expect(page.getByRole("tab", { name: "Appointments" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const historySearch = page.getByPlaceholder(
    "Search services, dentists, operatories, or notes…",
  );
  const searchResponse = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) => url.searchParams.get("search") === "needle",
  );
  await historySearch.fill("needle");
  await searchResponse;
  await expect(
    page.getByText("Synthetic history needle", { exact: true }).first(),
  ).toBeVisible();

  const filterResponse = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) =>
      url.searchParams.get("search") === "needle" &&
      url.searchParams.get("status") === "BOOKED",
  );
  await page.getByRole("combobox", { name: "All statuses" }).click();
  await page.getByRole("option", { name: "Booked", exact: true }).click();
  await filterResponse;

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(historySearch).toHaveValue("");
  await expect(
    page.getByRole("combobox", { name: "All statuses" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByText("Synthetic history appointment 11", { exact: true })
      .first(),
  ).toBeVisible();

  const nextPageResponse = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) => url.searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await nextPageResponse;
  const oldestRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic history needle" });
  await expect(oldestRow).toBeVisible();

  await oldestRow.getByRole("button", { name: "View details" }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `\\?tab=appointments&appointmentId=${appointments[0].id}$`,
    ),
  );
  const detailSheet = page.getByRole("dialog", {
    name: "Appointment details",
  });
  await expect(detailSheet).toContainText(patient.fullName);
  await detailSheet.getByRole("button", { name: "Confirm", exact: true }).click();
  const actionDialog = page.getByRole("dialog", {
    name: "Confirm appointment?",
  });
  await actionDialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(actionDialog).toHaveCount(0);
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  if (await detailSheet.isVisible()) {
    await detailSheet.getByRole("button", { name: "Close" }).click();
  }

  const firstPageResponse = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) => url.searchParams.get("page") === "1",
  );
  await page.getByRole("button", { name: "Go to first page" }).click();
  await firstPageResponse;

  const patientPickerRequests: string[] = [];
  page.on("request", (outgoing) => {
    const url = new URL(outgoing.url());
    if (outgoing.method() === "GET" && url.pathname === PATIENTS_ROUTE) {
      patientPickerRequests.push(outgoing.url());
    }
  });
  await page.getByRole("button", { name: "Create appointment" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Create appointment",
  });
  await expect(createDialog.getByRole("combobox", { name: "Patient" })).toBeDisabled();
  await expect(createDialog.getByText(patient.fullName, { exact: true })).toBeVisible();
  await expect(
    createDialog.getByRole("button", { name: "Add patient" }),
  ).toHaveCount(0);
  await expect.poll(() => patientPickerRequests.length).toBe(0);

  await createDialog.getByLabel("Appointment date").fill("2031-01-16");
  await createDialog
    .getByLabel("Visit reason")
    .fill("Synthetic appointment created from patient detail");
  const createRequest = page.waitForRequest((outgoing) => {
    const url = new URL(outgoing.url());
    return outgoing.method() === "POST" && url.pathname === APPOINTMENTS_ROUTE;
  });
  const refreshedHistory = waitForPatientAppointmentList(
    page,
    patient.id,
    (url) => url.searchParams.get("page") === "1",
  );
  await createDialog
    .getByRole("button", { name: "Create appointment" })
    .click();
  const outgoingCreate = await createRequest;
  expect(outgoingCreate.postDataJSON()).toMatchObject({ patientId: patient.id });
  await refreshedHistory;
  await expect(createDialog).toHaveCount(0);
  await expect(
    page.getByText("Synthetic appointment created from patient detail", {
      exact: true,
    }).first(),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
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
  operatoryId: string | null,
  overrides: Partial<{
    startAt: string;
    endAt: string;
    visitReason: string;
    operationalNote: string | null;
  }> = {},
): Promise<{ id: string }> {
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
      ...overrides,
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string };
}

function waitForPatientAppointmentList(
  page: Page,
  patientId: string,
  predicate: (url: URL) => boolean,
) {
  const pathname = `${PATIENTS_ROUTE}/${patientId}/appointments`;
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === pathname &&
      predicate(url)
    );
  });
}

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
