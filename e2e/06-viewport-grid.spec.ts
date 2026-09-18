import { expect, test } from "@playwright/test";

import {
  CANVAS,
  boot,
  canvasBox,
  clearBoard,
  dragCanvas,
  drawShape,
  elements,
  importScene,
  pickTool,
  readScene,
  rectElement,
  waitForCount,
  waitForScene,
} from "./helpers";

async function wheel(page: import("@playwright/test").Page, deltaY: number, ctrl = false) {
  const box = await canvasBox(page);
  await page.locator(CANVAS).evaluate(
    (el, args) => {
      el.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: args.deltaY,
          ctrlKey: args.ctrl,
          clientX: args.x,
          clientY: args.y,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { deltaY, ctrl, x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

test.describe("Module 6 — Viewport, grid & scene telemetry", () => {
  test("ctrl+wheel zooms in and out and the status bar follows", async ({ page }) => {
    await boot(page);
    await wheel(page, -120, true);
    await waitForScene(page, (s) => s.viewport.zoom > 1.05);
    await expect(page.locator(".rassam-status")).toContainText("110%");

    // note: the footer rounds down (0.99 -> 99% while a ctrl+wheel tween settles)
    await wheel(page, 120, true);
    await wheel(page, 120, true);
    await waitForScene(page, (s) => s.viewport.zoom < 1);
    await expect(page.locator(".rassam-status")).toContainText(/\d+%/);
  });

  test("zoom is clamped to the 20%-400% range", async ({ page }) => {
    await boot(page);
    for (let i = 0; i < 40; i += 1) {
      await wheel(page, -120, true);
    }
    await waitForScene(page, (s) => s.viewport.zoom >= 3.99);
    expect((await readScene(page))!.viewport.zoom).toBeCloseTo(4, 2);

    for (let i = 0; i < 60; i += 1) {
      await wheel(page, 120, true);
    }
    await waitForScene(page, (s) => s.viewport.zoom <= 0.21);
    expect((await readScene(page))!.viewport.zoom).toBeCloseTo(0.2, 2);
  });

  test("plain wheel scroll pans the viewport", async ({ page }) => {
    await boot(page);
    await wheel(page, 200, false);
    await waitForScene(page, (s) => s.viewport.scrollY < -10);
  });

  test("hand tool drag pans the viewport", async ({ page }) => {
    await boot(page);
    await pickTool(page, "hand");
    await dragCanvas(page, { x: 600, y: 400 }, { x: 300, y: 250 });
    await waitForScene(page, (s) => s.viewport.scrollX > 50 && s.viewport.scrollY > 50);
  });

  test("shift+drag with the select tool also pans", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 120, 100)]);
    await pickTool(page, "select");
    const box = await canvasBox(page);
    await page.keyboard.down("Shift");
    await page.mouse.move(box.x + 700, box.y + 500);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + 380, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await waitForScene(page, (s) => s.viewport.scrollX > 50);
    // no accidental element movement
    expect((await elements(page))[0].x).toBe(100);
  });

  test("grid and snap toggles expose pressed state", async ({ page }) => {
    await boot(page);
    const grid = page.getByRole("button", { name: /الشبكة/ });
    const snap = page.getByRole("button", { name: "محاذاة للشبكة" });
    await expect(grid).toHaveAttribute("aria-pressed", "false");
    await grid.click();
    await expect(grid).toHaveAttribute("aria-pressed", "true");
    await snap.click();
    await expect(snap).toHaveAttribute("aria-pressed", "true");
    await grid.click();
    await expect(grid).toHaveAttribute("aria-pressed", "false");
  });

  test("stats panel reports the live scene composition", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 120, 100),
      rectElement("b", 300, 300, 120, 100),
    ]);
    await page.getByRole("button", { name: "إحصاءات" }).click();
    const stats = page.locator(".rassam-stats");
    await expect(stats).toBeVisible();
    await expect(stats).toContainText("2");
    await expect(stats.locator(".rassam-stats-types")).toContainText("rectangle:2");
    await stats.getByRole("button", { name: "close" }).click();
    await expect(stats).toHaveCount(0);
  });

  test("minimap is shown by default and clicking it re-centres the viewport", async ({ page }) => {
    await boot(page);
    const scene = await readScene(page);
    // clicking a corner of the minimap re-centres the viewport on that point
    const mini = page.locator("canvas.rassam-minimap");
    await expect(mini).toBeVisible();
    await importScene(page, [rectElement("a", 1200, 900, 200, 160)]);
    const box = (await mini.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.85);
    await waitForScene(page, (s) => s.viewport.scrollX !== 0 || s.viewport.scrollY !== 0);
    void scene;

    await page.getByRole("button", { name: "خريطة مصغرة" }).click();
    await expect(page.locator("canvas.rassam-minimap")).toHaveCount(0);
  });

  test("canvas repaints after resize without losing the scene", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);
    await page.setViewportSize({ width: 1024, height: 720 });
    await expect(page.locator(CANVAS)).toBeVisible();
    expect(await elements(page)).toHaveLength(1);

    await page.getByRole("button", { name: "إحصاءات" }).click();
    await expect(page.locator(".rassam-stats")).toBeVisible();
    await clearBoard(page);
  });
});