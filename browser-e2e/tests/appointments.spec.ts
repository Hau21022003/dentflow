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
  await patientDialog.getByLabel("Date of birth").fill("2000-01-15");
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
  const detailSheet = page.getByRole("dialog", { name: "Appointment details" });
  await expect(detailSheet).toHaveAttribute("data-side", "right");
  await expect(detailSheet).toContainText("0909999999");
  await expect(detailSheet).toContainText(/Female.*years old/);
  await expect(detailSheet.getByRole("button", { name: "Edit appointment" })).toBeVisible();
  await expect(detailSheet.getByRole("button", { name: "More options" })).toBeVisible();
  await expect(detailSheet.getByRole("link", { name: "View patient profile" })).toHaveAttribute("href", "/");
  await detailSheet.getByRole("button", { name: "More options" }).click();
  await expect(page.getByRole("menuitem", { name: "Assign dentist" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Mark no-show" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Cancel appointment" })).toBeVisible();
  await page.keyboard.press("Escape");
  await detailSheet.getByRole("button", { name: "Confirm" }).click();
  await expect(detailSheet).toHaveCount(0);
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

  const monthSummaryRequest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "GET"
      && url.pathname === `${APPOINTMENTS_ROUTE}/calendar-summary`
      && url.searchParams.get("month") === "2030-01";
  });
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await monthSummaryRequest;
  await expect(page.getByText("1 appointments", { exact: true })).toBeVisible();

  await page.locator('button[data-date="2030-01-16"]').click();
  await expect(page).toHaveURL(/view=month.*date=2030-01-16/);

  await page.getByRole("button", { name: "View day timeline" }).click();
  await expect(page).toHaveURL(/view=timeline.*date=2030-01-16/);
});

