import { expect, test, type Browser, type Page } from "@playwright/test";

import { boot, drawShape, elementCount, waitForCount } from "./helpers";

async function openPeer(browser: Browser, hash = ""): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    locale: "ar-SA",
  });
  const page = await context.newPage();
  await boot(page, { hash });
  return page;
}

async function startCollab(page: Page, label = "بدء تعاون") {
  await page.getByRole("button", { name: label }).click();
  const chip = page.locator(".rassam-collab-chip");
  await expect(chip).toBeVisible({ timeout: 15_000 });
  const link = (await chip.getAttribute("title")) || "";
  expect(link).toMatch(/#(room|share)=/);
  return link;
}

test.describe("Module 11 — Real-time collaboration", () => {
  test("host shares an encrypted room link and a peer joins the live scene", async ({
    page,
    browser,
  }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 100, y: 100 }, { x: 260, y: 220 });
    await waitForCount(page, 1);

    const link = await startCollab(page);
    await expect(page.locator(".rassam-live")).toContainText("متصل");

    const peer = await openPeer(browser, new URL(link).hash);
    await waitForCount(peer, 1);
    await expect(peer.locator(".rassam-collab-chip")).toContainText("متصل");

    // host draws a new shape → peer must receive it live (E2E encryption + WS)
    await drawShape(page, "ellipse", { x: 420, y: 300 }, { x: 560, y: 400 });
    await waitForCount(page, 2);
    await expect
      .poll(
        async () =>
          peer.evaluate(() => {
            const raw = localStorage.getItem("rassam-scene-v1");
            return raw
              ? (JSON.parse(raw).elements as { type: string }[]).map((e) => e.type)
              : [];
          }),
        { timeout: 20_000 },
      )
      .toContain("ellipse");

    // host scene also contains ellipse (local edit)
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("rassam-scene-v1");
            return raw
              ? (JSON.parse(raw).elements as { type: string }[]).map((e) => e.type)
              : [];
          }),
        { timeout: 10_000 },
      )
      .toContain("ellipse");

    // host sees a second collaborator in the roster
    const panel = page.locator(".rassam-collab-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("مشاركون");
    await expect(panel.locator("li")).toHaveCount(2);
    await expect(peer.locator(".rassam-collab-users")).toContainText("2");

    await peer.context().close();
  });

  test("read-only share link is enforced for every participant", async ({ page, browser }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 120, y: 120 }, { x: 300, y: 240 });
    await waitForCount(page, 1);

    const link = await startCollab(page, "رابط قراءة فقط");
    expect(link).toContain("share=");
    await expect(page.locator(".rassam-collab-chip")).toContainText("وضع القراءة فقط");

    // host itself is now read-only
    await drawShape(page, "ellipse", { x: 400, y: 300 }, { x: 520, y: 400 });
    await page.waitForTimeout(400);
    expect(await elementCount(page)).toBe(1);

    const peer = await openPeer(browser, new URL(link).hash);
    await waitForCount(peer, 1);
    await expect(peer.locator(".rassam-collab-chip")).toContainText("وضع القراءة فقط");
    await drawShape(peer, "ellipse", { x: 400, y: 300 }, { x: 520, y: 400 });
    await page.waitForTimeout(400);
    expect(await elementCount(peer)).toBe(1);

    await peer.context().close();
  });

  test("copy link puts the room URL on the clipboard and stop collab resets state", async ({
    page,
  }) => {
    await boot(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3001",
    });
    const link = await startCollab(page);

    await page.getByRole("button", { name: "نسخ الرابط" }).click();
    await expect(page.locator(".rassam-copy-ok")).toContainText("تم نسخ الرابط");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(link);

    await page.getByRole("button", { name: "إنهاء التعاون" }).click();
    await expect(page.locator(".rassam-collab-chip")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "بدء تعاون" })).toBeVisible();
    expect(await page.evaluate(() => window.location.hash)).toBe("");
  });

  test("joining a room persists an encrypted snapshot to the storage backend", async ({
    page,
    request,
  }) => {
    await boot(page);
    await drawShape(page, "rectangle", { x: 100, y: 100 }, { x: 260, y: 220 });
    await waitForCount(page, 1);
    const link = await startCollab(page);
    const roomId = new URL(link).hash.replace("#room=", "").split(",")[0];

    await expect
      .poll(async () => {
        const res = await request.get(`http://localhost:8080/api/rooms/${roomId}/scene`);
        return res.status();
      }, { timeout: 15_000 })
      .toBe(200);

    const res = await request.get(`http://localhost:8080/api/rooms/${roomId}/scene`);
    const payload = (await res.json()) as { c: string; iv: string };
    expect(typeof payload.c).toBe("string");
    expect(typeof payload.iv).toBe("string");
    // payload is ciphertext — the element text must not leak
    expect(JSON.stringify(payload)).not.toContain("rectangle");
  });
});