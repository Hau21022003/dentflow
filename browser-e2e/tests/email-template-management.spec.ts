import { expect, test, type Page } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("Platform Admin edits, drafts, publishes, and reads email template history", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/email-templates/tenant-owner-invitation");
  await selectTemplateLocale(page, "English");

  await expect(
    page.getByRole("heading", { name: "Tenant owner invitation" }),
  ).toBeVisible();
  await expect(page.getByText("Revision history")).toBeVisible();

  const plainTextBody = page.getByRole("textbox", {
    name: "Plain-text body",
  });
  await plainTextBody.fill("Use ");
  await page
    .getByRole("button", {
      name: "Insert a variable into Plain-text body",
    })
    .click();
  await page.getByRole("button", { name: "Activation link" }).click();
  await expect(plainTextBody).toHaveValue("Use {{invitationUrl}}");

  await page
    .getByRole("textbox", { name: "Subject" })
    .fill("Activate {{tenantDisplayName}}");
  await plainTextBody.fill("Use {{patientName}}");
  await page
    .getByRole("textbox", { name: "HTML body" })
    .fill("<p>{{invitationUrl}} {{expiresAt}}</p>");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByText(
      "Plain-text body uses a variable that is not available for this template.",
    ),
  ).toBeVisible();

  await plainTextBody.fill(
    "Use {{invitationUrl}} before {{expiresAt}} for {{tenantDisplayName}}.",
  );
  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().endsWith(
        "/platform/email-templates/tenant-owner-invitation/en/draft",
      ),
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saveRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish draft" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Publish draft" }).click();
  const publishDialog = page.getByRole("alertdialog", {
    name: "Publish email template?",
  });
  await expect(publishDialog).toBeVisible();
  const publishRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(
        "/platform/email-templates/tenant-owner-invitation/en/draft/publish",
      ),
  );
  await publishDialog
    .getByRole("button", { name: "Publish revision" })
    .click();
  expect((await publishRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(page.getByText("Email template published.")).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
});

test("Platform Admin directly publishes an email template without a draft", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/email-templates/tenant-owner-invitation");
  await selectTemplateLocale(page, "English");

  await page
    .getByRole("textbox", { name: "Subject" })
    .fill("Welcome to {{tenantDisplayName}}");
  await page
    .getByRole("textbox", { name: "Plain-text body" })
    .fill("Use {{invitationUrl}} before {{expiresAt}}.");
  await page
    .getByRole("textbox", { name: "HTML body" })
    .fill("<p>{{invitationUrl}} {{expiresAt}}</p>");

  await page.getByRole("button", { name: "Publish now" }).click();
  const publishDialog = page.getByRole("alertdialog", {
    name: "Publish email template?",
  });
  const directPublishRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith(
        "/platform/email-templates/tenant-owner-invitation/en/publish",
      ),
  );
  await publishDialog
    .getByRole("button", { name: "Publish revision" })
    .click();
  expect((await directPublishRequest).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(page.getByText("Email template published.")).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
});

test("retries an unchanged draft command with its original idempotency key", async ({
  page,
}) => {
  await login(page, E2E_USERS.platformAdmin);
  await switchToEnglish(page);
  await page.goto("/platform/email-templates/tenant-owner-invitation");
  await selectTemplateLocale(page, "English");

  await page
    .getByRole("textbox", { name: "Subject" })
    .fill("Activate {{tenantDisplayName}}");
  await page
    .getByRole("textbox", { name: "Plain-text body" })
    .fill("Use {{invitationUrl}} before {{expiresAt}}.");
  await page
    .getByRole("textbox", { name: "HTML body" })
    .fill("<p>{{invitationUrl}} {{expiresAt}}</p>");

  const idempotencyKeys: string[] = [];
  let shouldFail = true;
  await page.route(
    "**/platform/email-templates/tenant-owner-invitation/en/draft",
    async (route) => {
      idempotencyKeys.push(route.request().headers()["idempotency-key"] ?? "");
      if (shouldFail) {
        shouldFail = false;
        await route.fulfill({
          body: JSON.stringify({ message: "Temporary request failure." }),
          contentType: "application/json",
          status: 500,
        });
        return;
      }
      await route.continue();
    },
  );

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Temporary request failure.")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test("Tenant Admin cannot access email template management", async ({ page }) => {
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto("/platform/email-templates");
  await expect(page.getByText("403 · Không có quyền truy cập")).toBeVisible();
});

async function switchToEnglish(page: Page): Promise<void> {
  const selector = page.getByRole("combobox", {
    name: /Chọn ngôn ngữ|Select language/,
  });
  await selector.click();
  await page.getByRole("option", { name: "EN", exact: true }).click();
}

async function selectTemplateLocale(page: Page, locale: string): Promise<void> {
  await page.getByRole("tab", { name: locale, exact: true }).click();
}
