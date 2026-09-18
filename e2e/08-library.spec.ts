import { expect, test } from "@playwright/test";

import { LIBRARY_KEY, boot, elements, importScene, rectElement, waitForCount } from "./helpers";

const LIB = "المكتبة";

test.describe("Module 8 - Arabic shape library", () => {
  test("library dialog opens, filters by category and inserts a built-in item", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: LIB, exact: true }).click();
    const panel = page.locator(".rassam-library");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-modal", "true");
    const items = panel.locator("button.rassam-library-item");
    const all = await items.count();
    expect(all).toBeGreaterThanOrEqual(14);

    await panel.locator("select").selectOption("flow");
    const flow = await items.count();
    expect(flow).toBeGreaterThan(0);
    expect(flow).toBeLessThan(all);

    await panel.locator('input[type="search"]').fill("بداية");
    await expect(items).toHaveCount(1);
    await items.first().click();
    await expect(panel).toHaveCount(0);
    await waitForCount(page, 2);
    const types = (await elements(page)).map((e) => e.type).sort();
    expect(types).toEqual(["ellipse", "text"]);
  });

  test("library closes on Escape and with the close button", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: LIB, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".rassam-library")).toHaveCount(0);

    await page.getByRole("button", { name: LIB, exact: true }).click();
    await page.locator(".rassam-library-header").getByRole("button").click();
    await expect(page.locator(".rassam-library")).toHaveCount(0);
  });
  test("saving a selection stores a reusable custom item locally", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 100, 100, 120, 100),
      rectElement("b", 300, 220, 120, 100),
    ]);
    await page.keyboard.press("Control+a");
    // the save-selection button lives in the stage tools bar
    await page
      .locator(".rassam-stage-tools")
      .getByRole("button", { name: /في المكتبة/ })
      .click();
    await expect(page.locator(".rassam-live")).toContainText("في المكتبة");

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), LIBRARY_KEY);
    expect(stored).toHaveLength(1);
    expect(stored[0].titleEn).toBe("Saved element");
    expect(stored[0].template).toHaveLength(2);

    // the custom item is offered in the library and can be re-inserted
    await page.getByRole("button", { name: LIB, exact: true }).click();
    await page.locator(".rassam-library select").selectOption("custom");
    const customItems = page.locator(".rassam-library button.rassam-library-item");
    await expect(customItems.first()).toContainText("Saved element");
    await customItems.first().click();
    await waitForCount(page, 4);
  });

  test("library items persist across a reload", async ({ page }) => {
    await boot(page, { clear: false });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem(
        "rassam-library-v1",
        JSON.stringify([
          {
            id: "custom_seeded",
            titleAr: "seeded",
            titleEn: "Saved element",
            category: "custom",
            template: [
              {
                id: "rect_x",
                type: "rectangle",
                x: 0,
                y: 0,
                width: 120,
                height: 80,
                stroke: "#0F172A",
                fill: "#DBEAFE",
                strokeWidth: 2,
                opacity: 1,
                seed: 1,
              },
            ],
          },
        ]),
      );
    });
    await page.reload();
    await expect(page.locator("canvas.rassam-canvas")).toBeVisible();
    await page.getByRole("button", { name: LIB, exact: true }).click();
    await page.locator(".rassam-library select").selectOption("custom");
    await expect(page.locator(".rassam-library button.rassam-library-item").first()).toBeVisible();
    await page.locator(".rassam-library button.rassam-library-item").first().click();
    await waitForCount(page, 1);
  });
});