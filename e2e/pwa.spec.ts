import { asReturningPlayer, expect, somePlayers, test } from "./support";

// The app installs on the home screen and plays without a connection.

test("the web manifest describes an installable app", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("manifest+json");
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Zbeul",
    short_name: "Zbeul",
    display: "standalone",
    start_url: "/",
    lang: "fr",
  });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
  expect(
    manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    ),
  ).toBe(true);
});

test("the service worker is never cached, so an update always arrives", async ({
  request,
}) => {
  const worker = await request.get("/sw.js");

  expect(worker.status()).toBe(200);
  expect(worker.headers()["cache-control"]).toBe("no-cache");
  expect(worker.headers()["content-type"]).toContain("javascript");
  // Never from the cache: the API, and the admin.
  const script = await worker.text();
  expect(script).toContain("admin");
  expect(script).toContain("api");
});

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });

  test("a whole game plays in airplane mode", async ({ page, context }) => {
    await asReturningPlayer(page, {
      prefs: {
        players: somePlayers("Romain", "Inès", "Sacha", "Léa"),
        settings: { duration: 30 },
        rotateHintClosed: true,
      },
    });
    await page.goto("/");
    // Once the service worker is active it holds every file of the app; the
    // next page load goes through it.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);

    await context.setOffline(true);
    await page.reload();

    await page.getByRole("link", { name: "Jouer" }).click();
    await page.getByRole("button", { name: "C'est parti" }).click();
    for (let card = 1; card <= 30; card++) {
      await expect(page.getByText(`Carte ${card} / 30`)).toBeVisible();
      await page
        .getByRole("button", { name: /^(Carte suivante|Gagné)$/ })
        .click();
    }

    await expect(page).toHaveURL("/fin");
    await expect(page.getByTestId("ranking-row")).toHaveCount(4);
    // The card font came from the cache too.
    expect(
      await page.evaluate(() =>
        document.fonts.check('800 20px "Bricolage Grotesque Variable"'),
      ),
    ).toBe(true);
  });

  test.describe("the admin", () => {
    // The failed page load is logged by the browser.
    test.use({ allowConsoleErrors: true });

    test("is never available offline", async ({ page, context }) => {
      await asReturningPlayer(page);
      await page.goto("/");
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await context.setOffline(true);
      // The game's own screens still open...
      await page.goto("/reglages");
      await expect(
        page.getByRole("heading", { name: "Réglages" }),
      ).toBeVisible();

      // ...the admin doesn't.
      await expect(page.goto("/admin")).rejects.toThrow(
        /ERR_INTERNET_DISCONNECTED|ERR_FAILED/,
      );

      await context.setOffline(false);
      await page.goto("/");
    });
  });
});
