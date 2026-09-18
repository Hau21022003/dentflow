import { expect, test } from "@playwright/test";

import { CAT_AVATAR_JPEG_FILE } from "./fixtures/images";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

const TENANT_SLUG = "test-brightsmile";
const BRANCH_SLUG = "central";
const minioOrigin = "http://127.0.0.1:9000";

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test("uploads the cat avatar JPEG directly to MinIO using a presigned POST", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto(
    `/workspace/${TENANT_SLUG}/branches/${BRANCH_SLUG}/upload-test`,
  );

  await expect(
    page.getByRole("heading", { name: "Kiểm tra upload ảnh tạm" }),
  ).toBeVisible();

  await page.getByLabel("Ảnh kiểm thử").setInputFiles(CAT_AVATAR_JPEG_FILE);

  const storageResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "POST" &&
      response.url().startsWith(`${minioOrigin}/dentflow-uploads`)
    );
  });
  await page.getByRole("button", { name: "Upload ảnh tạm" }).click();

  expect((await storageResponse).status()).toBe(204);
  await expect(page.getByText("Upload MinIO thành công.")).toBeVisible();
  await expect(page.getByTestId("upload-object-key")).toHaveText(
    /^temp\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]{36}\.jpg$/i,
  );
});
