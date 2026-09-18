import { expect, test } from "@playwright/test";

const API = "http://localhost:8080";

/** Deterministic non-secret fixture payload for the storage API tests. */
const payload = { c: "Y2lwaGVydGV4dA", iv: "aXZpdml2aXZpdg" };

test.describe("Module 12 — Storage backend API", () => {
  test("health endpoint reports driver and auth posture", async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.service).toBe("rassam-storage");
    expect(body.status).toBe("ok");
    expect(body.driver).toBe("filesystem");
  });

  test("shared scenes round-trip and 404 unknown ids", async ({ request }) => {
    const created = await request.post(`${API}/api/scenes`, { data: payload });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    expect(id).toMatch(/^[0-9a-f]{20}$/);

    const fetched = await request.get(`${API}/api/scenes/${id}`);
    expect(fetched.ok()).toBeTruthy();
    expect(await fetched.json()).toEqual(payload);

    const missing = await request.get(`${API}/api/scenes/doesnotexist123`);
    expect(missing.status()).toBe(404);

    // malformed payloads are rejected
    const bad = await request.post(`${API}/api/scenes`, { data: { nope: true } });
    expect(bad.status()).toBe(400);
  });

  test("room scenes round-trip per room id", async ({ request }) => {
    const roomId = `e2e_room_${Date.now()}`;
    const put = await request.post(`${API}/api/rooms/${roomId}/scene`, { data: payload });
    expect(put.ok()).toBeTruthy();

    const got = await request.get(`${API}/api/rooms/${roomId}/scene`);
    expect(got.ok()).toBeTruthy();
    expect(await got.json()).toEqual(payload);

    const missing = await request.get(`${API}/api/rooms/e2e_never_${Date.now()}/scene`);
    expect(missing.status()).toBe(404);
  });

  test("room id traversal attempts are rejected", async ({ request }) => {
    const res = await request.get(`${API}/api/rooms/..%2F..%2Fevil/scene`);
    expect([400, 404]).toContain(res.status());
  });

  test("library API round-trips per user id", async ({ request }) => {
    const user = `e2e_user_${Date.now()}`;
    const items = [{ id: "item-1", titleAr: "عنصر", titleEn: "Item", category: "custom", template: [] }];
    const put = await request.post(`${API}/api/library`, {
      data: { items, userId: user },
    });
    expect(put.ok()).toBeTruthy();
    expect((await put.json()).count).toBe(1);

    const got = await request.get(`${API}/api/library?user=${user}`);
    expect(got.ok()).toBeTruthy();
    expect((await got.json()).items).toEqual(items);

    const empty = await request.get(`${API}/api/library?user=e2e_nobody_${Date.now()}`);
    expect((await empty.json()).items).toEqual([]);
  });

  test("binary files round-trip and path traversal is refused", async ({ request }) => {
    const key = `e2e/${Date.now()}.bin`;
    const bytes = Buffer.from("rassam-bytes");
    const put = await request.put(`${API}/api/files/${key}`, { data: bytes });
    expect(put.ok()).toBeTruthy();

    const got = await request.get(`${API}/api/files/${key}`);
    expect(got.ok()).toBeTruthy();
    expect(Buffer.from(await got.body()).toString()).toBe("rassam-bytes");

    const traversal = await request.get(`${API}/api/files/..%2F..%2Fserver.js`);
    expect([400, 404]).toContain(traversal.status());

    const dotdot = await request.get(`${API}/api/files/a/../b`);
    expect([400, 404]).toContain(dotdot.status());
  });

  test("CORS preflight and unknown routes behave sanely", async ({ request }) => {
    const preflight = await request.fetch(`${API}/api/scenes`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3001", "Access-Control-Request-Method": "POST" },
    });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()["access-control-allow-origin"]).toBe("*");

    const notFound = await request.get(`${API}/api/nope`);
    expect(notFound.status()).toBe(404);
  });
});