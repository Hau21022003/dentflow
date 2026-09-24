import { expect, test, type Page } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const APPOINTMENTS_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/appointments`;
const DOCTOR_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/doctor`;
const APPOINTMENT_DATE = "2030-01-15";
const DENTIST_NAME = "Synthetic Test Branch Admin";

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Dentist starts, saves, completes, and adds to a Visit", async ({ page }) => {
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await expect(page.getByRole("heading", { name: "My schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Open Visit" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/doctor/appointments/[0-9a-f-]+/visit\\?date=${APPOINTMENT_DATE}$`),
  );

  const startRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/start"),
  );
  await page.getByRole("button", { name: "Start visit" }).click();
  const start = await startRequest;
  expectIdempotencyKey(start.headers()["idempotency-key"]);

  await expect(page.getByRole("heading", { name: "Clinical record" })).toBeVisible();
  const completeButton = page.getByRole("button", { name: "Complete Visit", exact: true });
  await expect(completeButton).toBeDisabled();

  await page.getByLabel("Symptoms").fill("Synthetic visit symptom");
  await expect(completeButton).toBeDisabled();
  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith("/visit"),
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  const update = await updateRequest;
  expectIdempotencyKey(update.headers()["idempotency-key"]);
  expect(update.postDataJSON()).toEqual({ symptoms: "Synthetic visit symptom" });
  await expect(completeButton).toBeEnabled();

  await completeButton.click();
  const completeDialog = page.getByRole("alertdialog", {
    name: "Complete this Visit?",
  });
  await expect(completeDialog).toBeVisible();
  const completeRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/visit/complete"),
  );
  await completeDialog.getByRole("button", { name: "Complete Visit", exact: true }).click();
  const complete = await completeRequest;
  expectIdempotencyKey(complete.headers()["idempotency-key"]);

  await expect(page.getByRole("heading", { name: "Original clinical record" })).toBeVisible();
  await expect(page.getByLabel("Symptoms")).toHaveValue("Synthetic visit symptom");
  await expect(page.getByLabel("Symptoms")).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);

  await page
    .getByRole("textbox", { name: "Addendum" })
    .fill("Synthetic completed Visit addendum");
  const addendumRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/visit/addenda"),
  );
  await page.getByRole("button", { name: "Add addendum" }).click();
  const addendum = await addendumRequest;
  expectIdempotencyKey(addendum.headers()["idempotency-key"]);
  expect(addendum.postDataJSON()).toEqual({
    content: "Synthetic completed Visit addendum",
  });
  await expect(page.getByText("Synthetic completed Visit addendum", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Symptoms")).toHaveValue("Synthetic visit symptom");
  await expect(page.getByText("Synthetic completed Visit addendum", { exact: true })).toBeVisible();
});

test("Dentist creates, syncs, proposes, reopens, and cancels a Treatment Plan", async ({ page }) => {
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Open Visit" }).click();
  await page.getByRole("button", { name: "Start visit" }).click();
  await expect(page.getByRole("heading", { name: "Treatment plans" })).toBeVisible();
  const treatmentPlans = page.locator('section[aria-labelledby="treatment-plans-title"]');

  const createRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/treatment-plans"),
  );
  await treatmentPlans.getByRole("button", { name: "Create draft" }).click();
  expectIdempotencyKey((await createRequest).headers()["idempotency-key"]);

  await treatmentPlans.getByRole("button", { name: "Add item" }).click();
  await treatmentPlans.getByRole("combobox", { name: "Service" }).first().click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("combobox", { name: "Planned dentist" }).first().click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("button", { name: "Add item" }).click();
  await treatmentPlans.getByRole("combobox", { name: "Service" }).nth(1).click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("combobox", { name: "Planned dentist" }).nth(1).click();
  await page.getByRole("option").first().click();

  const syncRequest = page.waitForRequest((request) =>
    request.method() === "PATCH" && new URL(request.url()).pathname.includes("/treatment-plans/"),
  );
  await treatmentPlans.getByRole("button", { name: "Save draft" }).click();
  const sync = await syncRequest;
  expectIdempotencyKey(sync.headers()["idempotency-key"]);
  expect(sync.postDataJSON().items).toHaveLength(2);

  const proposeRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/propose"),
  );
  await treatmentPlans.getByRole("button", { name: "Propose" }).click();
  const propose = await proposeRequest;
  expectIdempotencyKey(propose.headers()["idempotency-key"]);
  await expect(treatmentPlans.getByText("Proposed", { exact: true }).last()).toBeVisible();

  const planId = propose.url().split("/").at(-2);
  expect(planId).toBeTruthy();
  const acceptance = await page.evaluate(async ({ branchSlug, planId, tenantSlug }) => {
    const response = await fetch(
      `http://127.0.0.1:3001/tenants/${tenantSlug}/branches/${branchSlug}/treatment-plans/${planId}/accept`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
    return { body: await response.json(), status: response.status };
  }, { branchSlug: BRANCH_SLUG, planId: planId!, tenantSlug: TENANT_SLUG });
  expect(acceptance.status).toBe(200);
  expect(acceptance.body.status).toBe("ACCEPTED");
  await page.reload();
  await treatmentPlans.getByRole("button", { name: /Treatment plan/ }).click();

  const startEventResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/events"),
  );
  await treatmentPlans.getByRole("button", { name: "Start" }).first().click();
  expectIdempotencyKey((await startEventResponse).request().headers()["idempotency-key"]);
  const completeEventResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/events"),
  );
  await treatmentPlans.getByRole("button", { name: "Complete" }).click();
  expectIdempotencyKey((await completeEventResponse).request().headers()["idempotency-key"]);
  await treatmentPlans.getByRole("button", { name: "Cancel item" }).last().click();
  const itemCancelDialog = page.getByRole("dialog", { name: "Cancel treatment item" });
  await itemCancelDialog.getByLabel("Reason code").fill("PATIENT_REQUEST");
  const cancelEventResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/events"),
  );
  await itemCancelDialog.getByRole("button", { name: "Cancel item", exact: true }).click();
  expectIdempotencyKey((await cancelEventResponse).request().headers()["idempotency-key"]);
  await treatmentPlans.getByRole("button", { name: "Event history" }).first().click();
  await expect(treatmentPlans.getByText("Completed", { exact: true }).last()).toBeVisible();

  const secondCreateRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/treatment-plans"),
  );
  await treatmentPlans.getByRole("button", { name: "Create draft" }).click();
  await secondCreateRequest;
  await expect(treatmentPlans.getByRole("button", { name: "Add item" })).toBeVisible();
  await treatmentPlans.getByRole("button", { name: "Add item" }).click();
  await treatmentPlans.getByRole("combobox", { name: "Service" }).click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("combobox", { name: "Planned dentist" }).click();
  await page.getByRole("option").first().click();
  const secondSyncRequest = page.waitForRequest((request) =>
    request.method() === "PATCH" && new URL(request.url()).pathname.includes("/treatment-plans/"),
  );
  await treatmentPlans.getByRole("button", { name: "Save draft" }).click();
  await secondSyncRequest;
  await expect(treatmentPlans.getByRole("button", { name: "Propose" })).toBeEnabled();
  await treatmentPlans.getByRole("button", { name: "Propose" }).click();
  await treatmentPlans.getByRole("button", { name: "Reopen" }).click();
  const reopenDialog = page.getByRole("dialog", { name: "Reopen treatment plan" });
  await reopenDialog.getByLabel("Reason code").fill("PATIENT_REQUEST");
  const reopenRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/reopen"),
  );
  await reopenDialog.getByRole("button", { name: "Reopen", exact: true }).click();
  expectIdempotencyKey((await reopenRequest).headers()["idempotency-key"]);

  await treatmentPlans.getByRole("button", { name: "Cancel plan" }).click();
  const cancelDialog = page.getByRole("dialog", { name: "Cancel treatment plan" });
  await cancelDialog.getByLabel("Reason code").fill("PATIENT_REQUEST");
  const cancelRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/cancel"),
  );
  await cancelDialog.getByRole("button", { name: "Cancel plan", exact: true }).click();
  expectIdempotencyKey((await cancelRequest).headers()["idempotency-key"]);
  await expect(treatmentPlans.getByText("Cancelled", { exact: true }).last()).toBeVisible();
});

