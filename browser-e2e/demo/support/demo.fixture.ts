import { expect, test as base } from "@playwright/test";
import { resetDatabase } from "../../tests/support/database";
import { createDemoNarrator, type DemoNarrator } from "./demo-narrator";
import { installDemoOverlay } from "./demo-overlay";

type DemoFixtures = {
  demo: DemoNarrator;
};

/** Every demo gets a pristine synthetic fixture and the video-only overlay. */
export const test = base.extend<DemoFixtures>({
  demo: [
    async ({ page, request }, use) => {
      await resetDatabase(request);
      await installDemoOverlay(page);
      await use(createDemoNarrator(page));
    },
    { auto: true },
  ],
});

export { expect };
