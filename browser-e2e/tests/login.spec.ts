import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { login } from "./support/login";

test.beforeAll(async ({ request }) => {
  await resetDatabase(request);
});

test("logs in with the seeded synthetic user", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
