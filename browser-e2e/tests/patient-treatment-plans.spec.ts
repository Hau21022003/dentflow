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
const PATIENTS_WORKSPACE =
  `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/reception/patients`;

type MockPlan = {
  id: string;
  code: string;
  status:
    | "DRAFT"
    | "PROPOSED"
    | "ACCEPTED"
    | "PARTIALLY_COMPLETED"
    | "COMPLETED"
    | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  originVisit: { id: string; startedAt: string };
  primaryItem: {
    serviceName: string;
    indication: string | null;
    toothPosition: string | null;
  } | null;
  plannedDentists: Array<{ id: string; fullName: string }>;
  progress: { completedItems: number; totalItems: number };
  totals: Array<{ currency: string; amount: number }>;
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

test("Patient Treatment plans uses server filters, pagination, URL detail, and stays read-only", async ({
  page,
  request,
}) => {
  await loginBranchActorApi(request);
  const patient = await createPatient(request);
  const plans = createMockPlans(25);
  const requestedUrls: URL[] = [];

  await page.route(patientTreatmentPlansPattern(patient.id), async (route) => {
    const url = new URL(route.request().url());
    requestedUrls.push(url);
    await fulfillPlans(route, url, plans);
  });
  await page.route(patientTreatmentPlanDetailPattern(patient.id), async (route) => {
    const planId = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const plan = plans.find((candidate) => candidate.id === planId)!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: plan.id,
        code: plan.code,
        patientId: patient.id,
        originVisitId: plan.originVisit.id,
        status: plan.status,
        acceptedAt: null,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        items: [
          {
            id: "50000000-0000-4000-8000-000000000001",
            service: {
              id: "60000000-0000-4000-8000-000000000001",
              code: "synthetic-treatment",
              name: plan.primaryItem?.serviceName ?? "Synthetic treatment",
            },
            listUnitAmount: 3500000,
            finalUnitAmount: 3000000,
            discountAmount: 500000,
            currency: "VND",
            quantity: 2,
            toothPosition: "46",
            indication: "Synthetic detail indication",
            status: "PENDING",
            plannedDentist: DENTISTS[0],
          },
        ],
      }),
    });
  });

  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  const detailPath = `${PATIENTS_WORKSPACE}/${patient.id}`;
  await page.goto(detailPath);

  await page.getByRole("tab", { name: "Treatment plans" }).click();
  await expect(page).toHaveURL(`${detailPath}?tab=treatment-plans`);
  await expect(page.getByText("Treatment plan service 25").first()).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByPlaceholder(/Search plan code/)).toBeVisible();
  await expect(page.getByText("Date range", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Create/ })).toHaveCount(0);

  await page.getByPlaceholder(/Search plan code/).fill("needle");
  await expect
    .poll(() => requestedUrls.at(-1)?.searchParams.get("search"))
    .toBe("needle");
  await expect(
    page.getByText("Synthetic needle indication").first(),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "All statuses" }).click();
  await page.getByRole("option", { name: "Proposed", exact: true }).click();
  await expect
    .poll(() => requestedUrls.at(-1)?.searchParams.get("status"))
    .toBe("PROPOSED");

  await page.getByRole("combobox", { name: "All dentists" }).click();
  await page
    .getByRole("option", { name: DENTISTS[0].fullName, exact: true })
    .click();
  await expect
    .poll(() => requestedUrls.at(-1)?.searchParams.get("dentistUserId"))
    .toBe(DENTISTS[0].id);
  expect(requestedUrls.at(-1)?.searchParams.has("from")).toBe(false);
  expect(requestedUrls.at(-1)?.searchParams.has("to")).toBe(false);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByPlaceholder(/Search plan code/)).toHaveValue("");
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect
    .poll(() => requestedUrls.at(-1)?.searchParams.get("page"))
    .toBe("2");

  await page.getByRole("button", { name: "Go to first page" }).click();
  await page.getByRole("button", { name: "View details" }).first().click();
  await expect(page).toHaveURL(/tab=treatment-plans&planId=[0-9a-f-]+$/);
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Treatment plan details");
  await expect(sheet).toContainText("Synthetic detail indication");
  await expect(sheet).toContainText("6,000,000");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(`${detailPath}?tab=treatment-plans`);

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Treatment plans" }),
  ).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 390, height: 844 });
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

async function createPatient(request: APIRequestContext): Promise<{
  id: string;
  fullName: string;
}> {
  const response = await request.post(`${API_URL}${PATIENTS_ROUTE}`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      fullName: "Synthetic Treatment Plan Tab Patient",
      phone: "0908800042",
      email: "treatment.plan.tab@example.test",
      gender: "OTHER",
      dateOfBirth: "1990-04-20",
    },
  });
  await expect(response).toBeOK();
  return (await response.json()) as { id: string; fullName: string };
}

function createMockPlans(count: number): MockPlan[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const dentist = DENTISTS[index % DENTISTS.length];
    const createdAt = new Date(Date.UTC(2026, 0, number, 2, 0, 0));
    return {
      id: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
      code: `TP-${String(number).padStart(4, "0")}`,
      status: number === 25 ? "PROPOSED" : number % 5 === 0 ? "COMPLETED" : "ACCEPTED",
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      originVisit: {
        id: `30000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
        startedAt: createdAt.toISOString(),
      },
      primaryItem: {
        serviceName: `Treatment plan service ${number}`,
        indication:
          number === 25
            ? "Synthetic needle indication"
            : `Synthetic indication ${number}`,
        toothPosition: String(10 + number),
      },
      plannedDentists: [dentist],
      progress: { completedItems: number % 3, totalItems: 3 },
      totals: [{ currency: "VND", amount: number * 100000 }],
    };
  });
}

async function fulfillPlans(
  route: Route,
  url: URL,
  allPlans: MockPlan[],
): Promise<void> {
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const search = url.searchParams.get("search")?.toLowerCase();
  const status = url.searchParams.get("status");
  const dentistUserId = url.searchParams.get("dentistUserId");
  const sortOrder = url.searchParams.get("sortOrder") ?? "DESC";
  let filtered = allPlans.filter((plan) => {
    if (
      search &&
      !`${plan.code} ${plan.primaryItem?.serviceName} ${plan.primaryItem?.indication}`
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
    if (status && plan.status !== status) return false;
    if (
      dentistUserId &&
      !plan.plannedDentists.some((dentist) => dentist.id === dentistUserId)
    ) {
      return false;
    }
    return true;
  });
  filtered = [...filtered].sort((left, right) => {
    const comparison = left.createdAt.localeCompare(right.createdAt);
    return sortOrder === "ASC" ? comparison : -comparison;
  });

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      items: filtered.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      filterOptions: { dentists: DENTISTS },
    }),
  });
}

function patientTreatmentPlansPattern(patientId: string): RegExp {
  return new RegExp(`/patients/${patientId}/treatment-plans(?:\\?.*)?$`);
}

function patientTreatmentPlanDetailPattern(patientId: string): RegExp {
  return new RegExp(
    `/patients/${patientId}/treatment-plans/[0-9a-f-]+(?:\\?.*)?$`,
  );
}

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
