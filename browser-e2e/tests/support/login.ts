import { expect, type Page } from "@playwright/test";

export const E2E_USER = {
  email: "e2e.user@dentflow.test",
  password: "synthetic-e2e-password",
};

export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(E2E_USER.email);
  await page.locator('input[name="password"]').fill(E2E_USER.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/patients$/);
}
