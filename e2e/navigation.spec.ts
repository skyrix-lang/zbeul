import { asReturningPlayer, expect, test } from "./support";

test.describe("home page", () => {
  test("offers to play, install, and little else: no menu anywhere", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/");

    await expect(page).toHaveTitle("Zbeul");
    await expect(page.getByRole("heading", { name: "Zbeul" })).toBeVisible();
    await expect(page.getByRole("link")).toHaveText([
      "Jouer",
      "Installer l'appli",
      "Favoris",
      "Réglages",
    ]);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
    // Nothing public leads to the admin.
    await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  });

  test("leads to the game's setup, and back", async ({ page }) => {
    await asReturningPlayer(page);
    await page.goto("/");

    await page.getByRole("link", { name: "Jouer" }).click();

    await expect(page).toHaveURL("/jouer");
    await expect(
      page.getByRole("heading", { name: "Nouvelle partie" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Retour" }).click();

    await expect(page).toHaveURL("/");
  });

  test("every secondary screen is one tap away, with a way back", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    for (const [link, heading] of [
      ["Favoris", "Favoris"],
      ["Réglages", "Réglages"],
      ["Installer l'appli", "Installer l'appli"],
    ] as const) {
      await page.goto("/");
      await page.getByRole("link", { name: link }).click();
      await expect(
        page.getByRole("heading", { name: heading, level: 1 }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Retour" }).click();
      await expect(page).toHaveURL("/");
    }
  });

  test("a screen opened from the settings goes back to the settings", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    for (const link of [
      "Signaler un problème",
      "Installer l'appli",
      "Mentions légales",
    ]) {
      await page.goto("/");
      await page.getByRole("link", { name: "Réglages" }).click();
      await page.getByRole("link", { name: link }).click();
      await expect(
        page.getByRole("heading", { name: link, level: 1 }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Retour" }).click();
      await expect(page).toHaveURL("/reglages");
    }

    // From one legal page to another, "Retour" still leaves them in one tap.
    await page.getByRole("link", { name: "Mentions légales" }).click();
    await page.getByRole("link", { name: "Confidentialité" }).click();
    await expect(page).toHaveURL("/confidentialite");
    await page.getByRole("link", { name: "Retour" }).click();
    await expect(page).toHaveURL("/reglages");
  });

  test("the install steps read as sentences, without stray spaces", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/installer");

    const steps = page.getByRole("listitem");
    await expect(steps.first()).toHaveText(
      "Touche Partager, en bas de l'écran",
    );
    // The bold words sit in the sentence: no gap is laid out around them.
    const gaps = await steps.first().evaluate((step) => {
      const bold = step.querySelector("strong")!;
      return getComputedStyle(bold.parentElement!).columnGap;
    });
    expect(gaps).toBe("normal");
  });

  test("the setup's options show that they open", async ({ page }) => {
    await asReturningPlayer(page);
    await page.goto("/jouer");

    const games = page.locator("details").filter({ hasText: "Mini-jeux" });
    await expect(games.locator("summary")).toContainText("Modifier");
    await games.locator("summary").click();
    await expect(games.locator("summary")).toContainText("Fermer");
    await expect(page.getByRole("checkbox", { name: "Duel" })).toBeVisible();
  });

  test("the setup has nothing below its footer to drag into view", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/jouer");
    await expect(
      page.getByRole("button", { name: "C'est parti" }),
    ).toBeVisible();

    // Neither the page nor the screen's frame is taller than the screen:
    // only the content above the footer scrolls.
    const overflow = await page.evaluate(() => {
      const frame = document.querySelector("main")!.closest(".fixed")!;
      return {
        page: document.documentElement.scrollHeight - window.innerHeight,
        frame: frame.scrollHeight - frame.clientHeight,
      };
    });
    expect(overflow).toEqual({ page: 0, frame: 0 });
  });
});

test.describe("the signed-in pages' header", () => {
  test("desktop navigation", async ({ page, isMobile }) => {
    test.skip(isMobile, "the desktop navigation is hidden on mobile");
    await page.goto("/bookings");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeHidden();

    await expect(
      page.getByRole("banner").getByRole("link", { name: "Bookings" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("mobile menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the mobile menu is hidden on desktop");
    await page.goto("/bookings");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Bookings" })).toBeHidden();

    await header.getByRole("button", { name: "Open menu" }).click();

    await expect(
      header.getByRole("button", { name: "Close menu" }),
    ).toHaveAttribute("aria-expanded", "true");

    await header.getByRole("link", { name: "Bookings" }).click();

    await expect(page).toHaveURL("/bookings");
    await expect(header.getByRole("link", { name: "Bookings" })).toBeHidden();
    await expect(
      header.getByRole("button", { name: "Open menu" }),
    ).toBeVisible();
  });
});

test.describe("unknown pages", () => {
  test("show the not-found page, which isn't indexed", async ({ page }) => {
    // The server answers 404 (seo.spec.ts) and the page also asks search
    // engines not to index it.
    await asReturningPlayer(page);
    await page.goto("/does-not-exist");

    await expect(page).toHaveTitle("Page introuvable | Zbeul");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );

    await page.getByRole("link", { name: "Retour à l'accueil" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("an unknown API path is a JSON 404, not the app", async ({
    request,
  }) => {
    const response = await request.get("/api/does-not-exist");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");
  });
});
