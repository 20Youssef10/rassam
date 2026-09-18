import { expect, test } from "@playwright/test";

import {
  boot,
  clickCanvas,
  elements,
  expectSelected,
  importScene,
  pickTool,
  rectElement,
  waitForCount,
  waitForScene,
} from "./helpers";

/**
 * Regression guards for bugs found in the first E2E pass — expected to PASS
 * after the fixes in src/editor/Editor.tsx.
 */
test.describe("Module 99 — Previously known bugs (now fixed)", () => {
  test("BUG-1 text tool: create text via click + type + Enter", async ({ page }) => {
    await boot(page);
    await pickTool(page, "text");
    await clickCanvas(page, 140, 120);
    const editor = page.locator("textarea.rassam-text-editor");
    await expect(editor).toBeVisible();
    await editor.fill("نص جديد");
    await editor.press("Enter");
    await waitForCount(page, 1);
    expect((await elements(page))[0].text).toBe("نص جديد");
  });

  test("BUG-2 select tool: Shift+click extends the selection", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 160, 120),
      rectElement("b", 400, 220, 160, 120),
    ]);
    await pickTool(page, "select");
    await clickCanvas(page, 180, 160);
    await page.keyboard.down("Shift");
    await clickCanvas(page, 480, 280);
    await page.keyboard.up("Shift");
    await expectSelected(page, 2);
  });

  test("BUG-3 z-order: Ctrl+Shift+PageUp brings selection to front", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 160, 120),
      rectElement("b", 400, 220, 160, 120),
    ]);
    await pickTool(page, "select");
    await clickCanvas(page, 180, 160);
    await page.keyboard.press("Control+Shift+PageUp");
    await waitForScene(page, (s) => s.elements[s.elements.length - 1]?.id === "a");
  });
});
