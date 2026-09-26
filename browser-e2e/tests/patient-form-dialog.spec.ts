import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login, submitLogin } from "./support/login";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const PATIENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/patients`;
const PATIENTS_WORKSPACE_PATH =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/patients`;
const DOCTOR_PATIENTS_WORKSPACE_PATH =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/doctor/patients`;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Branch Admin searches, sorts, and paginates the tenant patient list", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  for (let index = 1; index <= 11; index += 1) {
    await createPatientViaApi(request, {
      fullName: `Synthetic Browser Patient ${String(index).padStart(2, "0")}`,
      phone: `090700${String(index).padStart(4, "0")}`,
      gender: "FEMALE",
    });
  }

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  const initialList = waitForPatientList(
    page,
    (url) =>
      url.searchParams.get("page") === "1" &&
      url.searchParams.get("limit") === "10",
  );
  await page.goto(PATIENTS_WORKSPACE_PATH);
  await expect(page.getByRole("heading", { name: "Patient management" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Patients" }),
  ).toBeVisible();
  await initialList;

  const search = page.getByPlaceholder("Search by name or phone number…");
  const searchResponse = waitForPatientList(
    page,
    (url) => url.searchParams.get("search") === "Patient 09",
  );
  await search.fill("Patient 09");
  await searchResponse;
  await expect(
    page.getByText("Synthetic Browser Patient 09", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Toggle sort options" }).first().click();
  const sortResponse = waitForPatientList(
    page,
    (url) =>
      url.searchParams.get("sortBy") === "fullName" &&
      url.searchParams.get("sortOrder") === "DESC",
  );
  await page.getByRole("menuitem", { name: "Sort descending" }).click();
  await sortResponse;

  await page.reload();
  const nextPageResponse = waitForPatientList(
    page,
    (url) => url.searchParams.get("page") === "2",
  );
  await page.getByRole("button", { name: "Go to next page" }).click();
  await nextPageResponse;
});

test("Branch Admin creates, edits, and receives duplicate feedback for a patient", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(PATIENTS_WORKSPACE_PATH);

  await page.getByRole("button", { name: "Add patient" }).click();
  const createDialog = page.getByRole("dialog", { name: "Add patient" });
  await createDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(createDialog.getByText("Full name is required.")).toBeVisible();

  await fillPatientForm(page, createDialog, {
    fullName: "  Synthetic Browser Patient  ",
    phone: "090 123 4567",
    gender: "Female",
    dateOfBirth: "2999-01-01",
    address: "  500 Synthetic Browser Street  ",
    emergencyContactName: "  Synthetic Guardian  ",
    emergencyContactPhone: "+84 912 345 678",
    emergencyContactRelationship: " Parent ",
    referralSource: " Website ",
  });
  await createDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(
    createDialog.getByText("Date of birth cannot be in the future."),
  ).toBeVisible();
  await createDialog.getByLabel("Date of birth").fill("1999-04-20");

  const createRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith(PATIENTS_ROUTE),
  );
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith(PATIENTS_ROUTE),
  );
  await createDialog.getByRole("button", { name: "Add patient" }).click();
  const create = await createRequest;
  expect(create.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(create.postDataJSON()).toEqual({
    fullName: "Synthetic Browser Patient",
    phone: "090 123 4567",
    gender: "FEMALE",
    dateOfBirth: "1999-04-20",
    address: "500 Synthetic Browser Street",
    emergencyContact: {
      fullName: "Synthetic Guardian",
      phone: "+84 912 345 678",
      relationship: "Parent",
    },
    referralSource: "Website",
  });
  const createdPatient = (await (await createResponse).json()) as { id: string };
  await expect(createDialog).toHaveCount(0);

  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Browser Patient" });
  await expect(createdRow).toBeVisible();
  await createdRow
    .getByRole("button", { name: "Open actions for Synthetic Browser Patient" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit patient profile" });
  await editDialog.getByLabel("Full name").fill("Synthetic Browser Patient Updated");
  await editDialog.getByLabel("Address").fill("");
  await editDialog.getByLabel("Emergency contact name").fill("");
  await editDialog.getByLabel("Emergency contact phone").fill("");
  await editDialog.getByLabel("Relationship").fill("");
  await editDialog.getByLabel("Referral source").fill("Updated website");

  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith(`${PATIENTS_ROUTE}/${createdPatient.id}`),
  );
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  const update = await updateRequest;
  expect(update.headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(update.postDataJSON()).toEqual({
    fullName: "Synthetic Browser Patient Updated",
    address: null,
    emergencyContact: null,
    referralSource: "Updated website",
  });
  await expect(editDialog).toHaveCount(0);
  await expect(
    page.getByText("Synthetic Browser Patient Updated", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add patient" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Add patient" });
  await fillPatientForm(page, duplicateDialog, {
    fullName: "Synthetic Duplicate Patient",
    phone: "+84 901 234 567",
    gender: "Other",
  });
  await duplicateDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(
    duplicateDialog.getByText("A patient with this phone number already exists in the tenant."),
  ).toBeVisible();
});

test("Patient workspace is denied without administrative permission", async ({ page }) => {
  await page.goto("/login");
  await submitLogin(page, E2E_USERS.dentist);
  await page.goto(PATIENTS_WORKSPACE_PATH);
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

test("Dentist can open the assigned-patient list without administrative actions", async ({
  page,
}) => {
  await login(page, E2E_USERS.branchDentist);
  await switchToEnglish(page);
  const assignedList = page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    return new URL(response.url()).pathname === `${PATIENTS_ROUTE}/assigned`;
  });
  await page.goto(DOCTOR_PATIENTS_WORKSPACE_PATH);
  await assignedList;

  await expect(page.getByRole("heading", { name: "Patients", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add patient" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My patients" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open actions for/ })).toHaveCount(0);
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function loginBranchActorApi(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.branchAdminReceptionist,
  });
  await expect(response).toBeOK();
}

async function createPatientViaApi(
  request: APIRequestContext,
  input: { fullName: string; phone: string; gender: "MALE" | "FEMALE" | "OTHER" },
): Promise<void> {
  const response = await request.post(`${API_URL}${PATIENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: input,
  });
  await expect(response).toBeOK();
}

function waitForPatientList(
  page: Page,
  predicate: (url: URL) => boolean,
) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "GET") return false;
    const url = new URL(response.url());
    return url.pathname === PATIENTS_ROUTE && predicate(url);
  });
}

async function fillPatientForm(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
  values: {
    fullName: string;
    phone: string;
    gender: "Female" | "Male" | "Other";
    dateOfBirth?: string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    referralSource?: string;
  },
): Promise<void> {
  await dialog.getByLabel("Full name").fill(values.fullName);
  await dialog.getByLabel("Phone number").fill(values.phone);
  await dialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: values.gender, exact: true }).click();
  if (values.dateOfBirth) await dialog.getByLabel("Date of birth").fill(values.dateOfBirth);
  if (values.address) await dialog.getByLabel("Address").fill(values.address);
  if (values.emergencyContactName) {
    await dialog.getByLabel("Emergency contact name").fill(values.emergencyContactName);
  }
  if (values.emergencyContactPhone) {
    await dialog.getByLabel("Emergency contact phone").fill(values.emergencyContactPhone);
  }
  if (values.emergencyContactRelationship) {
    await dialog.getByLabel("Relationship").fill(values.emergencyContactRelationship);
  }
  if (values.referralSource) {
    await dialog.getByLabel("Referral source").fill(values.referralSource);
  }
}
