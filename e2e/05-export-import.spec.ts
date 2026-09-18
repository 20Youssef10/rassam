import { expect, test } from "@playwright/test";

import {
  boot,
  clickCanvas,
  drawShape,
  elements,
  expectSelected,
  importScene,
  pickTool,
  rectElement,
  waitForCount,
} from "./helpers";

test.describe("Module 5 — Export & import", () => {
  test("exports the board as PNG", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 200, 140)]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "تصدير PNG" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^rassam-\d+\.png$/);
  });

  test("exports SVG containing the drawn geometry", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 200, 140)]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "تصدير SVG" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^rassam-\d+\.svg$/);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const svg = Buffer.concat(chunks).toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(svg).toContain('width="200"');
    expect(svg).toContain("<title>Rassam</title>");
  });

  test("exports only the selection when the SVG* button is used", async ({ page }) => {
    await boot(page);
    await importScene(page, [
      rectElement("a", 60, 60, 100, 80),
      rectElement("b", 400, 300, 120, 90),
    ]);
    await pickTool(page, "select");
    await clickCanvas(page, 110, 100);
    await expectSelected(page, 1);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG*" }).click();
    const file = await download;
    const chunks: Buffer[] = [];
    const stream = await file.createReadStream();
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const svg = Buffer.concat(chunks).toString("utf8");
    expect(svg).toContain("<rect");
    // only one rect in the body
    expect(svg.match(/<rect/g)?.length).toBe(2); // background + element
  });

  test("exports a .rassam.json document describing the scene", async ({ page }) => {
    await boot(page);
    await importScene(page, [rectElement("a", 100, 100, 200, 140)]);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "تصدير JSON" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.rassam\.json$/);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(json.type).toBe("rassam-scene");
    expect(json.elements).toHaveLength(1);
    expect(json.elements[0].type).toBe("rectangle");
    expect(json.version).toBe(1);
  });

  test("imports a .rassam.json file into the board", async ({ page }) => {
    await boot(page);
    const scene = {
      type: "rassam-scene",
      version: 1,
      source: "https://example.test",
      elements: [
        rectElement("imported-1", 120, 120, 180, 120),
        {
          id: "imported-2",
          type: "ellipse",
          x: 380,
          y: 140,
          width: 160,
          height: 120,
          stroke: "#0F172A",
          fill: "transparent",
          strokeWidth: 2,
          opacity: 1,
          seed: 3,
        },
      ],
      viewport: { scrollX: 0, scrollY: 0, zoom: 1 },
    };

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "استيراد JSON" }).click();
    const fc = await chooser;
    await fc.setFiles({
      name: "scene.rassam.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(scene)),
    });
    await waitForCount(page, 2);
    const types = (await elements(page)).map((e) => e.type).sort();
    expect(types).toEqual(["ellipse", "rectangle"]);
  });

  test("importing an invalid JSON document fails safely (no crash, board kept)", async ({ page }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 80, y: 80 }, { x: 240, y: 200 });
    await waitForCount(page, 1);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "استيراد JSON" }).click();
    const fc = await chooser;
    await fc.setFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not json"),
    });
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    expect(await elements(page)).toHaveLength(1);
  });
});