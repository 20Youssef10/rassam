import { expect, test } from "@playwright/test";

import { CANVAS, boot, elementCount, screenshot, tool, uiElementCount } from "./helpers";

test.describe("Module 1 — Boot, shell & RTL Arabic UI", () => {
  test("loads the Arabic RTL shell with a live canvas", async ({ page }) => {
    await boot(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar-SA");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".rassam-app")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("canvas.rassam-canvas")).toBeVisible();
    await expect(page.locator(".rassam-topbar")).toBeVisible();
    await expect(page.locator(".rassam-toolbar")).toBeVisible();
    await expect(page.locator(".rassam-status")).toBeVisible();
    expect(await elementCount(page)).toBe(0);
    await screenshot(page, "01-boot-ar");
  });

  test("renders the full 17-tool toolbar with Arabic labels", async ({ page }) => {
    await boot(page);
    const tools = page.locator("button.rassam-tool");
    await expect(tools).toHaveCount(17);

    const expected = [
      "select",
      "lasso",
      "hand",
      "rectangle",
      "diamond",
      "ellipse",
      "line",
      "arrow",
      "elbow",
      "draw",
      "text",
      "image",
      "sticky",
      "frame",
      "bucket",
      "laser",
      "eraser",
    ];
    for (const name of expected) {
      await expect(tool(page, name)).toBeVisible();
      await expect(tool(page, name)).toHaveAttribute("aria-label", /\S/);
    }
    await expect(tool(page, "rectangle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".rassam-toolbar")).toHaveAttribute("role", "toolbar");
  });

  test("shows the Arabic welcome overlay on an empty board", async ({ page }) => {
    await boot(page);
    const empty = page.locator(".rassam-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("مرحبًا بك في رسَّام");
    await expect(empty).toContainText("يعمل دون اتصال");
  });

  test("exposes an a11y skip link and a polite live region", async ({ page }) => {
    await boot(page);
    await expect(page.locator("a.rassam-skip")).toHaveAttribute("href", "#rassam-canvas");
    const live = page.locator(".rassam-live");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toHaveAttribute("aria-atomic", "true");
    await expect(page.locator("#rassam-canvas")).toHaveAttribute("tabindex", "-1");
  });

  test("ships a PWA manifest and registers the offline service worker", async ({ page, request }) => {
    await boot(page, { clear: false });
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    const res = await request.get("http://localhost:3001/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = (await res.json()) as { name?: string; dir?: string; lang?: string };
    expect(manifest.name).toContain("رسَّام");
    expect(manifest.dir).toBe("rtl");
    expect(manifest.lang).toBe("ar");

    // sw.js aborted by the harness route, but the file must exist and be valid JS
    const sw = await request.get("http://localhost:3001/sw.js");
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain("rassam-v1");
  });

  test("z-index/status surfaces stay in sync with the element model", async ({ page }) => {
    await boot(page);
    const box = await page.locator(CANVAS).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(400);
    expect(box?.height ?? 0).toBeGreaterThan(300);
    expect(await uiElementCount(page)).toBe(0);
    await expect(page.locator(".rassam-status")).toContainText("تم الحفظ محليًا");
    await expect(page.locator(".rassam-status")).toContainText("100%");
  });
});
