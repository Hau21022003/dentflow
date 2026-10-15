import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Route,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const API_URL = "http://127.0.0.1:3001";
const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const PATIENTS_ROUTE = `/tenants/${TENANT_SLUG}/branches/${BRANCH_SLUG}/patients`;
const PATIENTS_WORKSPACE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/patients`;

type MockVisit = {
  id: string;
  appointmentId: string;
  status: "OPEN" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  dentist: { id: string; fullName: string };
  operatory: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  diagnosisSummary: string | null;
};

const DENTISTS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    fullName: "Dr. Synthetic Alpha",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    fullName: "Dr. Synthetic Beta",
  },
];

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Patient Visits keeps URL history, sends server filters, paginates, and stays responsive", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  const patient = await createPatient(request, "Synthetic Visits Tab Patient");
  const visits = createMockVisits(25);
  const requestedUrls: URL[] = [];
  let releaseInitialRequest!: () => void;
  const initialRequestGate = new Promise<void>((resolve) => {
    releaseInitialRequest = resolve;
  });
  let isInitialRequest = true;

  await page.route(patientVisitsPattern(patient.id), async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url);
    if (isInitialRequest) {
      isInitialRequest = false;
      await initialRequestGate;
    }
    await fulfillVisits(route, url, visits);
  });

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  const detailPath = `${PATIENTS_WORKSPACE}/${patient.id}`;
  await page.goto(`${detailPath}?tab=not-a-tab`);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("tab", { name: "Visits" }).click();
  await expect(page).toHaveURL(`${detailPath}?tab=visits`);
  await expect(page.locator(".animate-pulse").first()).toBeVisible();
  releaseInitialRequest();

  await expect(page.getByText("Visit history", { exact: true })).toBeVisible();
  await expect(page.getByText("Total visits")).toBeVisible();
  await expect(page.getByText("25", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Synthetic diagnosis 25").first()).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  await page.getByRole("tab", { name: "Appointments" }).click();
  await expect(page).toHaveURL(`${detailPath}?tab=appointments`);
  await page.goBack();
  await expect(page).toHaveURL(`${detailPath}?tab=visits`);
  await expect(page.getByRole("tab", { name: "Visits" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect.poll(() => latestParam(requestedUrls, "page")).toBe("2");
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({ page: "1", status: "COMPLETED" });
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText(
    "All statuses",
  );
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  const rowsPerPage = page
    .getByText("Rows per page", { exact: true })
    .locator("xpath=..")
    .getByRole("combobox");
  await rowsPerPage.click();
  await page.getByRole("option", { name: "50", exact: true }).click();
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({
      page: "1",
      limit: "50",
    });
  await expect(page.getByText("Page 1 of 1")).toBeVisible();

  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({
      page: "1",
      status: "COMPLETED",
    });

  await page.getByRole("combobox", { name: "Dentist" }).click();
  await page
    .getByRole("option", { name: DENTISTS[1].fullName, exact: true })
    .click();
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({
      page: "1",
      dentistUserId: DENTISTS[1].id,
    });

  await selectDateRange(page, {
    fromDay: "Saturday, January 10th, 2026",
    month: "0",
    toDay: "Tuesday, January 20th, 2026",
    year: "2026",
  });
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({ page: "1" });
  await expect.poll(() => latestParam(requestedUrls, "from")).not.toBeNull();
  await expect.poll(() => latestParam(requestedUrls, "to")).not.toBeNull();
  const inclusiveToBoundary = new Date(latestParam(requestedUrls, "to")!);
  expect(inclusiveToBoundary.toISOString()).toBe("2026-01-20T17:00:00.000Z");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText(
    "All statuses",
  );
  await rowsPerPage.click();
  await page.getByRole("option", { name: "20", exact: true }).click();
  await expect(rowsPerPage).toContainText("20");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page
    .getByRole("columnheader", { name: /Visit date/ })
    .getByRole("button", { name: "Toggle sort options" })
    .click();
  await page.getByRole("menuitem", { name: "Oldest first" }).click();
  await expect
    .poll(() => latestQuery(requestedUrls))
    .toMatchObject({
      page: "1",
      sortOrder: "ASC",
    });

  await selectDateRange(page, {
    fromDay: "Monday, December 1st, 2025",
    month: "11",
    toDay: "Wednesday, December 31st, 2025",
    year: "2025",
  });
  const noMatchingVisits = page.getByText("No matching visits").first();
  await expect(noMatchingVisits).toBeVisible();
  await page
    .getByText("No matching visits")
    .first()
    .locator("xpath=ancestor::*[@data-slot='empty'][1]")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(
    page.getByRole("button", { name: "Select a date range" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText(
    "All statuses",
  );
  await expect(page.getByRole("combobox", { name: "Dentist" })).toContainText(
    "All dentists",
  );
  await expect.poll(() => latestParam(requestedUrls, "sortOrder")).toBe("ASC");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  const detailTrigger = page
    .getByLabel("View details. Feature under development")
    .first();
  await expect(
    detailTrigger.getByRole("button", { name: "View details" }),
  ).toBeDisabled();
  const urlBeforeTooltip = page.url();
  await detailTrigger.focus();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Feature under development",
  );
  await expect(page).toHaveURL(urlBeforeTooltip);
  await expect(page.getByRole("button", { name: /Create visit/i })).toHaveCount(
    0,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator("[data-slot='data-table-mobile-item']").first(),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await switchToVietnamese(page);
  await expect(page.getByRole("tab", { name: "Lần khám" })).toBeVisible();
  await expect(
    page.getByText("Lịch sử lần khám", { exact: true }),
  ).toBeVisible();
});

test("Patient Visits distinguishes retryable errors from an all-history empty state", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  const patient = await createPatient(
    request,
    "Synthetic Empty Visits Patient",
  );
  let attempts = 0;

  await page.route(patientVisitsPattern(patient.id), async (route) => {
    attempts += 1;
    if (attempts <= 2) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Synthetic visit list failure" }),
      });
      return;
    }
    await fulfillVisits(route, new URL(route.request().url()), []);
  });

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(`${PATIENTS_WORKSPACE}/${patient.id}?tab=visits`);

  await expect(page.getByText("Could not load visit history")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No visits yet")).toBeVisible();
  await expect(
    page.getByText("This patient has no visits in the current branch."),
  ).toBeVisible();
  expect(attempts).toBe(3);
});

async function loginBranchActorApi(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: E2E_USERS.branchAdminReceptionist,
  });
  await expect(response).toBeOK();
}

async function createPatient(
  request: APIRequestContext,
  fullName: string,
): Promise<{ id: string; fullName: string }> {
  const response = await request.post(`${API_URL}${PATIENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      fullName,
      phone: `0908${randomUUID().replace(/\D/g, "").padEnd(6, "0").slice(0, 6)}`,
      email: null,
      gender: "OTHER",
      dateOfBirth: null,
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string; fullName: string };
}

