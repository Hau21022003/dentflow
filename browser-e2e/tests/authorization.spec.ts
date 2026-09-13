import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login, submitLogin } from "./support/login";

const brightSmileSlug = "test-brightsmile";
const brightSmileCentralSlug = "central";
const brightSmileWestSlug = "west";
const harmonySlug = "test-harmony";
const harmonyCitySlug = "city";

test.beforeAll(async ({ request }) => {
  await resetDatabase(request);
});

test("platform admin reaches Platform routes and is denied a workspace route", async ({ page }) => {
  await page.goto("/platform/tenants");
  await submitLogin(page, E2E_USERS.platformAdmin);

  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { name: /Quản lý tenant|Tenant management/ }),
  ).toBeVisible();

  await page.goto(`/workspace/${brightSmileSlug}`);
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

test("tenant admin reaches tenant, branch, and staff-management pages but not Platform", async ({ page }) => {
  await login(page, E2E_USERS.tenantAdmin);

  await page.goto(`/workspace/${brightSmileSlug}/tenant/branches`);
  await expect(page.getByRole("heading", { name: /Quản lý branch|Branch management/ })).toBeVisible();

  await page.goto(`/workspace/${brightSmileSlug}/tenant/staff`);
  await expect(page.getByRole("heading", { name: /Quản lý nhân sự|Staff management/ })).toBeVisible();

  await page.goto("/platform");
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

test("combined branch-admin and receptionist roles do not receive staff management", async ({ page }) => {
  await login(page, E2E_USERS.branchAdminReceptionist);

  await expect(page).toHaveURL(
    new RegExp(`/workspace/${brightSmileSlug}/branches/${brightSmileCentralSlug}$`),
  );
  await expect(page.getByText("2 role tại branch hiện tại")).toBeVisible();
  await expect(page.getByText("Quản trị chi nhánh")).toHaveCount(0);
  await expect(page.getByText("Tiếp nhận")).toBeVisible();

  await page.goto(
    `/workspace/${brightSmileSlug}/branches/${brightSmileCentralSlug}/branch/staff`,
  );
  await expect(page).toHaveURL(new RegExp(`/workspace/${brightSmileSlug}/tenant/staff$`));
  await expect(page.getByText(/403/)).toBeVisible();

  await page.goto(
    `/workspace/${brightSmileSlug}/branches/${brightSmileCentralSlug}/reception/appointments`,
  );
  await expect(page.getByRole("heading", { name: "Quản lý lịch hẹn" })).toBeVisible();
});

test("app shell shows granted navigation, switches branch, and adapts for mobile", async ({ page }) => {
  await login(page, E2E_USERS.branchAdminReceptionist);

  await page.getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ }).click();
  await page.getByRole("option", { name: "VI", exact: true }).click();

  const navigation = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(navigation.getByRole("button", { name: "Vận hành chi nhánh" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(navigation.getByRole("link", { name: "Tổng quan chi nhánh" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "Workspace bác sĩ" })).toHaveCount(0);

  const branchSelector = page.getByRole("combobox", { name: "Chọn chi nhánh" });
  await branchSelector.click();
  await page.getByRole("option", { name: "BrightSmile Test West" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workspace/${brightSmileSlug}/branches/${brightSmileWestSlug}$`),
  );

  await page.getByRole("combobox", { name: "Chọn ngôn ngữ" }).click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
  await expect(page.getByRole("button", { name: "Branch operations" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Primary navigation" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Appointments" }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/workspace/${brightSmileSlug}/branches/${brightSmileWestSlug}/reception/appointments$`,
    ),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/workspace/${brightSmileSlug}/tenant/branches`);
  await expect(page.getByRole("combobox", { name: "Select branch" })).toHaveCount(0);
});

test("dentist can open only its doctor workspace and receives 403 for other branch functions", async ({ page }) => {
  await login(page, E2E_USERS.dentist);

  await expect(page).toHaveURL(
    new RegExp(`/workspace/${harmonySlug}/branches/${harmonyCitySlug}$`),
  );
  await page.goto(`/workspace/${harmonySlug}/branches/${harmonyCitySlug}/doctor`);
  await expect(page.getByRole("heading", { name: "Workspace bác sĩ" })).toBeVisible();

  await page.goto(
    `/workspace/${brightSmileSlug}/branches/${brightSmileCentralSlug}/reception/appointments`,
  );
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

test("a denied deep link remains a 403 after login", async ({ page }) => {
  await page.goto(
    `/workspace/${brightSmileSlug}/branches/${brightSmileCentralSlug}/branch/staff`,
  );
  await submitLogin(page, E2E_USERS.dentist);

  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});