async function grantDentistRole(page: Page): Promise<void> {
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);
  const staffRow = page
    .getByRole("row")
    .filter({ hasText: E2E_USERS.branchAdminReceptionist.email });
  await staffRow.getByRole("button", { name: /Open actions for/ }).click();
  await page.getByRole("menuitem", { name: "Grant roles" }).click();
  const grantDialog = page.getByRole("dialog", { name: "Grant roles" });
  await grantDialog.getByLabel("Role").click();
  await page.getByRole("option", { name: "Dentist", exact: true }).click();
  await grantDialog.getByText("BrightSmile Test Central", { exact: true }).click();
  await grantDialog.getByRole("button", { name: "Grant roles" }).click();
  await expect(grantDialog).toHaveCount(0);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function loginAsDentistReceptionist(page: Page): Promise<void> {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
}

async function createAndCheckInAssignedAppointment(page: Page): Promise<void> {
  await page.goto(`${APPOINTMENTS_WORKSPACE}?view=list&date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Create appointment" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Create appointment" });
  await appointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const patientDialog = page.getByRole("dialog", { name: "Add patient" });
  await patientDialog.getByLabel("Full name").fill("Synthetic Visit Patient");
  await patientDialog.getByLabel("Phone number").fill("0909999933");
  await patientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await patientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(patientDialog).toHaveCount(0);

  await appointmentDialog.getByLabel("Start time").fill(`${APPOINTMENT_DATE}T09:00`);
  await appointmentDialog.getByLabel("End time").fill(`${APPOINTMENT_DATE}T09:30`);
  await appointmentDialog.getByLabel("Visit reason").fill("Synthetic Visit reason");
  await appointmentDialog.getByLabel("Dentist").click();
  await page.getByRole("option", { name: DENTIST_NAME, exact: true }).click();
  await appointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  await expect(appointmentDialog).toHaveCount(0);

  await page.getByRole("button", { name: "View details" }).click();
  const detailSheet = page.getByRole("dialog", { name: "Appointment details" });
  await detailSheet.getByRole("button", { name: "Confirm" }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Confirm appointment?" });
  await confirmDialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(confirmDialog).toHaveCount(0);

  await page.getByRole("button", { name: "View details" }).click();
  const checkedInDetail = page.getByRole("dialog", { name: "Appointment details" });
  await checkedInDetail.getByRole("button", { name: "Check in" }).click();
  const checkInDialog = page.getByRole("dialog", { name: "Check in patient?" });
  await checkInDialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(checkInDialog).toHaveCount(0);

  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic Visit Patient", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`date=${APPOINTMENT_DATE}`));
}

function expectIdempotencyKey(value: string | undefined): void {
  expect(value).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
}

async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ }).click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
