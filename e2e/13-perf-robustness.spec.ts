import { expect, test } from "@playwright/test";

import { boot, drawShape, elementCount, importScene, rectElement, waitForCount } from "./helpers";

test.describe("Module 13 — Performance & robustness", () => {
  test("200 seeded elements render, stay interactive and paint without page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await boot(page);
    const seeded = Array.from({ length: 200 }, (_, i) =>
      rectElement(`bulk_${i}`, 20 + (i % 20) * 180, 20 + Math.floor(i / 20) * 160, 140, 110),
    );
    const t0 = Date.now();
    await importScene(page, seeded);
    const loadMs = Date.now() - t0;

    expect(await elementCount(page)).toBe(200);
    expect(errors).toEqual([]);

    // drawing stays responsive with a large scene on screen
    const d0 = Date.now();
    await drawShape(page, "rectangle", { x: 40, y: 40 }, { x: 180, y: 160 });
    await waitForCount(page, 201);
    const drawMs = Date.now() - d0;

    console.log(`perf: load+render 200 elements=${loadMs}ms, draw interaction=${drawMs}ms`);
    expect(loadMs).toBeLessThan(15_000);
    expect(drawMs).toBeLessThan(6_000);
  });

  test("rapid pan/zoom bursts do not corrupt the scene", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await boot(page);
    await drawShape(page, "rectangle", { x: 100, y: 100 }, { x: 260, y: 220 });
    await waitForCount(page, 1);

    const box = (await page.locator("canvas.rassam-canvas").boundingBox())!;
    const cx = box.x + 500;
    const cy = box.y + 400;
    for (let i = 0; i < 25; i += 1) {
      await page.locator("canvas.rassam-canvas").evaluate(
        (el, c) => {
          el.dispatchEvent(
            new WheelEvent("wheel", {
              deltaY: c.deltaY,
              ctrlKey: true,
              clientX: c.x,
              clientY: c.y,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
        { x: cx, y: cy, deltaY: i % 2 ? 140 : -160 },
      );
    }
    await expect
      .poll(async () => elementCount(page))
      .toBe(1);
    expect(errors).toEqual([]);
  });

  test("zero-size and drag-cancellation gestures do not create ghost elements", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await boot(page);

    // click without drag
    await page.locator('button.rassam-tool[data-tool="rectangle"]').click();
    const box = (await page.locator("canvas.rassam-canvas").boundingBox())!;
    await page.mouse.click(box.x + 300, box.y + 300);
    await page.waitForTimeout(300);
    expect(await elementCount(page)).toBe(0);

    // start a drag and cancel mid-flight
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 260, { steps: 4 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await elementCount(page)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test("rapid undo/redo spam stays consistent", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 120, 100)]);

    await drawShape(page, "ellipse", { x: 300, y: 300 }, { x: 420, y: 400 });
    await waitForCount(page, 2);

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+y");
    }
    await page.keyboard.press("Control+z");
    await waitForCount(page, 1);
    await page.keyboard.press("Control+y");
    await waitForCount(page, 2);
    expect(errors).toEqual([]);
  });

  test("fonts load from self-hosted assets (no external requests required to render)", async ({
    page,
  }) => {
    const external: string[] = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      const sameOrigin = url.startsWith("http://localhost:3001");
      const benign = url.startsWith("data:") || url.startsWith("chrome-extension:") || url.includes("sw.js");
      if (!sameOrigin && !benign) {
        external.push(url);
        return route.abort();
      }
      return route.continue();
    });
    await boot(page);
    await page.waitForTimeout(1200);
    // the Google Fonts stylesheet is harness-stubbed to an empty response; no
    // other cross-origin request should be attempted.
    expect(external).toEqual([]);
  });
});