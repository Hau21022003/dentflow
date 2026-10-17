import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const APPOINTMENTS_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/appointments`;
const DOCTOR_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/doctor`;
const ACCEPTANCE_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/treatment-plan-acceptances`;
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
  await expect(page.getByLabel("Monthly appointment calendar")).toBeVisible();
  await page.locator('button[data-date="2030-01-16"]').click();
  await expect(page).toHaveURL(/date=2030-01-16/);
  await page.locator(`button[data-date="${APPOINTMENT_DATE}"]`).click();
  await expect(page).toHaveURL(new RegExp(`date=${APPOINTMENT_DATE}`));
  await expect(page.getByText("1 appointment · 0h 30m total")).toBeVisible();
  await expect(page.getByText("Female", { exact: true })).toBeVisible();
  const startRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/start"),
  );
  await page.getByRole("button", { name: "Start Visit" }).click();
  const start = await startRequest;
  expectIdempotencyKey(start.headers()["idempotency-key"]);
  await expect(page).toHaveURL(
    new RegExp(`/doctor/appointments/[0-9a-f-]+/visit\\?date=${APPOINTMENT_DATE}$`),
  );

  await expect(page.getByRole("heading", { name: "Clinical record" })).toBeVisible();
  await expect(page.getByText("0909999933", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View patient profile" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Clinical record" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Safety notes" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Related treatment plans" })).toBeVisible();
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
  await expect(page.getByRole("tab", { name: "Safety notes" })).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Related treatment plans" })).toBeDisabled();

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
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
});

test("assigned Dentist creates, edits, and resolves a Patient safety alert", async ({
  page,
}) => {
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Start Visit" }).click();
  await page.getByRole("tab", { name: "Safety notes" }).click();
  await expect(
    page.getByRole("heading", { name: "Patient safety alerts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add alert" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Create patient alert",
  });
  await createDialog.getByLabel("Category").selectOption("ALLERGY");
  await createDialog.getByRole("radio", { name: /Critical/ }).check();
  await createDialog
    .getByLabel("Alert content")
    .fill("Synthetic browser penicillin allergy");
  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/alerts"),
  );
  await createDialog.getByRole("button", { name: "Create alert" }).click();
  expectIdempotencyKey((await createRequest).headers()["idempotency-key"]);
  await expect(createDialog).toHaveCount(0);
  const alertsPanel = page.getByRole("region", { name: "Patient safety alerts" });
  const alertRow = alertsPanel
    .locator("tbody tr")
    .filter({ hasText: "Synthetic browser penicillin allergy" });
  await expect(alertRow).toContainText("Critical");
  await expect(alertRow).toContainText("Allergy");
  await expect(alertRow).toContainText(`by ${DENTIST_NAME}`);
  await expect(alertRow.locator('[data-category-icon="ALLERGY"]')).toBeVisible();
  await expect(alertRow.getByRole("button", { name: "View" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Clinical record" }).click();
  await expect(
    page.getByRole("heading", { name: "Important safety alerts" }),
  ).toBeVisible();
  const highlightedAlert = page
    .getByRole("button")
    .filter({ hasText: "Synthetic browser penicillin allergy" });
  await expect(highlightedAlert).toContainText("Allergy");
  await expect(highlightedAlert).toContainText("Critical");
  await expect(
    highlightedAlert.locator('[data-category-icon="ALLERGY"]'),
  ).toBeVisible();
  await highlightedAlert.click();
  await expect(page.getByRole("tab", { name: "Safety notes" })).toHaveAttribute(
    "data-state",
    "active",
  );

  const editButton = alertRow.getByRole("button", { name: "Edit" });
  await editButton.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Edit this alert's category, severity, and content.",
  );
  await editButton.click();
  const editDialog = page.getByRole("dialog", {
    name: "Edit patient alert",
  });
  await editDialog
    .getByLabel("Alert content")
    .fill("Synthetic browser severe penicillin allergy");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toHaveCount(0);
  const updatedAlertRow = alertsPanel
    .locator("tbody tr")
    .filter({ hasText: "Synthetic browser severe penicillin allergy" });
  const resolveButton = updatedAlertRow.getByRole("button", { name: "Resolve" });
  await resolveButton.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Mark this alert as resolved and move it to history.",
  );
  await resolveButton.click();
  const resolveDialog = page.getByRole("dialog", {
    name: "Resolve this alert?",
  });
  await resolveDialog.getByLabel("Resolution reason").click();
  await page.getByRole("option", { name: "No longer applicable" }).click();
  const resolveRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/resolve"),
  );
  await resolveDialog.getByRole("button", { name: "Resolve" }).click();
  expectIdempotencyKey((await resolveRequest).headers()["idempotency-key"]);
  await expect(resolveDialog).toHaveCount(0);
  await expect(updatedAlertRow).toHaveCount(0);

  await alertsPanel.getByRole("button", { name: "Resolved", exact: true }).click();
  const resolvedAlertRow = alertsPanel
    .locator("tbody tr")
    .filter({ hasText: "Synthetic browser severe penicillin allergy" });
  await expect(resolvedAlertRow.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(resolvedAlertRow.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(
    resolvedAlertRow.getByRole("button", { name: "Resolve" }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const resolvedAlertCard = alertsPanel
    .locator("article")
    .filter({ hasText: "Synthetic browser severe penicillin allergy" });
  await expect(resolvedAlertCard).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
});

test("Dentist creates, syncs, proposes, reopens, and cancels a Treatment Plan", async ({ page }) => {
  test.setTimeout(60_000);
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Start Visit" }).click();
  await page.getByRole("tab", { name: "Related treatment plans" }).click();
  await expect(page.getByRole("heading", { name: "Related treatment plans" })).toBeVisible();

  const createRequest = page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/treatment-plans"),
  );
  await page.getByRole("button", { name: "Create plan" }).click();
  expectIdempotencyKey((await createRequest).headers()["idempotency-key"]);
  await expect(page).toHaveURL(/\/visit\/treatment-plans\/[0-9a-f-]+\?date=/);
  const treatmentPlans = page.getByRole("region", { name: "Plan details" });

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
  await page.goto(ACCEPTANCE_WORKSPACE);
  await expect(page.getByRole("heading", { name: "Treatment plan acceptances" })).toBeVisible();
  const queueRow = page.getByRole("row").filter({ hasText: "Synthetic Visit Patient" });
  await expect(queueRow).toContainText(planId!.slice(0, 8));
  await expect(page.getByText("Synthetic indication", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/synthetic-cleaning/i)).toHaveCount(0);
  await expect(page.getByText("Service", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tooth position", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Indication", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Discount amount", { exact: true })).toHaveCount(0);
  const acceptanceRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith(`/treatment-plans/${planId}/accept`),
  );
  await queueRow.getByRole("button", { name: "Accept" }).click();
  const acceptanceDialog = page.getByRole("alertdialog", {
    name: "Confirm treatment plan acceptance",
  });
  await acceptanceDialog.getByRole("button", { name: "Accept", exact: true }).click();
  expectIdempotencyKey((await acceptanceRequest).headers()["idempotency-key"]);
  await expect(queueRow).toHaveCount(0);
  await page.reload();
  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Continue Visit" }).click();
  await page.getByRole("tab", { name: "Related treatment plans" }).click();
  await expect(
    page.getByPlaceholder("Search by plan code or treatment name..."),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "All statuses", exact: true }),
  ).toBeVisible();
  for (const column of [
    "Plan",
    "Dentist",
    "Status",
    "Progress",
    "Estimated cost",
    "Actions",
  ]) {
    await expect(page.getByRole("columnheader", { name: column })).toBeVisible();
  }
  const planRow = page
    .getByRole("row")
    .filter({ hasText: "Accepted" })
    .filter({
      has: page.getByRole("button", { name: "View details", exact: true }),
    });
  await expect(planRow).toContainText("Accepted");
  await expect(planRow.getByRole("progressbar")).toHaveAttribute(
    "aria-label",
    "0 / 2 completed",
  );
  await expect(planRow.getByRole("cell").nth(4)).not.toHaveText("—");
  await expect(page.getByRole("button", { name: /Quick view/ })).toHaveCount(0);

  const planSearch = page.getByPlaceholder(
    "Search by plan code or treatment name...",
  );
  await planSearch.fill("no-matching-treatment-plan");
  await expect(
    page
      .getByText("No treatment plans match the current filters.", { exact: true })
      .first(),
  ).toBeVisible();
  await planSearch.fill("");
  const statusFilter = page.getByRole("combobox", {
    name: "All statuses",
    exact: true,
  });
  await statusFilter.click();
  await page.getByRole("option", { name: "Draft", exact: true }).click();
  await expect(
    page
      .getByText("No treatment plans match the current filters.", { exact: true })
      .first(),
  ).toBeVisible();
  await statusFilter.click();
  await page.getByRole("option", { name: "All statuses", exact: true }).click();
  await expect(planRow).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePlan = page
    .locator('[data-slot="data-table-mobile-item"]')
    .filter({ hasText: "Accepted" });
  await expect(mobilePlan).toBeVisible();
  await expect(mobilePlan.getByRole("progressbar")).toHaveAttribute(
    "aria-label",
    "0 / 2 completed",
  );
  await expect(
    mobilePlan.getByRole("button", { name: "View details", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "View details" }).first().click();

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
  await page.getByRole("link", { name: "Back to Visit" }).click();
  await page.getByRole("tab", { name: "Related treatment plans" }).click();
  await page.getByRole("button", { name: "Create plan" }).click();
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

  await setAppointmentTime(page, appointmentDialog, APPOINTMENT_DATE, "09:00", "09:30");
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

async function setAppointmentTime(
  page: Page,
  dialog: Locator,
  date: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  await dialog.getByLabel("Appointment date").fill(date);
  await dialog.getByLabel("Start time").click();
  await page.getByRole("option", { name: startTime, exact: true }).click();
  const [hours, minutes] = startTime.split(":").map(Number);
  const suggestedMinutes = hours * 60 + minutes + 30;
  const suggestedEnd = `${String(Math.floor(suggestedMinutes / 60)).padStart(2, "0")}:${String(suggestedMinutes % 60).padStart(2, "0")}`;
  await expect(dialog.getByLabel("End time")).toContainText(suggestedEnd);
  await dialog.getByLabel("End time").click();
  await page.getByRole("option", { name: endTime, exact: true }).click();
}

async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ }).click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
