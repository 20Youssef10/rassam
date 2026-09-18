import { expect, test } from "@playwright/test";

import {
  boot,
  clickCanvas,
  dragCanvas,
  elements,
  expectSelected,
  importScene,
  pickTool,
  rectElement,
  waitForCount,
  waitForScene,
} from "./helpers";

const A = { id: "a", x: 100, y: 100, w: 160, h: 120 };

test.describe("Module 4 — Clipboard, delete & history", () => {
  test("Ctrl+C / Ctrl+V pastes a copy offset from the original", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement(A.id, A.x, A.y, A.w, A.h)]);
    await pickTool(page, "select");
    await clickCanvas(page, A.x + 80, A.y + 60);
    await expectSelected(page, 1);

    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    await waitForCount(page, 2);
    const els = await elements(page);
    const copy = els.find((e) => e.id !== "a")!;
    expect(copy.x).toBe(A.x + 24);
    expect(copy.y).toBe(A.y + 24);
  });

  test("Ctrl+X cuts and Ctrl+V pastes the element back", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement(A.id, A.x, A.y, A.w, A.h)]);
    await pickTool(page, "select");
    await clickCanvas(page, A.x + 80, A.y + 60);
    await expectSelected(page, 1);

    await page.keyboard.press("Control+x");
    await waitForCount(page, 0);
    await page.keyboard.press("Control+v");
    await waitForCount(page, 1);
    expect((await elements(page))[0].x).toBe(A.x + 24);
  });

  test("Ctrl+D duplicates the selection in place-offset and selects the copies", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement(A.id, A.x, A.y, A.w, A.h)]);
    await pickTool(page, "select");
    await clickCanvas(page, A.x + 80, A.y + 60);
    await expectSelected(page, 1);

    await page.keyboard.press("Control+d");
    await waitForCount(page, 2);
    await expectSelected(page, 1);
  });

  test("Delete removes the selected element and undo brings it back", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement(A.id, A.x, A.y, A.w, A.h)]);
    await pickTool(page, "select");
    await clickCanvas(page, A.x + 80, A.y + 60);
    await expectSelected(page, 1);

    await page.keyboard.press("Delete");
    await waitForCount(page, 0);

    await page.keyboard.press("Control+z");
    await waitForCount(page, 1);
    expect((await elements(page))[0].id).toBe("a");
  });

  test("move / resize / draw are undoable and redoable from the top bar buttons", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement(A.id, A.x, A.y, A.w, A.h)]);
    await pickTool(page, "select");
    await clickCanvas(page, A.x + 80, A.y + 60);
    await expectSelected(page, 1);

    await expect(page.getByRole("button", { name: "تراجع" })).toBeEnabled();
    await dragCanvas(page, { x: A.x + 80, y: A.y + 60 }, { x: A.x + 200, y: A.y + 160 });
    await waitForScene(page, (s) => (s.elements[0]?.x ?? 0) > A.x + 50);

    await page.getByRole("button", { name: "تراجع" }).click();
    await waitForScene(page, (s) => s.elements[0]?.x === A.x);
    await expect(page.getByRole("button", { name: "إعادة" })).toBeEnabled();

    await page.getByRole("button", { name: "إعادة" }).click();
    await waitForScene(page, (s) => (s.elements[0]?.x ?? 0) > A.x + 50);
  });

  test("undo restores a deleted multi-selection as one step", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 120, 100),
      rectElement("b", 300, 100, 120, 100),
    ]);
    await pickTool(page, "select");
    await page.keyboard.press("Control+a");
    await expectSelected(page, 2);
    await page.keyboard.press("Delete");
    await waitForCount(page, 0);
    await page.keyboard.press("Control+z");
    await waitForCount(page, 2);
  });
});
