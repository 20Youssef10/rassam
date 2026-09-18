import { expect, test } from "@playwright/test";

import {
  boot,
  canvasBox,
  clearBoard,
  clickCanvas,
  dragCanvas,
  drawShape,
  elementCount,
  elements,
  importScene,
  pickTool,
  screenshot,
  textElement,
  tinyPngBuffer,
  waitForCount,
  waitForScene,
} from "./helpers";

test.describe("Module 2 — Drawing tools", () => {
  test("rectangle, diamond and ellipse create correctly-typed elements", async ({ page }) => {
    await boot(page);

    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);
    await drawShape(page, "diamond", { x: 300, y: 80 }, { x: 440, y: 200 });
    await waitForCount(page, 2);
    await drawShape(page, "ellipse", { x: 500, y: 80 }, { x: 660, y: 200 });
    await waitForCount(page, 3);

    const els = await elements(page);
    expect(els.map((e) => e.type)).toEqual(["rectangle", "diamond", "ellipse"]);
    const [rect, diamond, ellipse] = els;
    expect(rect.width).toBeGreaterThan(140);
    expect(rect.height).toBeGreaterThan(100);
    expect(diamond.width).toBeGreaterThan(120);
    expect(ellipse.width).toBeGreaterThan(140);
    await screenshot(page, "02-shapes");
  });

  test("line, arrow and elbow arrow create linear elements", async ({ page }) => {
    await boot(page);

    await drawShape(page, "line", { x: 60, y: 60 }, { x: 260, y: 180 });
    await waitForCount(page, 1);
    await drawShape(page, "arrow", { x: 60, y: 220 }, { x: 260, y: 340 });
    await waitForCount(page, 2);
    await drawShape(page, "elbow", { x: 320, y: 60 }, { x: 520, y: 180 });
    await waitForCount(page, 3);

    const els = await elements(page);
    expect(els.map((e) => e.type)).toEqual(["line", "arrow", "arrow"]);
    expect(els[0].points?.length).toBeGreaterThanOrEqual(2);
    expect(els[2].elbow).toBe(true);
  });

  test("freehand draw captures a multi-point path", async ({ page }) => {
    await boot(page);
    await pickTool(page, "draw");
    const box = (await page.locator("canvas.rassam-canvas").boundingBox())!;
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    for (let i = 0; i < 24; i += 1) {
      await page.mouse.move(box.x + 80 + i * 6, box.y + 80 + Math.sin(i / 2) * 30);
    }
    await page.mouse.up();
    await waitForCount(page, 1);

    const [el] = await elements(page);
    expect(el.type).toBe("draw");
    expect(el.points?.length ?? 0).toBeGreaterThan(8);
  });

  test("editing existing text re-opens the inline editor and keeps the element", async ({ page }) => {
    await boot(page);
    // Seed text through the supported JSON-import path, then edit with the select tool.
    await importScene(page, [textElement("text-1", 120, 120, "نص تجريبي")]);
    await pickTool(page, "select");
    const box = (await canvasBox(page))!;
    await page.mouse.dblclick(box.x + 140, box.y + 130);

    const editor = page.locator("textarea.rassam-text-editor");
    await expect(editor).toBeVisible();
    await expect(editor).toHaveValue("نص تجريبي");
    await editor.fill("نص محدث");
    await editor.press("Enter");
    await expect(editor).toHaveCount(0);
    await waitForScene(page, (s) => s.elements[0]?.text === "نص محدث");
    expect((await elements(page)).length).toBe(1);
  });

  test("sticky note tool creates a sticky with an Arabic default label", async ({ page }) => {
    await boot(page);
    await drawShape(page, "sticky", { x: 100, y: 100 }, { x: 260, y: 240 });
    await waitForCount(page, 1);
    const [el] = await elements(page);
    expect(el.type).toBe("sticky");
    expect(el.label).toBe("ملاحظة");
    expect(el.fill).toBe("#FEF3C7");
    expect(el.width).toBeGreaterThanOrEqual(120);
  });

  test("frame tool creates a named frame", async ({ page }) => {
    await boot(page);
    await drawShape(page, "frame", { x: 60, y: 60 }, { x: 420, y: 320 });
    await waitForCount(page, 1);
    const [el] = await elements(page);
    expect(el.type).toBe("frame");
    expect(el.name).toBe("إطار");
    expect(el.width).toBeGreaterThanOrEqual(200);
    expect(el.height).toBeGreaterThanOrEqual(160);
  });

  test("image tool accepts a file and places an image element with file payload", async ({ page }) => {
    await boot(page);
    await pickTool(page, "image");
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: tinyPngBuffer(),
    });
    await expect(page.locator(".rassam-toast")).toBeVisible();
    await clickCanvas(page, 200, 160);
    await waitForCount(page, 1);

    const scene = await page.evaluate(() => JSON.parse(localStorage.getItem("rassam-scene-v1")!));
    const el = scene.elements[0];
    expect(el.type).toBe("image");
    expect(el.width).toBeGreaterThan(0);
    expect(Object.keys(scene.files || {})).toContain(el.fileId);
    await expect(page.locator(".rassam-toast")).toHaveCount(0);
  });

  test("eraser removes the hovered element", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 260, y: 220 });
    await waitForCount(page, 1);

    // hit-testing on an unfilled shape only matches the outline band, so click the edge
    await pickTool(page, "eraser");
    await clickCanvas(page, 170, 84);
    await waitForCount(page, 0);
    expect(await elementCount(page)).toBe(0);
  });

  test("bucket fill recolours a shape that has no fill", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 260, y: 220 });
    await waitForCount(page, 1);
    expect((await elements(page))[0].fill).toBe("transparent");

    await pickTool(page, "bucket");
    await clickCanvas(page, 170, 84);
    await waitForScene(page, (s) => s.elements[0]?.fill !== "transparent");
    expect((await elements(page))[0].fill).toBe("#DBEAFE");
  });

  test("laser pointer draws transient ink without adding elements", async ({ page }) => {
    await boot(page);
    await pickTool(page, "laser");
    await dragCanvas(page, { x: 80, y: 80 }, { x: 300, y: 220 });
    // laser is ephemeral: no persisted elements
    await page.waitForTimeout(400);
    expect(await elementCount(page)).toBe(0);
    await expect(page.locator('button.rassam-tool[data-tool="laser"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("style controls (stroke colour, fill, stroke width) apply to new shapes", async ({ page }) => {
    await boot(page);
    await page.locator('.rassam-swatches[aria-label="لون الخط"] button').nth(1).click();
    await page.locator('.rassam-swatches[aria-label="لون التعبئة"] button').nth(2).click();
    await page.locator('input[type="range"]').fill("6");

    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);
    const [el] = await elements(page);
    expect(el.strokeWidth).toBe(6);
    expect(el.fill).not.toBe("transparent");
  });

  test("clear board empties the scene after confirmation", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);
    await clearBoard(page);
    await expect(page.locator(".rassam-empty")).toBeVisible();
  });
});