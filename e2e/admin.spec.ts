import {
  ADMIN,
  createReport,
  expect,
  signedOut,
  signInAsNewUser,
  test,
} from "./support";
import type { Page } from "@playwright/test";

// The hidden admin. There is one admin account for the whole run and its
// password is chosen once, by the first test: the tests run in order, in one
// browser (the "admin" project in playwright.config.ts).

test.describe.configure({ mode: "serial" });
// A refused password is a 403, which the browser logs as an error.
test.use({ ...signedOut, allowConsoleErrors: true });

async function logIn(page: Page, password = ADMIN.password) {
  await page.goto("/admin");
  await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("the first visit asks the admin to choose a strong password", async ({
  page,
}) => {
  // The setup code comes in the link, after the #, and fills its field.
  await page.goto(`/admin#code=${ADMIN.setupCode}`);
  await expect(
    page.getByRole("heading", { name: "Première connexion" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  await expect(page.getByLabel("Code d'installation")).toHaveValue(
    ADMIN.setupCode,
  );
  const email = page.getByLabel("Adresse e-mail du compte admin");
  const password = page.getByLabel("Nouveau mot de passe");
  const submit = page.getByRole("button", { name: "Créer le mot de passe" });
  const rules = page.getByRole("list", {
    name: "Ce qu'il faut dans le mot de passe",
  });

  // Too weak: nothing is sent, and the list says what is missing.
  await email.fill(ADMIN.email);
  await password.fill("motdepasse");
  await expect(rules.getByLabel("Manque :")).toHaveCount(4);
  await submit.click();
  await expect(page.getByText(/Il manque encore quelque chose/)).toBeVisible();

  await password.fill(ADMIN.password);
  await expect(rules.getByLabel("OK :")).toHaveCount(5);

  // The right password, but not the admin's address: refused.
  await email.fill("mallory@example.test");
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Adresse, mot de passe ou code refusé.",
  );

  await email.fill(ADMIN.email);
  await submit.click();

  await expect(
    page.getByRole("heading", { name: "Signalements" }),
  ).toBeVisible();
  await expect(page.getByText(ADMIN.email)).toBeVisible();
  // The code is gone from the address bar.
  await expect(page).toHaveURL("/admin");
});

test("the password can't be chosen a second time, even with the code", async ({
  page,
  request,
}) => {
  await page.goto(`/admin#code=${ADMIN.setupCode}`);
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByLabel("Code d'installation")).toHaveCount(0);

  const response = await request.post("/api/admin/setup", {
    data: {
      email: ADMIN.email,
      password: "Another-Passw0rd!",
      code: ADMIN.setupCode,
    },
  });

  expect(response.status()).toBe(403);
  expect(
    (
      await request.post("/api/admin/login", {
        data: { email: ADMIN.email, password: "Another-Passw0rd!" },
      })
    ).status(),
  ).toBe(403);
});

test("signs in with the password, and out again", async ({ page }) => {
  await logIn(page, "Wrong-Passw0rd!");
  await expect(page.getByRole("alert")).toHaveText(
    "Adresse, mot de passe ou code refusé.",
  );
  // Still on the form: a wrong password doesn't send the admin elsewhere.
  await expect(page).toHaveURL("/admin");

  await page.getByLabel("Mot de passe").fill(ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Signalements" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await expect(page).toHaveURL("/");
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeVisible();
});

test("too many wrong passwords from one address are refused for a while", async ({
  request,
}) => {
  const attempt = () =>
    request.post("/api/admin/login", {
      data: { email: ADMIN.email, password: "Wrong-Passw0rd!" },
    });
  const statuses: number[] = [];
  for (let index = 0; index < 11; index++) {
    statuses.push((await attempt()).status());
  }

  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(403));
  expect(statuses[10]).toBe(429);
  // Even the right password waits.
  expect(
    (
      await request.post("/api/admin/login", {
        data: { email: ADMIN.email, password: ADMIN.password },
      })
    ).status(),
  ).toBe(429);
});

test("to anyone else, there is no admin", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  // Signed out: the admin's data isn't there.
  expect((await request.get("/api/admin/reports")).status()).toBe(404);
  expect(
    (
      await request.patch("/api/admin/reports/whatever", {
        data: { status: "handled" },
      })
    ).status(),
  ).toBe(404);

  // Signed in, but not the admin: the page doesn't exist.
  await signInAsNewUser(context, baseURL!);
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toHaveCount(
    0,
  );
  expect((await page.request.get("/api/admin/reports")).status()).toBe(404);
  expect((await page.request.get("/api/me")).ok()).toBe(true);
  expect((await (await page.request.get("/api/me")).json()).user.isAdmin).toBe(
    false,
  );
});

test("reads a player's report, with its card, and files it", async ({
  page,
  request,
}) => {
  const message = await createReport(request, "DUE-001");
  await logIn(page);
  const report = page.getByTestId("report").filter({ hasText: message });

  await expect(report).toContainText("carte DUE-001");
  await expect(report).toContainText("concours de regard");

  await report.getByRole("button", { name: "Traité" }).click();

  await expect(report).toHaveCount(0);
  await page.getByRole("link", { name: "Traités" }).click();
  await expect(page).toHaveURL("/admin?status=handled");
  await expect(report).toBeVisible();

  await report.getByRole("button", { name: "Rouvrir" }).click();
  await expect(report).toHaveCount(0);
  await page.getByRole("link", { name: "À lire" }).click();
  await expect(report).toBeVisible();

  await report.getByRole("button", { name: "Sans suite" }).click();
  await expect(report).toHaveCount(0);
});

test("shows what players ticked, and how often a card was liked or reported", async ({
  page,
  request,
}) => {
  // The deck can take a minute to show the votes.
  test.slow();
  // VAL-054 is this test's own card: no other test likes or reports it.
  const message = `E2E ${crypto.randomUUID()}`;
  const report = await request.post("/api/reports", {
    data: { cardId: "VAL-054", message, reasons: ["too-long", "to-fix"] },
  });
  expect(report.status()).toBe(204);
  // A reference that isn't a card is ignored, not counted.
  for (const cardIds of [["VAL-054", "ZZ-999"], ["VAL-054"]]) {
    const liked = await request.post("/api/likes", { data: { cardIds } });
    expect(liked.status()).toBe(204);
  }
  expect(
    (await request.post("/api/likes", { data: { cardIds: [] } })).status(),
  ).toBe(400);
  // The votes reach the players' deck within a minute (its cache): more up
  // than down make the card more likely than an unvoted one.
  await expect
    .poll(
      async () => {
        const deck = await (await request.get("/api/deck")).json();
        return deck.cards.find((card: { id: string }) => card.id === "VAL-054")
          ?.weight;
      },
      { timeout: 70_000, intervals: [2_000] },
    )
    .toBeGreaterThan(1);

  await logIn(page);
  const row = page.getByTestId("report").filter({ hasText: message });
  await expect(row.getByRole("list", { name: "Raisons cochées" })).toHaveText(
    "Trop longueÀ modifier",
  );
  // The card says where its first player goes: at the start.
  await expect(row).toContainText("tu commences : dans mon sac");

  await page.goto("/admin/cartes?q=VAL-054");
  const feedback = page.getByTestId("card-feedback");
  await expect(feedback).toContainText("2 j'aime1 signalement");
  await expect(feedback).toContainText("chances ×1,19");
  // The most liked first: this one is ahead of a card nobody liked.
  await page.goto("/admin/cartes?sort=likes");
  await expect(page.getByLabel("Ordre")).toHaveValue("likes");
  const ids = await page
    .getByTestId("card-row")
    .getByRole("link")
    .allTextContents();
  expect(ids.indexOf("VAL-054")).toBeLessThan(ids.indexOf("VAL-053"));
});

test("writes a card, previews it, and publishes it to the players", async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  await logIn(page);
  await page.getByRole("link", { name: "Cartes" }).click();
  await expect(page.getByRole("heading", { name: "Cartes" })).toBeVisible();
  await page.getByRole("link", { name: "Nouvelle carte" }).click();

  // A quiz question isn't saved without its sourced answer.
  await page.getByLabel("Mini-jeu").selectOption("Culture G");
  const question = `[J1], [J2], [J3] et [J4] : combien de pattes a une araignée (${Date.now()}) ?`;
  await page.getByLabel("Texte").fill(question);
  await page.getByRole("button", { name: "Créer la carte" }).click();
  await expect(page.getByText("Une question a une réponse.")).toBeVisible();

  await page.getByLabel("Réponse").fill("8");
  await page.getByLabel("Unité").fill("pattes");
  await page.getByLabel("Source").fill("Muséum national d'histoire naturelle");
  // The preview shows the card as players will see it, at several stakes.
  const preview = page.getByRole("region", { name: "Aperçu" });
  await expect(preview.locator("mark").first()).toHaveText("Romain");
  await expect(preview).toContainText(
    "Le plus proche distribue 1 gorgée, le plus éloigné les boit",
  );
  await expect(preview).toContainText(
    "Le plus proche gagne 3 points, le plus éloigné les perd",
  );
  await page.getByRole("button", { name: "Créer la carte" }).click();

  // Saved as a draft, under the next free reference of its mini-game.
  await expect(page).toHaveURL(/\/admin\/cartes\/CG-\d+$/);
  const cardId = page.url().split("/").at(-1)!;
  await expect(
    page.getByRole("heading", { name: `Carte ${cardId}` }),
  ).toBeVisible();
  await expect(page.getByText("Carte créée")).toBeVisible();
  const inDeck = async () => {
    const deck = await (await request.get("/api/deck")).json();
    return deck.cards.some((card: { id: string }) => card.id === cardId);
  };
  expect(await inDeck()).toBe(false);

  await page.getByLabel("Statut").selectOption("Publiée");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toHaveText("Enregistré.");
  await expect(page.getByText("statut : Brouillon → Publiée")).toBeVisible();
  expect(await inDeck()).toBe(true);

  // A player's phone gets it at the home screen, and keeps it.
  const phone = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
  });
  const home = await phone.newPage();
  await home.goto("/");
  await home.getByRole("button", { name: "J'ai 18 ans ou plus" }).click();
  await expect
    .poll(() => home.evaluate(() => localStorage.getItem("zbeul:deck") ?? ""))
    .toContain(cardId);
  await phone.close();

  // Archived, it leaves the players' deck, but not the admin's list.
  await page.getByLabel("Statut").selectOption("Archivée");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("statut : Publiée → Archivée")).toBeVisible();
  expect(await inDeck()).toBe(false);

  await page.getByRole("link", { name: "Retour aux cartes" }).click();
  await page.getByLabel("Texte ou référence").fill(cardId);
  await page.getByRole("button", { name: "Chercher" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${cardId}`));
  await expect(page.getByTestId("card-row")).toHaveCount(1);
  await expect(page.getByTestId("card-row")).toContainText("Archivée");

  // The history names the admin and each change.
  await page.getByRole("link", { name: "Historique" }).click();
  const changes = page.getByTestId("change").filter({ hasText: cardId });
  await expect(changes).toHaveCount(3);
  await expect(changes.first()).toContainText(ADMIN.email);
});

test("changes several cards at once, in a pack of their own", async ({
  page,
  request,
}) => {
  await logIn(page);
  const stamp = Date.now();
  const packName = `Pack e2e ${stamp}`;

  // A new pack, published.
  await page.getByRole("link", { name: "Packs" }).click();
  const newPack = page
    .getByRole("listitem")
    .filter({ hasText: "Nouveau pack" });
  await newPack.getByLabel("Nom").fill(packName);
  await newPack.getByLabel("Description").fill("Pour les tests.");
  await newPack.getByLabel("Publié : proposé aux joueurs").check();
  await newPack.getByRole("button", { name: "Créer le pack" }).click();
  await expect(
    page.getByTestId("pack").filter({ hasText: packName }),
  ).toContainText("0 carte publiée sur 0.");

  // Two drafts of ours, found by their text, changed together.
  for (const index of [1, 2]) {
    const response = await page.request.post("/api/admin/cards", {
      data: {
        game: "tu-preferes",
        level: 1,
        text: `Tu préfères le test ${stamp} numéro ${index} ou rien ?`,
        packId: "officiel",
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.getByRole("link", { name: "Cartes" }).click();
  await page.getByLabel("Texte ou référence").fill(String(stamp));
  await page.getByRole("button", { name: "Chercher" }).click();
  await expect(page.getByTestId("card-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Tout cocher" }).click();
  const bulk = page.getByRole("group", {
    name: "Changer les 2 cartes cochées",
  });
  await bulk.getByLabel("Nouveau statut").selectOption("Publiée");
  await bulk.getByLabel("Nouveau niveau").selectOption("3 · Piquant");
  await bulk.getByLabel("Nouveau pack").selectOption(packName);
  await bulk.getByRole("button", { name: "Appliquer" }).click();

  await expect(page.getByText("2 cartes modifiées.")).toBeVisible();
  for (const row of await page.getByTestId("card-row").all()) {
    await expect(row).toContainText("niveau 3");
    await expect(row).toContainText("Publiée");
  }

  // Players are offered the pack, with our two cards in it.
  const deck = await (await request.get("/api/deck")).json();
  const ours = deck.packs.find(
    (pack: { name: string }) => pack.name === packName,
  );
  expect(ours).toMatchObject({ description: "Pour les tests." });
  expect(
    deck.cards.filter((card: { pack: string }) => card.pack === ours.id),
  ).toHaveLength(2);

  // Unpublished, the pack and its cards leave the players' deck.
  await page.getByRole("link", { name: "Packs" }).click();
  const pack = page.getByTestId("pack").filter({ hasText: packName });
  await expect(pack).toContainText("2 cartes publiées sur 2.");
  await pack.getByLabel("Publié : proposé aux joueurs").uncheck();
  await pack.getByRole("button", { name: "Enregistrer" }).click();
  await expect(pack.getByRole("status")).toHaveText("Enregistré.");
  const after = await (await request.get("/api/deck")).json();
  expect(JSON.stringify(after)).not.toContain(packName);
  expect(JSON.stringify(after)).not.toContain(String(stamp));
});

test("the deck and the admin's cards over the API", async ({
  page,
  request,
}) => {
  // Anyone gets the deck: published cards only, with what the game needs.
  const response = await request.get("/api/deck");
  expect(response.status()).toBe(200);
  const deck = await response.json();
  expect(deck.cards.length).toBeGreaterThanOrEqual(870);
  expect(deck.packs[0]).toMatchObject({
    id: "officiel",
    name: "Pack officiel",
  });
  expect(
    deck.cards.find((card: { id: string }) => card.id === "CG-001"),
  ).toEqual({
    id: "CG-001",
    game: "culture-g",
    level: 1,
    text: "[J1], [J2], [J3] et [J4] : combien mesure la tour Eiffel, antennes comprises ?",
    themes: [],
    targets: 4,
    pack: "officiel",
    answer: "330",
    unit: "mètres",
    source: "Société d'exploitation de la tour Eiffel",
  });
  // Unchanged, it isn't sent twice.
  const again = await request.get("/api/deck", {
    headers: { "If-None-Match": response.headers().etag! },
  });
  expect(again.status()).toBe(304);

  // To anyone but the admin, managing cards doesn't exist.
  for (const path of ["cards", "packs", "changes"]) {
    expect((await request.get(`/api/admin/${path}`)).status()).toBe(404);
  }
  expect((await request.post("/api/admin/cards", { data: {} })).status()).toBe(
    404,
  );
  expect(
    (
      await request.post("/api/admin/cards/bulk", {
        data: { ids: ["TP-001"], status: "archived" },
      })
    ).status(),
  ).toBe(404);

  // The admin's mistakes are refused with the reason.
  await logIn(page);
  await expect(
    page.getByRole("heading", { name: "Signalements" }),
  ).toBeVisible();
  const card = {
    game: "duel",
    level: 1,
    text: "[J1] contre [J2] : duel.",
    packId: "officiel",
  };
  const post = (data: object) =>
    page.request.post("/api/admin/cards", { data });
  expect((await post({ ...card, text: "[J1] tout seul." })).status()).toBe(400);
  expect((await post({ ...card, packId: "nope" })).status()).toBe(400);
  expect((await post({ ...card, level: 9 })).status()).toBe(400);
  const created = await (await post(card)).json();
  expect(created).toMatchObject({
    id: expect.stringMatching(/^DUE-\d+$/),
    status: "draft",
  });
  const patch = (id: string, data: object) =>
    page.request.patch(`/api/admin/cards/${id}`, { data });
  // A card keeps its mini-game; an unknown card is a 404.
  expect(
    (
      await patch(created.id, {
        ...card,
        game: "tribunal",
        text: "[J1] est coupable ?",
      })
    ).status(),
  ).toBe(400);
  expect((await patch("DUE-99999", card)).status()).toBe(404);
  // Saving the same card again records nothing.
  expect((await patch(created.id, card)).status()).toBe(200);
  const changes = await (
    await page.request.get(`/api/admin/changes?cardId=${created.id}`)
  ).json();
  expect(changes.map((change: { action: string }) => change.action)).toEqual([
    "created",
  ]);
});

test.describe("POST /api/reports", () => {
  test("refuses an empty report, a made-up card reference and an endless message", async ({
    request,
  }) => {
    for (const data of [
      {},
      { message: "a" },
      { cardId: "not a card", message: "Bonjour" },
      { message: "a".repeat(1001) },
    ]) {
      const response = await request.post("/api/reports", { data });
      expect(response.status()).toBe(400);
    }
  });

  test("limits how many reports one address can send", async ({ request }) => {
    const statuses: number[] = [];
    for (let index = 0; index < 21; index++) {
      const response = await request.post("/api/reports", {
        data: { message: "Encore moi" },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, 20)).toEqual(Array(20).fill(204));
    expect(statuses[20]).toBe(429);
  });
});
