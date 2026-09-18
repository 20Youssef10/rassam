import { expect, test } from "@playwright/test";

import { CANVAS, SCENE_KEY, boot, drawShape, elements, waitForCount } from "./helpers";

test.describe("Module 10 — Local persistence & offline resilience", () => {
  test("scene autosaves to localStorage and survives a reload", async ({ page }) => {
    await boot(page, { clear: false });
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await drawShape(page, "rectangle", { x: 90, y: 90 }, { x: 300, y: 240 });
    await waitForCount(page, 1);
    const saved = await page.evaluate((key) => localStorage.getItem(key), SCENE_KEY);
    const parsed = JSON.parse(saved!);
    expect(parsed.version).toBe(1);
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0].type).toBe("rectangle");

    await page.reload();
    await expect(page.locator(CANVAS)).toBeVisible();
    await waitForCount(page, 1);
    const after = (await elements(page))[0];
    expect(after.type).toBe("rectangle");
    expect(after.width).toBeGreaterThan(150);
  });

  test("viewport (pan + zoom) is restored after reload", async ({ page }) => {
    await boot(page, { clear: false });
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // pan with the hand tool (wheel-pan writes only after the debounce)
    await page.locator('button.rassam-tool[data-tool="hand"]').click();
    const box = (await page.locator(CANVAS).boundingBox())!;
    await page.mouse.move(box.x + 600, box.y + 400);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 250, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("rassam-scene-v1");
            return raw ? JSON.parse(raw).viewport.scrollX : 0;
          }),
        { timeout: 8_000 },
      )
      .toBeGreaterThan(100);

    await page.reload();
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("rassam-scene-v1");
            return raw ? JSON.parse(raw).viewport.scrollX : 0;
          }),
        { timeout: 8_000 },
      )
      .toBeGreaterThan(100);
  });

  test("a corrupted saved scene is ignored and the app still boots", async ({ page }) => {
    await boot(page, { clear: false });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.evaluate((key) => localStorage.setItem(key, "{\"elements\":\"nope\""), SCENE_KEY);
    await page.reload();
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page.locator(".rassam-empty")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("saved images (file payloads) survive a reload", async ({ page }) => {
    await boot(page, { clear: false });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('button.rassam-tool[data-tool="image"]').click();
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    const box = (await page.locator(CANVAS).boundingBox())!;
    await page.mouse.click(box.x + 220, box.y + 180);
    await waitForCount(page, 1);

    await page.reload();
    await expect(page.locator(CANVAS)).toBeVisible();
    await waitForCount(page, 1);
    const scene = await page.evaluate(() => JSON.parse(localStorage.getItem("rassam-scene-v1")!));
    expect(scene.elements[0].type).toBe("image");
    expect(scene.files[scene.elements[0].fileId].dataURL).toContain("data:image/png");
  });
});