test("appointment detail omits age when the patient has no date of birth", async ({ page }) => {
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(WORKSPACE_ROUTE);

  await page.getByRole("button", { name: "Create appointment" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Create appointment" });
  await appointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const patientDialog = page.getByRole("dialog", { name: "Add patient" });
  await patientDialog.getByLabel("Full name").fill("Synthetic Patient Without DOB");
  await patientDialog.getByLabel("Phone number").fill("0909999998");
  await patientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Female", exact: true }).click();
  await patientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(patientDialog).toHaveCount(0);

  await appointmentDialog.getByLabel("Start time").fill("2030-01-16T09:00");
  await appointmentDialog.getByLabel("End time").fill("2030-01-16T09:30");
  await appointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  await expect(appointmentDialog).toHaveCount(0);

  await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2030-01-16`);
  await page.getByRole("button", { name: "View details" }).click();
  const detailSheet = page.getByRole("dialog", { name: "Appointment details" });
  await expect(detailSheet).toContainText("Female");
  await expect(detailSheet).not.toContainText(/years old/);
});

test("timeline keeps the selected day, filters a dentist column, opens its desktop detail panel, and refreshes after an action", async ({ page }) => {
  await login(page, E2E_USERS.tenantAdmin);
  await switchToEnglish(page);
  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);
  const staffRow = page.getByRole("row").filter({ hasText: E2E_USERS.branchAdminReceptionist.email });
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
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2030-01-16`);

  await page.getByRole("button", { name: "Create appointment" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Create appointment" });
  await appointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const patientDialog = page.getByRole("dialog", { name: "Add patient" });
  await patientDialog.getByLabel("Full name").fill("Synthetic Timeline Patient");
  await patientDialog.getByLabel("Phone number").fill("0909999997");
  await patientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await patientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(patientDialog).toHaveCount(0);

  await appointmentDialog.getByLabel("Start time").fill("2030-01-16T09:00");
  await appointmentDialog.getByLabel("End time").fill("2030-01-16T09:30");
  await appointmentDialog.getByLabel("Visit reason").fill("Synthetic timeline reason");
  await appointmentDialog.getByRole("combobox", { name: "Dentist" }).click();
  await page.getByRole("option", { name: "Synthetic Branch Administrator", exact: true }).click();
  await appointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  await expect(appointmentDialog).toHaveCount(0);

  await page.getByRole("button", { name: "Create appointment" }).click();
  const shortAppointmentDialog = page.getByRole("dialog", { name: "Create appointment" });
  await shortAppointmentDialog.getByRole("button", { name: "Add patient" }).click();
  const shortPatientDialog = page.getByRole("dialog", { name: "Add patient" });
  await shortPatientDialog.getByLabel("Full name").fill("Synthetic Short Timeline Patient");
  await shortPatientDialog.getByLabel("Phone number").fill("0909999996");
  await shortPatientDialog.getByLabel("Gender").click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await shortPatientDialog.getByRole("button", { name: "Add patient" }).click();
  await expect(shortPatientDialog).toHaveCount(0);
  await shortAppointmentDialog.getByLabel("Start time").fill("2030-01-16T09:30");
  await shortAppointmentDialog.getByLabel("End time").fill("2030-01-16T09:45");
  await shortAppointmentDialog.getByLabel("Visit reason").fill("Synthetic short timeline reason");
  await shortAppointmentDialog.getByRole("combobox", { name: "Dentist" }).click();
  await page.getByRole("option", { name: "Synthetic Branch Administrator", exact: true }).click();
  await shortAppointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  await expect(shortAppointmentDialog).toHaveCount(0);

  await page.goto(`${WORKSPACE_ROUTE}?view=timeline&date=2030-01-17`);
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page).toHaveURL(/view=timeline.*date=2030-01-16/);
  const timeline = page.getByTestId("appointment-timeline");
  await expect(timeline).toBeVisible();
  await expect(timeline.getByText("Synthetic Branch Administrator", { exact: true })).toBeVisible();
  await page.getByLabel("All dentists").click();
  await page.getByRole("option", { name: "Synthetic Branch Administrator", exact: true }).click();

  const timelineAppointment = timeline
    .locator('[data-appointment-id]')
    .filter({ hasText: "Synthetic Timeline Patient" });
  const shortTimelineAppointment = timeline
    .locator('[data-appointment-id]')
    .filter({ hasText: "Synthetic Short Timeline Patient" });
  await expect(timelineAppointment).toHaveClass(/bg-sky-100/);
  await expect(timelineAppointment).toContainText(/09:00/);
  await expect(shortTimelineAppointment).toContainText("Synthetic Short Timeline Patient");
  await expect(shortTimelineAppointment).not.toContainText(/09:30|09:45/);
  await timelineAppointment.click();
  const detailPanel = page.getByLabel("Appointment detail panel");
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel).toContainText("Synthetic Timeline Patient");
  await expect(page.getByRole("dialog", { name: "Appointment details" })).toHaveCount(0);

  await detailPanel.getByRole("button", { name: "Confirm" }).click();
  await expect(detailPanel).toHaveCount(0);
  const confirmDialog = page.getByRole("dialog", { name: "Confirm appointment?" });
  const confirmRequest = page.waitForRequest(
    (request) => request.method() === "POST" && /\/confirm$/.test(request.url()),
  );
  await confirmDialog.getByRole("button", { name: "Confirm action" }).click();
  await confirmRequest;
  await expect(confirmDialog).toHaveCount(0);

  await timelineAppointment.click();
  await expect(detailPanel.getByText("Confirmed", { exact: true })).toBeVisible();
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

test("appointment view switcher keeps localized labels within its bounds", async ({ page }) => {
  await login(page, E2E_USERS.branchAdminReceptionist);

  const scenarios = [
    { language: "VI", viewport: { width: 360, height: 800 }, compact: true },
    { language: "EN", viewport: { width: 360, height: 800 }, compact: true },
    { language: "VI", viewport: { width: 393, height: 852 }, compact: true },
    { language: "EN", viewport: { width: 393, height: 852 }, compact: true },
    { language: "VI", viewport: { width: 1280, height: 800 }, compact: false },
  ] as const;

  for (const scenario of scenarios) {
    await page.setViewportSize(scenario.viewport);
    await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2026-09-19`);
    await switchLanguage(page, scenario.language);

    const group = page.getByRole("group", {
      name: scenario.language === "VI" ? "Chế độ xem lịch hẹn" : "Appointment view",
    });
    const labels = scenario.language === "VI"
      ? ["Danh sách", "Dòng thời gian", "Tháng"]
      : ["List", "Timeline", "Month"];
    const buttons = labels.map((label) => page.getByRole("button", { name: label, exact: true }));

    await expect(group).toBeVisible();
    await expect.poll(() => group.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    const groupBox = await group.boundingBox();
    expect(groupBox).not.toBeNull();
    for (const button of buttons) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(groupBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(groupBox!.x + groupBox!.width + 1);
      const labelsInButton = button.locator("span");
      if (scenario.compact) {
        await expect(labelsInButton.nth(0)).toBeHidden();
        await expect(labelsInButton.nth(1)).toBeVisible();
      } else {
        await expect(labelsInButton.nth(0)).toBeVisible();
        await expect(labelsInButton.nth(1)).toBeHidden();
      }
    }

    await buttons[1].click();
    await expect(page).toHaveURL(/view=timeline/);
    await expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
  }
});

test("mobile navigation keeps its left-side Sheet", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(`${WORKSPACE_ROUTE}?view=list&date=2026-09-19`);

  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigationSheet = page.getByRole("dialog", { name: "Primary navigation" });
  await expect(navigationSheet).toHaveAttribute("data-side", "left");
  await navigationSheet.getByRole("button", { name: "Close navigation" }).click();
  await expect(navigationSheet).toHaveCount(0);
});

async function switchToEnglish(page: Page): Promise<void> {
  await switchLanguage(page, "EN");
}

async function switchLanguage(page: Page, language: "EN" | "VI"): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: language, exact: true }).click();
}