function createMockVisits(count: number): MockVisit[] {
  return Array.from({ length: count }, (_, index) => {
    const visitNumber = index + 1;
    const startedAt = new Date(Date.UTC(2026, 0, visitNumber, 2, 0, 0));
    const dentist = DENTISTS[index % DENTISTS.length];
    const status = visitNumber % 5 === 0 ? "OPEN" : "COMPLETED";
    return {
      id: `20000000-0000-4000-8000-${String(visitNumber).padStart(12, "0")}`,
      appointmentId: `30000000-0000-4000-8000-${String(visitNumber).padStart(12, "0")}`,
      status,
      startedAt: startedAt.toISOString(),
      completedAt:
        status === "COMPLETED"
          ? new Date(startedAt.getTime() + 30 * 60_000).toISOString()
          : null,
      durationMinutes: status === "COMPLETED" ? 30 : null,
      dentist,
      operatory: {
        id: "40000000-0000-4000-8000-000000000001",
        code: "SYN-01",
        name: "Synthetic Chair 01",
        isActive: true,
      },
      diagnosisSummary: `Synthetic diagnosis ${visitNumber}`,
    };
  });
}

async function fulfillVisits(
  route: Route,
  url: URL,
  allVisits: MockVisit[],
): Promise<void> {
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const status = url.searchParams.get("status");
  const dentistUserId = url.searchParams.get("dentistUserId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const sortOrder = url.searchParams.get("sortOrder") ?? "DESC";
  let filtered = allVisits.filter((visit) => {
    if (status && visit.status !== status) return false;
    if (dentistUserId && visit.dentist.id !== dentistUserId) return false;
    if (from && (!visit.startedAt || visit.startedAt < from)) return false;
    if (to && (!visit.startedAt || visit.startedAt >= to)) return false;
    return true;
  });
  filtered = [...filtered].sort((left, right) => {
    const comparison = (left.startedAt ?? "").localeCompare(
      right.startedAt ?? "",
    );
    return sortOrder === "ASC" ? comparison : -comparison;
  });
  const items = filtered.slice((page - 1) * limit, page * limit);
  const completed = allVisits.filter(
    (visit) => visit.status === "COMPLETED",
  ).length;

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items,
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      summary: {
        total: allVisits.length,
        completed,
        inProgress: allVisits.length - completed,
      },
      filterOptions: { dentists: DENTISTS },
    }),
  });
}

function patientVisitsPattern(patientId: string): RegExp {
  return new RegExp(`/patients/${patientId}/visits(?:\\?.*)?$`);
}

function latestParam(urls: URL[], name: string): string | null {
  return urls.at(-1)?.searchParams.get(name) ?? null;
}

function latestQuery(urls: URL[]): Record<string, string> {
  return Object.fromEntries(urls.at(-1)?.searchParams.entries() ?? []);
}

async function selectDateRange(
  page: Page,
  range: {
    fromDay: string;
    month: string;
    toDay: string;
    year: string;
  },
): Promise<void> {
  await page
    .getByRole("button", { name: "Select a date range" })
    .click();
  const calendar = page.locator("[data-slot='calendar']");
  await calendar
    .getByRole("combobox", { name: "Choose the Year" })
    .selectOption(range.year);
  await calendar
    .getByRole("combobox", { name: "Choose the Month" })
    .selectOption(range.month);
  await calendar.getByRole("button", { name: range.fromDay }).click();
  await calendar.getByRole("button", { name: range.toDay }).click();
  await page.keyboard.press("Escape");
}

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function switchToVietnamese(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", { name: "Select language" });
  await selector.click();
  await page.getByRole("option", { name: "VI", exact: true }).click();
}
