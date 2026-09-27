import type { Locator, Page } from "@playwright/test";
import { holdDemo, demoPace } from "./demo-pace";
import {
  getDemoCursorPosition,
  setDemoCursorClickState,
  setDemoCursorPosition,
} from "./demo-overlay";

export async function moveDemoCursorTo(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Cannot move the demo cursor to an element without a bounding box.");
  }

  const destination = {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
  const origin = await getDemoCursorPosition(page);
  const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
  const steps = Math.min(10, Math.max(3, Math.ceil(distance / 100)));

  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round(origin.x + (destination.x - origin.x) * ratio);
    const y = Math.round(origin.y + (destination.y - origin.y) * ratio);
    await page.mouse.move(x, y);
    await setDemoCursorPosition(page, { x, y });
    await holdDemo(page, "cursorStep");
  }
}

export async function demoClick(page: Page, locator: Locator): Promise<void> {
  await moveDemoCursorTo(page, locator);
  await locator.click();
  await setDemoCursorClickState(page, true);
  await holdDemo(page, "clickPulse");
  await setDemoCursorClickState(page, false);
}

export async function demoType(
  page: Page,
  locator: Locator,
  value: string,
  options: { clear?: boolean } = {},
): Promise<void> {
  await moveDemoCursorTo(page, locator);
  await locator.click();
  if (options.clear ?? true) await locator.fill("");
  await locator.pressSequentially(value, { delay: demoPace.typingDelay });
}
