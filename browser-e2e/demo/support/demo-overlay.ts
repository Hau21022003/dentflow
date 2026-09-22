import type { Page } from "@playwright/test";

const overlayId = "dentflow-demo-overlay";

type CursorPosition = {
  x: number;
  y: number;
};

function mountDemoOverlay(): void {
  if (document.getElementById("dentflow-demo-overlay")) return;

  const root = document.createElement("div");
  root.id = "dentflow-demo-overlay";
  root.dataset.demoOverlay = "true";
  root.setAttribute("aria-hidden", "true");

  const style = document.createElement("style");
  style.textContent = `
    #dentflow-demo-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    #dentflow-demo-overlay [data-demo-caption] {
      position: fixed;
      left: 24px;
      bottom: 24px;
      max-width: min(620px, calc(100vw - 48px));
      padding: 12px 16px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.92);
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.32);
      color: #f8fafc;
      font: 600 16px/1.45 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.01em;
    }
    #dentflow-demo-overlay [data-demo-cursor] {
      position: fixed;
      left: -40px;
      top: -40px;
      width: 18px;
      height: 18px;
      border: 3px solid #0ea5e9;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 2px 10px rgba(2, 132, 199, 0.55);
      transform: translate(-50%, -50%);
      transition: left 24ms linear, top 24ms linear, transform 120ms ease-out;
    }
    #dentflow-demo-overlay [data-demo-cursor][data-clicking="true"] {
      transform: translate(-50%, -50%) scale(0.72);
    }
  `;

  const cursor = document.createElement("div");
  cursor.dataset.demoCursor = "true";
  cursor.dataset.x = "-40";
  cursor.dataset.y = "-40";
  cursor.dataset.visible = "false";

  const caption = document.createElement("div");
  caption.dataset.demoCaption = "true";
  caption.textContent = "DentFlow demo";

  root.append(style, cursor, caption);
  document.documentElement.append(root);
}

export async function installDemoOverlay(page: Page): Promise<void> {
  await page.addInitScript(mountDemoOverlay);
  await ensureDemoOverlay(page);
}

export async function ensureDemoOverlay(page: Page): Promise<void> {
  await page.evaluate(mountDemoOverlay);
}

export async function setDemoCaption(page: Page, caption: string): Promise<void> {
  await ensureDemoOverlay(page);
  await page.evaluate(
    ({ id, value }) => {
      const element = document.querySelector<HTMLElement>(`#${id} [data-demo-caption]`);
      if (!element) throw new Error("Demo caption overlay is unavailable.");
      element.textContent = value;
    },
    { id: overlayId, value: caption },
  );
}

export async function getDemoCursorPosition(page: Page): Promise<CursorPosition> {
  await ensureDemoOverlay(page);
  return page.evaluate((id) => {
    const element = document.querySelector<HTMLElement>(`#${id} [data-demo-cursor]`);
    if (!element) throw new Error("Demo cursor overlay is unavailable.");
    return {
      x: Number(element.dataset.x ?? "-40"),
      y: Number(element.dataset.y ?? "-40"),
    };
  }, overlayId);
}

export async function setDemoCursorPosition(
  page: Page,
  position: CursorPosition,
): Promise<void> {
  await ensureDemoOverlay(page);
  await page.evaluate(
    ({ id, x, y }) => {
      const element = document.querySelector<HTMLElement>(`#${id} [data-demo-cursor]`);
      if (!element) throw new Error("Demo cursor overlay is unavailable.");
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.dataset.x = String(x);
      element.dataset.y = String(y);
      element.dataset.visible = "true";
    },
    { id: overlayId, ...position },
  );
}

export async function setDemoCursorClickState(page: Page, clicking: boolean): Promise<void> {
  await ensureDemoOverlay(page);
  await page.evaluate(
    ({ id, value }) => {
      const element = document.querySelector<HTMLElement>(`#${id} [data-demo-cursor]`);
      if (!element) throw new Error("Demo cursor overlay is unavailable.");
      element.dataset.clicking = String(value);
    },
    { id: overlayId, value: clicking },
  );
}
