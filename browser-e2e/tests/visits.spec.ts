import { expect, test, type Locator, type Page } from "@playwright/test";
import { CAT_AVATAR_JPEG_FILE } from "./fixtures/images";
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

test("Dentist starts, saves, completes, and adds to a Visit", async ({
  page,
}) => {
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await expect(
    page.getByRole("heading", { name: "My schedule" }),
  ).toBeVisible();
  await expect(page.getByLabel("Monthly appointment calendar")).toBeVisible();
  await page.locator('button[data-date="2030-01-16"]').click();
  await expect(page).toHaveURL(/date=2030-01-16/);
  await page.locator(`button[data-date="${APPOINTMENT_DATE}"]`).click();
  await expect(page).toHaveURL(new RegExp(`date=${APPOINTMENT_DATE}`));
  await expect(page.getByText("1 appointment · 0h 30m total")).toBeVisible();
  const appointment = page
    .getByRole("listitem")
    .filter({ hasText: "Synthetic Visit Patient" });
  await expect(appointment.getByText("Female", { exact: true })).toHaveText(
    "Female",
  );
  const startRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/start"),
  );
  await page.getByRole("button", { name: "Start Visit" }).click();
  const start = await startRequest;
  expectIdempotencyKey(start.headers()["idempotency-key"]);
  await expect(page).toHaveURL(
    new RegExp(
      `/doctor/appointments/[0-9a-f-]+/visit\\?date=${APPOINTMENT_DATE}$`,
    ),
  );

  await expect(
    page.getByRole("heading", { name: "Clinical record" }),
  ).toBeVisible();
  await expect(page.getByText("0909999933", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View patient profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Clinical record" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Safety notes" })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Related treatment plans" }),
  ).toBeVisible();
  const completeButton = page.getByRole("button", {
    name: "Complete Visit",
    exact: true,
  });
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
  expect(update.postDataJSON()).toEqual({
    symptoms: "Synthetic visit symptom",
  });
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
  await completeDialog
    .getByRole("button", { name: "Complete Visit", exact: true })
    .click();
  const complete = await completeRequest;
  expectIdempotencyKey(complete.headers()["idempotency-key"]);

  await expect(
    page.getByRole("heading", { name: "Original clinical record" }),
  ).toBeVisible();
  await expect(page.getByLabel("Symptoms")).toHaveValue(
    "Synthetic visit symptom",
  );
  await expect(page.getByLabel("Symptoms")).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Safety notes" })).toBeDisabled();
  await expect(
    page.getByRole("tab", { name: "Related treatment plans" }),
  ).toBeDisabled();

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
  await expect(
    page.getByText("Synthetic completed Visit addendum", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Symptoms")).toHaveValue(
    "Synthetic visit symptom",
  );
  await expect(
    page.getByText("Synthetic completed Visit addendum", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
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
  const alertsPanel = page.getByRole("region", {
    name: "Patient safety alerts",
  });
  const alertRow = alertsPanel
    .locator("tbody tr")
    .filter({ hasText: "Synthetic browser penicillin allergy" });
  await expect(alertRow).toContainText("Critical");
  await expect(alertRow).toContainText("Allergy");
  await expect(alertRow).toContainText(`by ${DENTIST_NAME}`);
  await expect(
    alertRow.locator('[data-category-icon="ALLERGY"]'),
  ).toBeVisible();
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
  const resolveButton = updatedAlertRow.getByRole("button", {
    name: "Resolve",
  });
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

  await alertsPanel
    .getByRole("button", { name: "Resolved", exact: true })
    .click();
  const resolvedAlertRow = alertsPanel
    .locator("tbody tr")
    .filter({ hasText: "Synthetic browser severe penicillin allergy" });
  await expect(
    resolvedAlertRow.getByText("Resolved", { exact: true }),
  ).toBeVisible();
  await expect(
    resolvedAlertRow.getByRole("button", { name: "Edit" }),
  ).toHaveCount(0);
  await expect(
    resolvedAlertRow.getByRole("button", { name: "Resolve" }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const resolvedAlertCard = alertsPanel
    .locator("article")
    .filter({ hasText: "Synthetic browser severe penicillin allergy" });
  await expect(resolvedAlertCard).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test("Dentist creates, syncs, proposes, reopens, and cancels a Treatment Plan", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await grantDentistRole(page);
  await loginAsDentistReceptionist(page);
  await createAndCheckInAssignedAppointment(page);

  await page.goto(`${DOCTOR_WORKSPACE}?date=${APPOINTMENT_DATE}`);
  await page.getByRole("button", { name: "Start Visit" }).click();
  await page.getByRole("tab", { name: "Related treatment plans" }).click();
  await expect(
    page.getByRole("heading", { name: "Related treatment plans" }),
  ).toBeVisible();

  const createRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/treatment-plans"),
  );
  await page.getByRole("button", { name: "Create plan" }).click();
  expectIdempotencyKey((await createRequest).headers()["idempotency-key"]);
  await expect(page).toHaveURL(/\/visit\/treatment-plans\/[0-9a-f-]+\?date=/);
  const treatmentPlans = page.getByRole("region", { name: "Plan details" });

  await expect(
    page.getByRole("heading", { name: "Dental chart (FDI)" }),
  ).toBeVisible();
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    const chart = await page
      .getByRole("group", { name: "Upper arch, Lower arch" })
      .boundingBox();
    expect(chart).not.toBeNull();
    expect(chart!.x + chart!.width).toBeLessThanOrEqual(width);
  }
  await expect(
    treatmentPlans.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
  await expect(
    treatmentPlans.getByRole("button", { name: "Create plan", exact: true }),
  ).toBeVisible();
  await expect(
    treatmentPlans.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeHidden();

  await page.getByRole("button", { name: "More actions" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Cancel plan" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Enlarge dental chart" }).click();
  const enlargedChart = page.getByRole("dialog", { name: "Dental chart" });
  await expect(enlargedChart).toBeVisible();
  await expect(
    enlargedChart.getByRole("button", { name: /^Tooth \d+$/ }),
  ).toHaveCount(32);
  await enlargedChart.getByRole("button", { name: "Close" }).click();

  await page.setViewportSize({ width: 1280, height: 720 });
  const dentalChartHeading = page.getByRole("heading", {
    name: "Dental chart (FDI)",
  });
  const treatmentItemHeading = page.getByRole("heading", {
    name: "Add treatment item",
  });
  await expect
    .poll(async () => {
      const dentalChart = await dentalChartHeading.boundingBox();
      const treatmentItem = await treatmentItemHeading.boundingBox();
      return Boolean(
        dentalChart &&
        treatmentItem &&
        treatmentItem.x >= dentalChart.x + dentalChart.width,
      );
    })
    .toBe(true);
  await expect
    .poll(() =>
      dentalChartHeading.evaluate((heading) => {
        const card = heading.closest('[data-slot="card"]');
        return card ? window.getComputedStyle(card).position : null;
      }),
    )
    .toBe("sticky");
  await expect
    .poll(() =>
      page
        .locator('[data-slot="treatment-plan-actions"]')
        .evaluate((actions) => window.getComputedStyle(actions).position),
    )
    .toBe("sticky");
  const tooth16 = page.getByRole("button", { name: "Tooth 16", exact: true });
  await tooth16.focus();
  await expect(tooth16).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tooth16).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Primary teeth", exact: true })
    .click();
  await page.getByRole("button", { name: "Tooth 55", exact: true }).click();
  await page
    .getByRole("button", { name: "Permanent teeth", exact: true })
    .click();
  await expect(treatmentPlans.getByLabel("Quantity")).toHaveValue("2");
  await treatmentPlans.getByLabel("Quantity").fill("4");
  await page.getByRole("button", { name: "Tooth 26", exact: true }).click();
  await expect(treatmentPlans.getByLabel("Quantity")).toHaveValue("4");

  await treatmentPlans.getByRole("combobox", { name: "Service" }).click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("button", { name: "Save draft" }).click();
  await expect(
    treatmentPlans.getByText(
      "Add or update the item currently being edited before saving the plan.",
      { exact: true },
    ),
  ).toBeVisible();
  await treatmentPlans
    .getByRole("combobox", { name: "Planned dentist" })
    .click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByLabel("Indication").fill("Synthetic indication");
  await treatmentPlans.getByRole("button", { name: "Add to plan" }).click();

  await treatmentPlans.getByRole("combobox", { name: "Service" }).click();
  await page.getByRole("option").first().click();
  await treatmentPlans
    .getByRole("combobox", { name: "Planned dentist" })
    .click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("button", { name: "Add to plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Added items (2)" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    treatmentPlans.locator('[data-slot="data-table-mobile-item"]'),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await page.setViewportSize({ width: 1280, height: 720 });

  const syncRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.includes("/treatment-plans/"),
  );
  await treatmentPlans.getByRole("button", { name: "Save draft" }).click();
  const sync = await syncRequest;
  expectIdempotencyKey(sync.headers()["idempotency-key"]);
  expect(sync.postDataJSON().items).toHaveLength(2);
  expect(sync.postDataJSON().items[0]).toEqual(
    expect.objectContaining({ quantity: 4, toothPosition: "16, 26, 55" }),
  );

  let failNextPropose = true;
  let failedProposeKey = "";
  await page.route(/\/treatment-plans\/[0-9a-f-]+\/propose$/, async (route) => {
    if (!failNextPropose) return route.continue();
    failNextPropose = false;
    failedProposeKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      body: JSON.stringify({ message: "Synthetic propose failure" }),
      contentType: "application/json",
      status: 500,
    });
  });
  await treatmentPlans
    .getByRole("button", { name: "Create treatment plan" })
    .click();
  await expect(
    treatmentPlans.getByText("Synthetic propose failure", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/visit\/treatment-plans\/[0-9a-f-]+\?date=/);

  const proposeRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/propose"),
  );
  await treatmentPlans
    .getByRole("button", { name: "Create treatment plan" })
    .click();
  const propose = await proposeRequest;
  expectIdempotencyKey(propose.headers()["idempotency-key"]);
  expect(propose.headers()["idempotency-key"]).toBe(failedProposeKey);
  await page.unroute(/\/treatment-plans\/[0-9a-f-]+\/propose$/);
  await expect(page).toHaveURL(/\/visit\?date=.*&tab=treatment-plans$/);

  const planId = propose.url().split("/").at(-2);
  expect(planId).toBeTruthy();
  await page.goto(ACCEPTANCE_WORKSPACE);
  await expect(
    page.getByRole("heading", { name: "Treatment plan acceptances" }),
  ).toBeVisible();
  const queueRow = page
    .getByRole("row")
    .filter({ hasText: "Synthetic Visit Patient" });
  await expect(queueRow).toContainText(planId!.slice(0, 8));
  await expect(
    page.getByText("Synthetic indication", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/synthetic-cleaning/i)).toHaveCount(0);
  await expect(page.getByText("Service", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tooth position", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Indication", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Discount amount", { exact: true })).toHaveCount(
    0,
  );
  const acceptanceRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith(
        `/treatment-plans/${planId}/accept`,
      ),
  );
  await queueRow.getByRole("button", { name: "Accept" }).click();
  const acceptanceDialog = page.getByRole("alertdialog", {
    name: "Confirm treatment plan acceptance",
  });
  await acceptanceDialog
    .getByRole("button", { name: "Accept", exact: true })
    .click();
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
    await expect(
      page.getByRole("columnheader", { name: column }),
    ).toBeVisible();
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
      .getByText("No treatment plans match the current filters.", {
        exact: true,
      })
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
      .getByText("No treatment plans match the current filters.", {
        exact: true,
      })
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
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "View details" }).first().click();
  const detailSheet = page.getByRole("dialog", { name: /Plan details/ });
  await expect(detailSheet).toBeVisible();
  await expect(page).toHaveURL(/\/visit\?date=.*&tab=treatment-plans$/);
  expect((await detailSheet.boundingBox())!.width).toBeGreaterThan(700);
  expect((await detailSheet.boundingBox())!.width).toBeLessThanOrEqual(760);
  await expect(
    detailSheet.getByText("Estimated cost", { exact: true }),
  ).toHaveCount(0);
  await expect(
    detailSheet.getByText("Total estimated cost", { exact: true }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await detailSheet.boundingBox())!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  const firstItemCard = detailSheet.locator("article").first();
  await expect(
    firstItemCard.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "More actions", exact: true }),
  ).toBeVisible();
  await firstItemCard
    .getByRole("button", { name: "More actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Cancel item", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 720 });

  const startEventResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/events"),
  );
  await detailSheet.getByRole("button", { name: "Start" }).first().click();
  expectIdempotencyKey(
    (await startEventResponse).request().headers()["idempotency-key"],
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    firstItemCard.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "Progress", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "Complete", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "More actions", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await firstItemCard
    .getByRole("button", { name: "Progress", exact: true })
    .click();
  const progressDialog = page.getByRole("dialog", {
    name: "Record treatment progress",
  });
  await expect(progressDialog).toBeVisible();
  await expect(
    progressDialog.getByText("In progress", { exact: true }),
  ).toBeVisible();
  await expect(
    progressDialog.getByText(/No tooth assigned|Tooth:/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  await progressDialog.getByRole("button", { name: "Save note" }).click();
  await expect(
    progressDialog.getByText("Work performed is required.", { exact: true }),
  ).toBeVisible();
  await progressDialog
    .getByLabel("Work performed")
    .fill("Synthetic treatment progress\nPatient responded well.");
  const progressFileInput = progressDialog.locator('input[type="file"]');
  await progressFileInput.setInputFiles(CAT_AVATAR_JPEG_FILE);
  await expect(
    progressDialog.getByRole("button", { name: "Preview treatment image 1" }),
  ).toBeVisible();
  await progressDialog
    .getByRole("button", { name: "Preview treatment image 1" })
    .click();
  const imagePreviewDialog = page.getByRole("dialog", {
    name: "Treatment image",
  });
  await expect(
    imagePreviewDialog.getByAltText("Enlarged treatment image"),
  ).toBeVisible();
  await imagePreviewDialog.getByRole("button", { name: "Close" }).click();
  await progressDialog
    .getByRole("button", { name: "Remove treatment image 1" })
    .click();
  await expect(
    progressDialog.getByRole("button", { name: "Preview treatment image 1" }),
  ).toHaveCount(0);
  await progressFileInput.setInputFiles(CAT_AVATAR_JPEG_FILE);

  let progressIntentCount = 0;
  const countProgressIntent = (request: import("@playwright/test").Request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/uploads/image-intents") &&
      request.postDataJSON()?.purpose === "TREATMENT_PROGRESS"
    ) {
      progressIntentCount += 1;
    }
  };
  page.on("request", countProgressIntent);
  let failProgressNote = true;
  let failedProgressKey = "";
  await page.route(/\/progress-notes$/, async (route) => {
    if (!failProgressNote) return route.continue();
    failProgressNote = false;
    failedProgressKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      body: JSON.stringify({ message: "Synthetic progress failure" }),
      contentType: "application/json",
      status: 500,
    });
  });
  await progressDialog.getByRole("button", { name: "Save note" }).click();
  await expect(
    progressDialog.getByText("Synthetic progress failure", { exact: true }),
  ).toBeVisible();
  await expect(progressDialog.getByLabel("Work performed")).toHaveValue(
    "Synthetic treatment progress\nPatient responded well.",
  );
  await expect(
    progressDialog.getByRole("button", { name: "Preview treatment image 1" }),
  ).toBeVisible();

  const progressNoteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/progress-notes"),
  );
  await progressDialog.getByRole("button", { name: "Save note" }).click();
  const recordedProgress = await progressNoteResponse;
  expectIdempotencyKey(recordedProgress.request().headers()["idempotency-key"]);
  expect(recordedProgress.request().headers()["idempotency-key"]).toBe(
    failedProgressKey,
  );
  expect(recordedProgress.request().postDataJSON()).toEqual({
    content: "Synthetic treatment progress\nPatient responded well.",
    imageObjectKeys: [expect.stringContaining("/treatment-progress/")],
  });
  expect(progressIntentCount).toBe(1);
  page.off("request", countProgressIntent);
  await page.unroute(/\/progress-notes$/);
  await expect(progressDialog).toHaveCount(0);
  await expect(detailSheet).toBeVisible();
  await expect(
    firstItemCard.getByText("In progress", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 720 });
  const completeEventResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/events"),
  );
  await detailSheet.getByRole("button", { name: "Complete" }).click();
  expectIdempotencyKey(
    (await completeEventResponse).request().headers()["idempotency-key"],
  );
  await detailSheet.getByRole("button", { name: "Cancel item" }).last().click();
  const itemCancelDialog = page.getByRole("dialog", {
    name: "Cancel treatment item",
  });
  await expect(itemCancelDialog.getByRole("radio")).toHaveCount(5);
  await expect(
    itemCancelDialog.getByRole("radio", { name: /Patient request/ }),
  ).toBeChecked();
  await itemCancelDialog.getByText("Other", { exact: true }).click();
  const itemCancellationNote = "Synthetic browser item cancellation note.";
  const itemCancellationNoteInput =
    itemCancelDialog.getByLabel(/Additional note/);
  const itemCancelSubmit = itemCancelDialog.locator('button[type="submit"]');
  await expect(itemCancelSubmit).toBeDisabled();
  await expect(itemCancelDialog.getByText("0/500", { exact: true })).toBeVisible();
  await itemCancellationNoteInput.fill(itemCancellationNote);
  await expect(
    itemCancelDialog.getByText(`${itemCancellationNote.length}/500`, {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await itemCancellationNoteInput.evaluate(
      (element) => window.getComputedStyle(element).fontSize,
    ),
  ).toBe("14px");
  const itemCancelScrollRegion = itemCancelDialog.locator(
    ".min-h-0.flex-1.overflow-y-auto",
  );
  await expect(itemCancelScrollRegion).toBeVisible();
  expect(
    await itemCancelScrollRegion.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await itemCancelScrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(itemCancelSubmit).toBeVisible();

  let failedItemCancelKey = "";
  await page.route(
    /\/events$/,
    async (route) => {
      failedItemCancelKey = route.request().headers()["idempotency-key"] ?? "";
      await route.fulfill({
        body: JSON.stringify({ message: "Synthetic item cancellation failure" }),
        contentType: "application/json",
        status: 500,
      });
    },
    { times: 1 },
  );
  await itemCancelSubmit.click();
  await expect(
    itemCancelDialog.getByText("Synthetic item cancellation failure", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(itemCancellationNoteInput).toHaveValue(itemCancellationNote);

  let releaseItemCancelRequest!: () => void;
  const itemCancelRequestGate = new Promise<void>((resolve) => {
    releaseItemCancelRequest = resolve;
  });
  await page.route(
    /\/events$/,
    async (route) => {
      await itemCancelRequestGate;
      await route.continue();
    },
    { times: 1 },
  );
  const cancelEventRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/events"),
  );
  const cancelEventResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/events"),
  );
  await itemCancelSubmit.click();
  await expect(itemCancelSubmit).toBeDisabled();
  await expect(
    itemCancelDialog.getByRole("button", { name: "Close" }).first(),
  ).toBeDisabled();
  releaseItemCancelRequest();
  const recordedCancelEventRequest = await cancelEventRequest;
  expectIdempotencyKey(
    recordedCancelEventRequest.headers()["idempotency-key"],
  );
  expect(recordedCancelEventRequest.headers()["idempotency-key"]).toBe(
    failedItemCancelKey,
  );
  expect(recordedCancelEventRequest.postDataJSON()).toEqual({
    eventType: "CANCELLED",
    reasonCode: "OTHER",
    note: itemCancellationNote,
  });
  await cancelEventResponse;
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    detailSheet.getByText("Completed", { exact: true }).first(),
  ).toBeVisible();
  await detailSheet
    .getByRole("button", { name: "Treatment history" })
    .last()
    .click();
  await expect(
    detailSheet.getByText("Reason: Other", { exact: true }),
  ).toBeVisible();
  await expect(
    detailSheet.getByText(itemCancellationNote, { exact: true }),
  ).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "Start" })).toHaveCount(
    0,
  );
  await expect(
    detailSheet.getByRole("button", { name: "Complete" }),
  ).toHaveCount(0);
  await expect(
    detailSheet.getByRole("button", { name: "Cancel item" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    firstItemCard.getByRole("button", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    firstItemCard.getByRole("button", { name: "Progress", exact: true }),
  ).toHaveCount(0);
  await expect(
    firstItemCard.getByRole("button", { name: "Complete", exact: true }),
  ).toHaveCount(0);
  await expect(
    firstItemCard.getByRole("button", { name: "More actions", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await detailSheet
    .getByRole("button", { name: "Treatment history" })
    .first()
    .click();
  await expect(
    detailSheet.getByRole("button", { name: "Hide history" }).first(),
  ).toBeVisible();
  await detailSheet.getByRole("button", { name: "View full history" }).click();
  const historyDialog = page.getByRole("dialog", {
    name: "Treatment history",
  });
  await expect(
    historyDialog.getByRole("button", { name: "Export history" }),
  ).toBeVisible();
  await expect(
    historyDialog.getByText("Completed", { exact: true }).last(),
  ).toBeVisible();
  await historyDialog.getByRole("button", { name: "Progress note" }).click();
  await expect(
    historyDialog.getByText("Synthetic treatment progress", { exact: false }),
  ).toBeVisible();
  await expect(
    historyDialog.getByText(DENTIST_NAME, { exact: false }),
  ).toBeVisible();
  await expect(historyDialog.getByAltText("Treatment image 1")).toBeVisible();
  await historyDialog
    .getByPlaceholder("Search by content, dentist, or event type...")
    .fill("responded well");
  await expect(
    historyDialog.getByText("Synthetic treatment progress", { exact: false }),
  ).toBeVisible();
  await historyDialog.getByRole("button", { name: "Close" }).last().click();

  const secondCreateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/treatment-plans"),
  );
  await detailSheet.getByRole("button", { name: "Close" }).last().click();
  await page.getByRole("button", { name: "Create plan" }).click();
  await secondCreateRequest;
  await treatmentPlans.getByRole("combobox", { name: "Service" }).click();
  await page.getByRole("option").first().click();
  await treatmentPlans
    .getByRole("combobox", { name: "Planned dentist" })
    .click();
  await page.getByRole("option").first().click();
  await treatmentPlans.getByRole("button", { name: "Add to plan" }).click();
  await treatmentPlans.getByRole("button", { name: "Edit item 1" }).click();
  await treatmentPlans.getByRole("button", { name: "Update item" }).click();
  await treatmentPlans.getByRole("button", { name: "Clear all" }).click();
  const clearAllDialog = page.getByRole("alertdialog", {
    name: "Clear all treatment items?",
  });
  await expect(clearAllDialog).toBeVisible();
  await clearAllDialog.getByRole("button", { name: "Close" }).click();
  await treatmentPlans
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  const discardDialog = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: "Keep editing" }).click();
  const secondSyncRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.includes("/treatment-plans/"),
  );
  const secondProposeRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/propose"),
  );
  await treatmentPlans
    .getByRole("button", { name: "Create treatment plan" })
    .click();
  await Promise.all([secondSyncRequest, secondProposeRequest]);
  await expect(page).toHaveURL(/\/visit\?date=.*&tab=treatment-plans$/);
  await page
    .getByRole("row")
    .filter({ hasText: "Proposed" })
    .getByRole("button", { name: "View details" })
    .click();
  const proposedSheet = page.getByRole("dialog", { name: /Plan details/ });
  await proposedSheet
    .getByRole("button", { name: "Cancel plan", exact: true })
    .click();
  const proposedCancelDialog = page.getByRole("dialog", {
    name: "Cancel treatment plan",
  });
  await expect(proposedCancelDialog.getByRole("radio")).toHaveCount(6);
  await expect(
    proposedCancelDialog.getByRole("radio", { name: /Patient request/ }),
  ).toBeChecked();
  await proposedCancelDialog
    .getByRole("button", { name: "Close" })
    .last()
    .click();

  await proposedSheet.getByRole("button", { name: "Reopen" }).click();
  const reopenDialog = page.getByRole("dialog", {
    name: "Reopen treatment plan",
  });
  await reopenDialog.getByLabel("Reason code").fill("PATIENT_REQUEST");
  const reopenRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/reopen"),
  );
  await reopenDialog
    .getByRole("button", { name: "Reopen", exact: true })
    .click();
  expectIdempotencyKey((await reopenRequest).headers()["idempotency-key"]);

  await treatmentPlans.getByRole("button", { name: "Cancel plan" }).click();
  const cancelDialog = page.getByRole("dialog", {
    name: "Cancel treatment plan",
  });
  await expect(cancelDialog.getByRole("radio")).toHaveCount(6);
  await expect(
    cancelDialog.getByRole("radio", { name: /Patient request/ }),
  ).toBeChecked();
  await cancelDialog.getByText("Other", { exact: true }).click();
  const cancellationNote = "Synthetic browser cancellation note.";
  const cancellationNoteInput = cancelDialog.getByLabel(/Additional note/);
  await expect(
    cancelDialog.getByRole("button", { name: "Cancel plan", exact: true }),
  ).toBeDisabled();
  await expect(cancelDialog.getByText("0/500", { exact: true })).toBeVisible();
  await cancellationNoteInput.fill(cancellationNote);
  await expect(
    cancelDialog.getByText(`${cancellationNote.length}/500`, { exact: true }),
  ).toBeVisible();

  let releaseCancelRequest!: () => void;
  const cancelRequestGate = new Promise<void>((resolve) => {
    releaseCancelRequest = resolve;
  });
  await page.route(
    /\/cancel$/,
    async (route) => {
      await cancelRequestGate;
      await route.continue();
    },
    { times: 1 },
  );
  const cancelRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/cancel"),
  );
  const cancelResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/cancel"),
  );
  const cancelSubmit = cancelDialog.locator('button[type="submit"]');
  await cancelSubmit.click();
  await expect(cancelSubmit).toBeDisabled();
  await expect(
    cancelDialog.getByRole("button", { name: "Close" }).first(),
  ).toBeDisabled();
  releaseCancelRequest();
  const recordedCancelRequest = await cancelRequest;
  expectIdempotencyKey(recordedCancelRequest.headers()["idempotency-key"]);
  expect(recordedCancelRequest.postDataJSON()).toEqual({
    reasonCode: "OTHER",
    note: cancellationNote,
  });
  await cancelResponse;
  await expect(
    treatmentPlans.getByText("Cancelled", { exact: true }).last(),
  ).toBeVisible();
  await treatmentPlans
    .getByRole("button", { name: "Treatment history" })
    .first()
    .click();
  await expect(
    treatmentPlans.getByText("Reason: Other", { exact: true }),
  ).toBeVisible();
  await expect(
    treatmentPlans.getByText(cancellationNote, { exact: true }),
  ).toBeVisible();
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
  await grantDialog
    .getByText("BrightSmile Test Central", { exact: true })
    .click();
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
  await page.goto(
    `${APPOINTMENTS_WORKSPACE}?view=list&date=${APPOINTMENT_DATE}`,
  );
  await page.getByRole("button", { name: "Create appointment" }).click();
  const appointmentDialog = page.getByRole("dialog", {
    name: "Create appointment",
  });
  await appointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const patientDialog = page.getByRole("dialog", { name: "Add patient" });
  await patientDialog.getByLabel("Full name").fill("Synthetic Visit Patient");
  await patientDialog.getByLabel("Phone number").fill("0909999933");
  await patientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await patientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(patientDialog).toHaveCount(0);

  await setAppointmentTime(
    page,
    appointmentDialog,
    APPOINTMENT_DATE,
    "09:00",
    "09:30",
  );
  await appointmentDialog
    .getByLabel("Visit reason")
    .fill("Synthetic Visit reason");
  await appointmentDialog.getByLabel("Dentist").click();
  await page.getByRole("option", { name: DENTIST_NAME, exact: true }).click();
  await appointmentDialog
    .getByRole("button", { name: "Create appointment" })
    .click();
  await expect(appointmentDialog).toHaveCount(0);

  await page.getByRole("button", { name: "View details" }).click();
  const detailSheet = page.getByRole("dialog", { name: "Appointment details" });
  await detailSheet.getByRole("button", { name: "Confirm" }).click();
  const confirmDialog = page.getByRole("dialog", {
    name: "Confirm appointment?",
  });
  await confirmDialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(confirmDialog).toHaveCount(0);

  await page.getByRole("button", { name: "View details" }).click();
  const checkedInDetail = page.getByRole("dialog", {
    name: "Appointment details",
  });
  await checkedInDetail.getByRole("button", { name: "Check in" }).click();
  const checkInDialog = page.getByRole("dialog", { name: "Check in patient?" });
  await checkInDialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(checkInDialog).toHaveCount(0);

  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Synthetic Visit Patient", { exact: true }),
  ).toBeVisible();
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
  await page
    .getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ })
    .click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
