import { expect, test } from "./support/demo.fixture";

test("demo foundation renders narration and a visual cursor @demo @foundation", async ({
  page,
  demo,
}) => {
  await page.goto("/login");
  const emailField = page.locator('input[name="email"]');
  await expect(emailField).toBeVisible();

  await demo.step("DentFlow demo — nền trình diễn đã sẵn sàng");
  await expect(page.locator("[data-demo-caption]")).toHaveText(
    "DentFlow demo — nền trình diễn đã sẵn sàng",
  );

  await demo.moveTo(emailField);
  await expect(page.locator("[data-demo-cursor]")).toHaveAttribute(
    "data-visible",
    "true",
  );
});
