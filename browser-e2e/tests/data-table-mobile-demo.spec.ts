import { expect, test, type Page } from "@playwright/test";

import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const DEMO_ROUTE = `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/data-table-mobile-demo`;

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("mobile DataTable supports divided and card layouts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, E2E_USERS.branchAdminReceptionist);
  await switchToEnglish(page);
  await page.goto(DEMO_ROUTE);

  await expect(
    page.getByRole("heading", { name: "DataTable mobile renderer" }),
  ).toBeVisible();
  // React Query Devtools only renders in Vite development mode and otherwise
  // covers the bottom pagination controls on narrow viewports.
  await page
    .locator(".tsqd-parent-container")
    .evaluateAll((elements) => elements.forEach((element) => element.remove()));

  const dividedSection = page.getByTestId("data-table-demo-divided");
  const cardsSection = page.getByTestId("data-table-demo-cards");
  const dividedTable = dividedSection.getByRole("table");
  const cardsTable = cardsSection.getByRole("table");
  const dividedRecordTwelve = page.getByTestId(
    "data-table-demo-divided-item-demo-record-12",
  );
  const cardRecordOne = page.getByTestId(
    "data-table-demo-card-item-demo-record-1",
  );
  await expect(dividedTable).toBeVisible();
  await expect(cardsTable).toBeVisible();
  await expect(dividedRecordTwelve).toBeHidden();
  await expect(cardRecordOne).toBeHidden();

  const sequenceHeader = dividedTable.getByRole("columnheader", {
    name: "Sequence",
  });
  await sequenceHeader
    .getByRole("button", { name: "Toggle sort options" })
    .click();
  await page.getByRole("menuitem", { name: "Sort descending" }).click();

  await page.setViewportSize({ width: 393, height: 852 });
  await expect(dividedTable).toBeHidden();
  await expect(cardsTable).toBeHidden();
  await expect(dividedRecordTwelve).toBeVisible();
  await expect(dividedRecordTwelve).toHaveAttribute("data-index", "0");
  await expect(cardRecordOne).toBeVisible();

  const dividedMobileList = dividedSection.locator(
    '[data-slot="data-table-mobile-list"]',
  );
  const cardsMobileList = cardsSection.locator(
    '[data-slot="data-table-mobile-list"]',
  );
  await expect(dividedMobileList).toHaveClass(/divide-y/);
  await expect(cardsMobileList).toHaveClass(/space-y-3/);

  await dividedSection
    .getByRole("button", { name: "Go to next page" })
    .click();
  const dividedRecordSeven = page.getByTestId(
    "data-table-demo-divided-item-demo-record-7",
  );
  await expect(dividedRecordSeven).toBeVisible();
  await expect(dividedRecordSeven).toHaveAttribute("data-index", "0");

  await dividedRecordSeven.click();
  await expect(page.getByTestId("data-table-demo-last-clicked")).toHaveText(
    "Last clicked: DF-007",
  );

  await dividedSection
    .getByRole("button", { name: "Go to previous page" })
    .click();
  await dividedSection
    .getByPlaceholder("Search demo records...")
    .fill("DF-011");
  const dividedRecordEleven = page.getByTestId(
    "data-table-demo-divided-item-demo-record-11",
  );
  await expect(dividedRecordEleven).toBeVisible();
  await expect(dividedRecordTwelve).toHaveCount(0);

  await dividedSection
    .getByPlaceholder("Search demo records...")
    .fill("no-match");
  await expect(
    dividedMobileList.getByText("No results", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Toggle loading" }).click();
  await expect(dividedMobileList).toHaveAttribute("aria-busy", "true");
  await page.getByRole("button", { name: "Toggle loading" }).click();
  await expect(dividedMobileList).not.toHaveAttribute("aria-busy", "true");

  await page
    .getByRole("button", { name: "Toggle refresh overlay" })
    .click();
  await expect(
    dividedSection.locator('[data-slot="data-table-mobile-fetching-overlay"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle refresh overlay" })
    .click();
  await expect(
    dividedSection.locator('[data-slot="data-table-mobile-fetching-overlay"]'),
  ).toHaveCount(0);
});

async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: "Select language" }).click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}
