import { expect, test } from "@playwright/test";

import { boot, canvasBox, pickTool } from "./helpers";

test("debug: text tool", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await boot(page);
  await page.evaluate(() => {
    (window as unknown as { __events: string[] }).__events = [];
    const w = window as unknown as { __events: string[] };
    window.addEventListener(
      "pointerdown",
      (e) => {
        const t = e.target as HTMLElement;
        w.__events.push(`down ${t.tagName}.${t.className}`);
      },
      true,
    );
    window.addEventListener(
      "pointerup",
      (e) => {
        const t = e.target as HTMLElement;
        w.__events.push(`up ${t.tagName}.${t.className}`);
      },
      true,
    );
    window.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        w.__events.push(`click ${t.tagName}.${t.className}`);
      },
      true,
    );
  });

  await pickTool(page, "text");
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __mut: string[] }).__mut = log;
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          const el = n as HTMLElement;
          if (el.tagName) log.push(`+ ${el.tagName}.${el.className}`);
        });
        r.removedNodes.forEach((n) => {
          const el = n as HTMLElement;
          if (el.tagName) log.push(`- ${el.tagName}.${el.className}`);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  const box = (await canvasBox(page))!;
  await page.mouse.move(box.x + 140, box.y + 120);
  await page.mouse.down();
  await page.waitForTimeout(300);
  console.log(
    "mutations:",
    JSON.stringify(await page.evaluate(() => (window as unknown as { __mut: string[] }).__mut)),
  );
  console.log("after down, textarea count:", await page.locator("textarea.rassam-text-editor").count());
  console.log(
    "events:",
    JSON.stringify(await page.evaluate(() => (window as unknown as { __events: string[] }).__events)),
  );
  console.log(
    "activeElement:",
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement)?.tagName +
        "." +
        (document.activeElement as HTMLElement)?.className,
    ),
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log("after up, textarea count:", await page.locator("textarea.rassam-text-editor").count());
  console.log("errors:", JSON.stringify(errors));
  console.log("storage:", await page.evaluate(() => localStorage.getItem("rassam-scene-v1")));
  expect(true).toBe(true);
});

test("debug: existing text edit path", async ({ page }) => {
  await boot(page);
  // seed a scene with a text element through the JSON import path
  const scene = {
    type: "rassam-scene",
    version: 1,
    elements: [
      {
        id: "text-1",
        type: "text",
        x: 120,
        y: 120,
        stroke: "#0F172A",
        fill: "transparent",
        strokeWidth: 2,
        opacity: 1,
        seed: 1,
        text: "نص تجريبي",
        fontSize: 20,
        fontFamily: "Cairo, 'Noto Naskh Arabic', 'Segoe UI', sans-serif",
        width: 140,
        height: 27,
      },
    ],
    viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
  };
  await page.evaluate((s) => {
    localStorage.setItem("rassam-scene-v1", JSON.stringify(s));
  }, scene);
  await page.reload();
  await expect(page.locator("canvas.rassam-canvas")).toBeVisible();

  const box = (await canvasBox(page))!;
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    const t = () => Math.round(performance.now());
    for (const ev of ["pointerdown", "mousedown", "mouseup", "click", "dblclick"]) {
      window.addEventListener(
        ev,
        (e) => log.push(`${t()} ${ev} @${(e.target as HTMLElement).tagName}`),
        true,
      );
    }
    window.addEventListener("focusin", (e) => log.push(`${t()} focusin @${(e.target as HTMLElement).className}`), true);
    window.addEventListener("focusout", (e) => log.push(`${t()} focusout @${(e.target as HTMLElement).className}`), true);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          const el = n as HTMLElement;
          if (el.tagName && `${el.className}`.includes("text-editor")) log.push(`${t()} + textarea`);
        });
        r.removedNodes.forEach((n) => {
          const el = n as HTMLElement;
          if (el.tagName && `${el.className}`.includes("text-editor")) log.push(`${t()} - textarea`);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  await pickTool(page, "select");
  await page.mouse.dblclick(box.x + 140, box.y + 130);
  await page.waitForTimeout(400);
  console.log(
    "log:",
    JSON.stringify(await page.evaluate(() => (window as unknown as { __log: string[] }).__log), null, 0),
  );
  console.log("textarea count after dblclick:", await page.locator("textarea.rassam-text-editor").count());
  console.log(
    "activeElement:",
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement)?.tagName +
        "." +
        (document.activeElement as HTMLElement)?.className,
    ),
  );
  const ta = page.locator("textarea.rassam-text-editor");
  if (await ta.count()) {
    console.log("value:", await ta.inputValue());
    await page.keyboard.type(" تعديل");
    await page.waitForTimeout(200);
    console.log("value after typing:", await ta.inputValue());
  }
  expect(true).toBe(true);
});
