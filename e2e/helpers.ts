import { expect, type Page } from "@playwright/test";

export const SCENE_KEY = "rassam-scene-v1";
export const LIBRARY_KEY = "rassam-library-v1";
export const CANVAS = "canvas.rassam-canvas";

/** 1x1 red PNG used for the image tool tests. */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export function tinyPngBuffer(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, "base64");
}

/**
 * Boot the app in a hermetic state:
 *  - blocks the service worker (avoids stale-asset caching between runs)
 *  - stubs external Google Fonts (the app self-hosts via @fontsource)
 *  - clears localStorage so every test starts from an empty board
 */
export async function boot(
  page: Page,
  options: { clear?: boolean; hash?: string } = {},
): Promise<void> {
  const { clear = true, hash = "" } = options;

  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("**/sw.js", (route) => route.abort());

  await page.goto(`/${hash}`);
  if (clear) {
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  }
  await expect(page.locator(CANVAS)).toBeVisible();
}

export type SceneElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  rotation?: number;
  locked?: boolean;
  groupIds?: string[];
  label?: string;
  text?: string;
  link?: string;
  fill?: string;
  elbow?: boolean;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
};

export type Scene = {
  elements: SceneElement[];
  viewport: { scrollX: number; scrollY: number; zoom: number };
  files?: Record<string, unknown>;
};

export async function readScene(page: Page): Promise<Scene | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SCENE_KEY);
}

export async function elements(page: Page): Promise<SceneElement[]> {
  const scene = await readScene(page);
  return scene?.elements ?? [];
}

export async function elementCount(page: Page): Promise<number> {
  return (await elements(page)).length;
}

/** Wait until the debounced autosave has flushed N elements. */
export async function waitForCount(page: Page, n: number): Promise<void> {
  await expect
    .poll(async () => elementCount(page), { timeout: 10_000, intervals: [100, 200, 400] })
    .toBe(n);
}

export async function waitForScene(
  page: Page,
  predicate: (scene: Scene) => boolean,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const scene = await readScene(page);
        return scene ? predicate(scene as Scene) : false;
      },
      { timeout: 10_000, intervals: [100, 200, 400] },
    )
    .toBe(true);
}
export function tool(page: Page, name: string) {
  return page.locator(`.rassam-tool[data-tool="${name}"]`);
}

export async function pickTool(page: Page, name: string): Promise<void> {
  await tool(page, name).click();
  await expect(tool(page, name)).toHaveAttribute("aria-pressed", "true");
}

export async function canvasBox(page: Page) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) {
    throw new Error("canvas has no bounding box");
  }
  return box;
}

/** Scene coords -> page coords (accounting for the saved viewport). */
export async function sceneToClient(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = await canvasBox(page);
  const scene = await readScene(page);
  const vp = scene?.viewport ?? { scrollX: 0, scrollY: 0, zoom: 1 };
  return {
    x: box.x + (x - vp.scrollX) * vp.zoom,
    y: box.y + (y - vp.scrollY) * vp.zoom,
  };
}

export async function drawShape(
  page: Page,
  toolName: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { steps?: number } = {},
): Promise<void> {
  await pickTool(page, toolName);
  const box = await canvasBox(page);
  const start = { x: box.x + from.x, y: box.y + from.y };
  const end = { x: box.x + to.x, y: box.y + to.y };
  // Split the gesture: pointer capture serialises drags, so settle the
  // press first, then move in one trusted sweep (avoids dropped mid-steps).
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  const steps = opts.steps ?? 8;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / steps,
      start.y + ((end.y - start.y) * i) / steps,
    );
  }
  await page.waitForTimeout(60);
  await page.mouse.up();
}

export async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + x, box.y + y);
}

export async function dragCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
}

export function metaText(page: Page) {
  return page.locator(".rassam-meta");
}

/** Element count as rendered in the top bar (UI truth, not localStorage). */
export async function uiElementCount(page: Page): Promise<number> {
  const text = (await metaText(page).innerText()) || "";
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** "12 عناصر · 3 محدد · 100%" -> selection count (0 when nothing is selected). */
export async function uiSelectedCount(page: Page): Promise<number> {
  const text = (await metaText(page).innerText()) || "";
  const match = text.match(/(\d+)\s*(محدد|selected)/);
  return match ? Number(match[1]) : 0;
}

export async function expectSelected(page: Page, n: number): Promise<void> {
  await expect.poll(async () => uiSelectedCount(page), { timeout: 8_000 }).toBe(n);
}

export async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `e2e/artifacts/screens/${name}.png`, fullPage: false });
}

export async function clearBoard(page: Page): Promise<void> {
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: /مسح اللوحة|Clear board/ }).click();
  await waitForCount(page, 0);
}

export type SeededElement = Record<string, unknown> & { id: string; type: string; x: number; y: number };

export function textElement(id: string, x: number, y: number, text: string): SeededElement {
  return {
    id,
    type: "text",
    x,
    y,
    stroke: "#0F172A",
    fill: "transparent",
    strokeWidth: 2,
    opacity: 1,
    seed: 7,
    text,
    fontSize: 20,
    fontFamily: "Cairo, 'Noto Naskh Arabic', 'Segoe UI', sans-serif",
    width: Math.max(60, text.length * 11),
    height: 27,
  };
}

export function rectElement(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
): SeededElement {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width,
    height,
    stroke: "#0F172A",
    fill: "#DBEAFE",
    strokeWidth: 2,
    opacity: 1,
    seed: 9,
    ...extra,
  };
}

export function frameElement(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  name = "إطار",
): SeededElement {
  return {
    id,
    type: "frame",
    x,
    y,
    width,
    height,
    stroke: "#2563EB",
    fill: "transparent",
    strokeWidth: 1,
    opacity: 1,
    seed: 11,
    name,
  };
}

/** Seed a scene through localStorage (the same shape the app autosaves). */
export async function importScene(
  page: Page,
  seed: SeededElement[],
  viewport = { scrollX: 0, scrollY: 0, zoom: 1 },
): Promise<void> {
  await page.evaluate(
    ({ elements, vp }) => {
      localStorage.setItem(
        "rassam-scene-v1",
        JSON.stringify({
          type: "rassam-scene",
          version: 1,
          elements,
          viewport: vp,
          files: {},
        }),
      );
    },
    { elements: seed, vp: viewport },
  );
  await page.reload();
  await expect(page.locator(CANVAS)).toBeVisible();
  await expect
    .poll(async () => elementCount(page), { timeout: 10_000 })
    .toBe(seed.length);
}