import { expect, test } from "@playwright/test";
import { CAT_AVATAR_PNG_FILE } from "./fixtures/images";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const TENANT_SLUG = "test-brightsmile";
const avatarName = "Avatar E2E Tenant Admin";

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("a signed-in user updates their profile avatar and staff roster shows it", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto("/profile");

  await page.locator("#profile-avatar").setInputFiles(CAT_AVATAR_PNG_FILE);
  await page.locator("#profile-full-name").fill(avatarName);
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.locator("aside img")).toHaveCount(1);

  await page.goto(`/workspace/${TENANT_SLUG}/tenant/staff`);
  const staffRow = page.locator("tr", { hasText: avatarName });
  await expect(staffRow).toBeVisible();
  await expect(staffRow.locator("img")).toHaveCount(1);
});
