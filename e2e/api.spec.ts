import { expect, test } from "./support";

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/api/me says nobody is signed in", async ({ request }) => {
    const response = await request.get("/api/me");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ user: null });
  });
});

test.describe("GET /api/health", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("answers without a session when the database is up", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

test("/api/me holds no token or id", async ({ request }) => {
  const me = await (await request.get("/api/me")).json();

  expect(me).toEqual({
    user: { email: "e2e-shared@example.test", name: null, isAdmin: false },
  });
});

test("the API document lists every route", async ({ request }) => {
  const document = await (await request.get("/api/openapi.json")).json();

  expect(Object.keys(document.paths).sort()).toEqual([
    "/api/admin/cards",
    "/api/admin/cards/bulk",
    "/api/admin/cards/{id}",
    "/api/admin/changes",
    "/api/admin/login",
    "/api/admin/packs",
    "/api/admin/packs/{id}",
    "/api/admin/reports",
    "/api/admin/reports/{id}",
    "/api/admin/setup",
    "/api/admin/status",
    "/api/deck",
    "/api/health",
    "/api/likes",
    "/api/me",
    "/api/reports",
  ]);
});
