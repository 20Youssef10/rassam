import { expect, test } from "@playwright/test";

import { boot, CANVAS, drawShape, tool, waitForCount } from "./helpers";

test.describe("Module 9 — i18n, theming & accessibility", () => {
  test("language toggle switches the whole shell to English LTR", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator(".rassam-app")).toHaveAttribute("dir", "ltr");
    await expect(page.locator(".rassam-topbar")).toHaveAttribute("dir", "ltr");
    await expect(tool(page, "select")).toHaveAttribute("aria-label", "Select");
    await expect(tool(page, "rectangle")).toHaveAttribute("aria-label", "Rectangle");
    await expect(page.locator(".rassam-empty")).toContainText("Welcome to Rassam");

    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(tool(page, "select")).toHaveAttribute("aria-label", "تحديد");
  });

  test("theme toggle switches the dark palette class and repaints the canvas", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);

    const themeBtn = page.locator('.rassam-topbar button[title="تبديل السمة"]');
    await themeBtn.click();
    await expect(page.locator(".rassam-app")).toHaveClass(/theme-dark/);

    // canvas background follows the token palette
    const bg = await page
      .locator(".rassam-canvas-wrap")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(30, 41, 59)");

    await themeBtn.click();
    await expect(page.locator(".rassam-app")).not.toHaveClass(/theme-dark/);
  });

  test("toolbar keyboard navigation moves the active tool", async ({ page }) => {
    await boot(page);
    await tool(page, "rectangle").click();
    await expect(tool(page, "rectangle")).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ArrowDown");
    await expect(tool(page, "diamond")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowUp");
    await expect(tool(page, "rectangle")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("End");
    await expect(tool(page, "eraser")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Home");
    await expect(tool(page, "select")).toHaveAttribute("aria-pressed", "true");
  });

  test("single-key tool shortcuts work while the canvas has focus", async ({ page }) => {
    await boot(page);
    await page.locator(CANVAS).click({ position: { x: 700, y: 500 } });
    for (const [key, expected] of [
      ["r", "rectangle"],
      ["d", "diamond"],
      ["o", "ellipse"],
      ["a", "arrow"],
      ["t", "text"],
      ["n", "sticky"],
      ["f", "frame"],
      ["b", "bucket"],
      ["s", "laser"],
      ["e", "eraser"],
      ["v", "select"],
      ["h", "hand"],
      ["q", "lasso"],
      ["x", "elbow"],
      ["p", "draw"],
    ] as const) {
      await page.keyboard.press(key);
      await expect(tool(page, expected)).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("skip link, live region and canvas host are keyboard reachable", async ({ page }) => {
    await boot(page);
    await expect(page.locator("a.rassam-skip")).toBeVisible();
    await expect(page.locator(".rassam-live")).toHaveAttribute("aria-live", "polite");
    await expect(page.locator('[role="toolbar"]')).toHaveAttribute("aria-label", "أدوات الرسم");
    await expect(page.locator('button.rassam-tool[data-tool="select"]')).toHaveAttribute(
      "aria-label",
      "تحديد",
    );
    await expect(page.locator("#rassam-canvas")).toHaveAttribute("tabindex", "-1");
  });

  test("prefers-reduced-motion still renders and edits", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page);
    await drawShape(page, "ellipse", { x: 100, y: 100 }, { x: 260, y: 220 });
    await waitForCount(page, 1);
    await expect(page.locator(CANVAS)).toBeVisible();
  });
});

test.describe("Module 9b — Mobile RTL layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile viewport renders a horizontal toolbar with large touch targets", async ({ page }) => {
    await boot(page);
    const toolbar = page.locator(".rassam-toolbar");
    await expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
    const box = (await tool(page, "rectangle").boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(
      true,
    );
  });
});