import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

test.beforeAll(async ({ request }) => {
  await resetDatabase(request);
});

test("redirects the seeded tenant admin to its workspace home", async ({ page }) => {
  await login(page, E2E_USERS.tenantAdmin);

  await expect(page).toHaveURL(/\/workspace\/test-brightsmile\/tenant$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Workspace quản trị tenant" }),
  ).toBeVisible();
});
