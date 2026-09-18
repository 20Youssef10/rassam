import { expect, test } from "@playwright/test";

import { CANVAS, boot, canvasBox } from "./helpers";

test("debug: hand pan + status zoom", async ({ page }) => {
  await boot(page);
  const box = (await canvasBox(page))!;
  await page.mouse.move(box.x + 600, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 350, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  console.log("after hand pan:", await page.evaluate(() => localStorage.getItem("rassam-scene-v1")));

  await page.locator(CANVAS).evaluate(
    (el, c) => {
      el.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -120,
          ctrlKey: true,
          clientX: c.x,
          clientY: c.y,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { x: box.x + 500, y: box.y + 400 },
  );
  await page.waitForTimeout(500);
  console.log("after ctrl wheel:", await page.evaluate(() => localStorage.getItem("rassam-scene-v1")));
  console.log("status text:", await page.locator(".rassam-status").innerText());
  console.log("meta text:", await page.locator(".rassam-meta").innerText());
  expect(true).toBe(true);
});