import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/database";
import { E2E_USERS, login } from "./support/login";

test.beforeAll(async ({ request }) => {
  await resetDatabase(request);
});

test("patient creation dialog validates input, confirms discard, and resets after closing", async ({
  page,
}) => {
  await login(page, E2E_USERS.tenantAdmin);
  await page.goto("/patients");
  await page.getByRole("combobox", { name: /Chọn ngôn ngữ|Select language/ }).click();
  await page.getByRole("option", { name: "VI", exact: true }).click();

  await page.getByRole("button", { name: "Thêm bệnh nhân" }).click();

  const formDialog = page.getByRole("dialog", { name: "Thêm bệnh nhân" });
  await expect(formDialog).toBeVisible();
  await expect(
    formDialog.getByText("Nhập thông tin hành chính để khởi tạo hồ sơ bệnh nhân."),
  ).toBeVisible();

  await formDialog.getByRole("button", { name: "Lưu mẫu" }).click();
  const fullNameInput = formDialog.getByLabel(/họ và tên/i);
  await expect(fullNameInput).toHaveAttribute("aria-invalid", "true");

  await fullNameInput.fill("Nguyen Thi E2E");
  await formDialog.getByRole("button", { name: "Đóng" }).click();

  const discardDialog = page.getByRole("alertdialog", { name: "Bỏ các thay đổi?" });
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole("button", { name: "Tiếp tục nhập" }).click();
  await expect(fullNameInput).toHaveValue("Nguyen Thi E2E");

  await formDialog.getByRole("button", { name: "Đóng" }).click();
  await page
    .getByRole("alertdialog", { name: "Bỏ các thay đổi?" })
    .getByRole("button", { name: "Bỏ thay đổi" })
    .click();
  await expect(formDialog).toHaveCount(0);

  await page.getByRole("button", { name: "Thêm bệnh nhân" }).click();
  await expect(page.getByRole("dialog", { name: "Thêm bệnh nhân" }).getByLabel(/họ và tên/i)).toHaveValue("");
});
