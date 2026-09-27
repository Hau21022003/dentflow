import type { Locator, Page } from "@playwright/test";
import { demoClick, demoType, moveDemoCursorTo } from "./demo-cursor";
import { holdDemo, demoPace, type DemoPaceName } from "./demo-pace";
import { setDemoCaption } from "./demo-overlay";

export type DemoNarrator = {
  readonly pace: DemoPaceName;
  step(caption: string): Promise<void>;
  holdResult(): Promise<void>;
  holdTransition(caption?: string): Promise<void>;
  moveTo(locator: Locator): Promise<void>;
  click(locator: Locator): Promise<void>;
  type(locator: Locator, value: string, options?: { clear?: boolean }): Promise<void>;
};

export function createDemoNarrator(page: Page): DemoNarrator {
  return {
    pace: demoPace.name,
    async step(caption) {
      await setDemoCaption(page, caption);
      await holdDemo(page, "caption");
    },
    async holdResult() {
      await holdDemo(page, "result");
    },
    async holdTransition(caption) {
      if (caption) await setDemoCaption(page, caption);
      await holdDemo(page, "transition");
    },
    async moveTo(locator) {
      await moveDemoCursorTo(page, locator);
    },
    async click(locator) {
      await demoClick(page, locator);
    },
    async type(locator, value, options) {
      await demoType(page, locator, value, options);
    },
  };
}
