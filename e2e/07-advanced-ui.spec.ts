import { expect, test } from "@playwright/test";

import {
  boot,
  canvasBox,
  dragCanvas,
  drawShape,
  elements,
  expectSelected,
  frameElement,
  importScene,
  pickTool,
  rectElement,
  tool,
  waitForCount,
} from "./helpers";

test.describe("Module 7 — Command palette, dialogs, zen & presentation", () => {
  test("Ctrl+K opens the palette, filters and runs a command", async ({ page }) => {
    await boot(page);
    await page.keyboard.press("Control+k");
    const palette = page.locator(".rassam-palette");
    await expect(palette).toBeVisible();
    await expect(palette).toHaveAttribute("dir", "rtl");

    const input = palette.locator("input");
    await input.fill("أداة: إطار");
    const items = palette.locator(".rassam-palette-list button");
    await expect(items.first()).toBeVisible();
    await expect(items).toHaveCount(2);
    await items.first().click();
    await expect(palette).toHaveCount(0);
    await expect(tool(page, "frame")).toHaveAttribute("aria-pressed", "true");
  });

  test("palette shows a no-results state and closes on Escape", async ({ page }) => {
    await boot(page);
    await page.keyboard.press("Control+k");
    const input = page.locator(".rassam-palette input");
    await input.fill("zzzz-not-a-command");
    await expect(page.locator(".rassam-palette-empty")).toBeVisible();
    await input.press("Escape");
    await expect(page.locator(".rassam-palette")).toHaveCount(0);
  });

  test("help dialog lists the shortcut catalogue and closes", async ({ page }) => {
    await boot(page);
    await page.locator('.rassam-topbar button[title="الاختصارات"]').click();
    const help = page.locator(".rassam-help");
    await expect(help).toBeVisible();
    await expect(help.locator(".rassam-help-list li")).toHaveCount(19);
    await expect(help).toContainText("V");
    await help.getByRole("button", { name: "close" }).click();
    await expect(help).toHaveCount(0);
  });

  test("zen mode hides the chrome and can be toggled back", async ({ page }) => {
    await boot(page);
    const app = page.locator(".rassam-app");
    await page.getByRole("button", { name: "وضع الزن" }).click();
    await expect(app).toHaveClass(/is-zen/);
    // in zen mode the toolbar / status / stage-tools are hidden
    await expect(page.locator(".rassam-toolbar")).toBeHidden();
    await expect(page.locator(".rassam-status")).toBeHidden();
    // the zen toggle button itself becomes hidden, so toggle back via palette
    await page.keyboard.press("Control+k");
    await page.locator(".rassam-palette input").fill("وضع الزن");
    await page.locator(".rassam-palette-list button").first().click();
    await expect(app).not.toHaveClass(/is-zen/);
    await expect(page.locator(".rassam-toolbar")).toBeVisible();
  });

  test("view-only mode blocks editing but keeps navigation", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: "عرض فقط" }).click();
    await expect(page.locator(".rassam-app")).toHaveClass(/is-viewonly/);

    // drawing is refused even though the tool button can be activated
    await tool(page, "rectangle").click();
    await dragCanvas(page, { x: 100, y: 100 }, { x: 260, y: 220 });
    await page.waitForTimeout(400);
    expect(await elements(page)).toHaveLength(0);
    await expect(page.locator(".rassam-empty")).toBeVisible();

    // panning still works
    await pickTool(page, "hand");
    await dragCanvas(page, { x: 500, y: 400 }, { x: 320, y: 300 });
    await expect
      .poll(async () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("rassam-scene-v1")!).viewport.scrollX as number,
        ),
      )
      .toBeGreaterThan(50);
  });

  test("mermaid dialog imports the default flowchart sample", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: "Mermaid" }).click();
    const dialog = page.locator(".rassam-mermaid-input");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveValue(/flowchart TD/);
    await page.getByRole("button", { name: "إدراج" }).click();
    await waitForCount(page, 9);
    const types = (await elements(page)).map((e) => e.type);
    expect(types.filter((t) => t === "arrow")).toHaveLength(4);
    await expect(page.locator(".rassam-live")).toContainText("تم إدراج مخطط");
  });

  test("mermaid dialog reports unparsable input", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: "Mermaid" }).click();
    await page.locator(".rassam-mermaid-input").fill("this is not a diagram");
    await page.getByRole("button", { name: "إدراج" }).click();
    await expect(page.locator(".rassam-mermaid-error")).toBeVisible();
    expect(await elements(page)).toHaveLength(0);
  });

  test("presentation mode walks frames as slides and exits with Escape", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      frameElement("f1", 0, 0, 400, 300, "شريحة أولى"),
      rectElement("c1", 60, 60, 120, 80),
      frameElement("f2", 0, 400, 400, 300, "شريحة ثانية"),
      rectElement("c2", 80, 480, 120, 80),
    ]);
    await page.getByRole("button", { name: "عرض تقديمي" }).click();
    const present = page.locator(".rassam-present");
    await expect(present).toBeVisible();
    await expect(present).toContainText("1/2");
    await present.getByRole("button", { name: "التالي" }).click();
    await expect(present).toContainText("2/2");
    await present.getByRole("button", { name: "السابق" }).click();
    await expect(present).toContainText("1/2");
    await page.keyboard.press("Escape");
    await expect(present).toHaveCount(0);
  });

  test("presentation reports when the board has no frames", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 120, 100)]);
    await page.getByRole("button", { name: "عرض تقديمي" }).click();
    await expect(page.locator(".rassam-present")).toHaveCount(0);
    await expect(page.locator(".rassam-live")).toContainText("لا توجد إطارات");
  });

  test("double-clicking a frame selects the frame plus its contents", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      frameElement("f1", 0, 0, 400, 300),
      rectElement("c1", 60, 60, 120, 80),
      rectElement("c2", 220, 120, 120, 80),
      rectElement("outside", 700, 600, 80, 60),
    ]);
    await pickTool(page, "select");
    const box = await canvasBox(page);
    await page.mouse.dblclick(box.x + 2, box.y + 2);
    await expectSelected(page, 3);
  });

  test("search box highlights matches without mutating the scene", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 120, 100, { label: "رسام" }),
      rectElement("b", 300, 300, 120, 100),
    ]);
    const search = page.locator('input[type="search"]').first();
    await search.fill("رسام");
    await page.waitForTimeout(400);
    expect(await elements(page)).toHaveLength(2);
    await search.fill("");
    expect(await elements(page)).toHaveLength(2);
  });
});