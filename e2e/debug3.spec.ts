import { expect, test } from "@playwright/test";

import { CANVAS, boot, canvasBox, pickTool } from "./helpers";

test("debug: hand pan with event tracing", async ({ page }) => {
  const events: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") events.push(`console-error: ${m.text()}`);
  });
  page.on("pageerror", (e) => events.push(`pageerror: ${e.message}`));
  await boot(page);
  await page.exposeFunction("rassamTrace", (msg: string) => {
    events.push(msg);
  });
  await page.evaluate(() => {
    const w = window as unknown as { rassamTrace: (s: string) => void };
    const c = document.querySelector("canvas.rassam-canvas")!;
    (["pointerdown", "pointermove", "pointerup"] as const).forEach((t) =>
      c.addEventListener(t, (e) => {
        const p = e as PointerEvent;
        w.rassamTrace(
          `${t} client=${Math.round(p.clientX)},${Math.round(p.clientY)} btn=${p.button} shift=${p.shiftKey} id=${p.pointerId} trusted=${p.isTrusted}`,
        );
      }),
    );
  });

  await pickTool(page, "hand");
  const box = (await canvasBox(page))!;
  const from = { x: box.x + 600, y: box.y + 400 };
  const to = { x: box.x + 300, y: box.y + 250 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  console.log("events:\n" + events.join("\n"));
  console.log("scene:", await page.evaluate(() => localStorage.getItem("rassam-scene-v1")));
  console.log("active tool:", await page.locator('button.rassam-tool[aria-pressed="true"]').getAttribute("data-tool"));
  expect(true).toBe(true);
});