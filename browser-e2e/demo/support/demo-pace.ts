import type { Page } from "@playwright/test";

export type DemoPaceName = "low" | "medium";
export type DemoHold = "caption" | "result" | "transition" | "cursorStep" | "clickPulse";

export type DemoPace = {
  name: DemoPaceName;
  caption: number;
  result: number;
  transition: number;
  cursorStep: number;
  clickPulse: number;
  typingDelay: number;
};

const paceDurations: Record<DemoPaceName, Omit<DemoPace, "name">> = {
  low: {
    caption: 300,
    result: 450,
    transition: 650,
    cursorStep: 24,
    clickPulse: 120,
    typingDelay: 45,
  },
  medium: {
    caption: 700,
    result: 900,
    transition: 1_300,
    cursorStep: 42,
    clickPulse: 180,
    typingDelay: 90,
  },
};

function resolveDemoPace(value: string | undefined): DemoPace {
  const name = value ?? "medium";
  if (name !== "low" && name !== "medium") {
    throw new Error('DEMO_PACE must be either "low" or "medium".');
  }

  return { name, ...paceDurations[name] };
}

/** Resolved during test discovery so an invalid environment fails before recording. */
export const demoPace = resolveDemoPace(process.env.DEMO_PACE);

/**
 * The only raw Playwright timeout used by demo infrastructure. Specs must wait
 * for their real UI/network state before asking the narrator for a visual hold.
 */
export async function holdDemo(page: Page, hold: DemoHold): Promise<void> {
  await page.waitForTimeout(demoPace[hold]);
}
