import { expect, type Page } from "@playwright/test";

type E2EUser = {
  email: string;
  password: string;
};

export const E2E_USERS = {
  platformAdmin: {
    email: "platform.admin@dentflow.test",
    password: "12345",
  },
  tenantAdmin: {
    email: "e2e.user@dentflow.test",
    password: "12345",
  },
  branchAdminReceptionist: {
    email: "branch.admin@dentflow.test",
    password: "12345",
  },
  dentist: {
    email: "dentist@dentflow.test",
    password: "12345",
  },
} satisfies Record<string, E2EUser>;

export async function submitLogin(page: Page, user: E2EUser): Promise<void> {
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function login(
  page: Page,
  user: E2EUser = E2E_USERS.tenantAdmin,
): Promise<void> {
  await page.goto("/login");
  await submitLogin(page, user);
}
