import {
  animationsDone,
  asReturningPlayer,
  expect,
  savedGame,
  somePlayers,
  test,
} from "./support";
import type { Page } from "@playwright/test";

// The game keeps everything on the phone, so each test starts from the
// localStorage it needs (asReturningPlayer) and no test shares data.

const trio = somePlayers("Romain", "Inès", "Sacha");

/** On a phone held upright, the game first suggests turning it. */
async function stayUpright(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  await page.getByRole("button", { name: "Rester à la verticale" }).click();
}

async function addPlayer(page: Page, name: string, gender = "Autre") {
  await page.getByLabel("Prénom du nouveau joueur").fill(name);
  await page.getByRole("button", { name: `+ ${gender}` }).click();
}

test.describe("age gate", () => {
  test("is asked on the first visit, then remembered", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Ce site est réservé aux personnes majeures",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Jouer" })).toHaveCount(0);

    await page.getByRole("button", { name: "J'ai 18 ans ou plus" }).click();

    await expect(page.getByRole("link", { name: "Jouer" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Jouer" })).toBeVisible();
  });

  test("guards every game screen, but not the legal pages", async ({
    page,
  }) => {
    await page.goto("/jouer");
    await expect(
      page.getByRole("button", { name: "J'ai 18 ans ou plus" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Charte de contenu" }).click();

    await expect(
      page.getByRole("heading", { name: "Charte de contenu" }),
    ).toBeVisible();
  });

  test("is asked again after 12 months", async ({ page }) => {
    const thirteenMonths = 395 * 24 * 60 * 60 * 1000;
    await asReturningPlayer(page, {
      prefs: { ageConfirmedAt: Date.now() - thirteenMonths },
    });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "J'ai 18 ans ou plus" }),
    ).toBeVisible();
  });
});

test.describe("setting up a game", () => {
  test("starts in a few taps, playing for points by default", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/jouer");
    const start = page.getByRole("button", { name: "C'est parti" });
    await expect(start).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("au moins 2 joueurs");

    await addPlayer(page, "Romain", "Gars");
    await addPlayer(page, "Inès", "Fille");
    await addPlayer(page, "Sacha");

    await expect(
      page.getByRole("switch", { name: /Mode gorgées/ }),
    ).not.toBeChecked();
    await start.click();

    await expect(page).toHaveURL("/partie");
    await stayUpright(page, isMobile);
    await expect(page.getByText("Carte 1 / 30")).toBeVisible();
    await expect(page.getByTestId("stake")).toContainText(/point/);
    await expect(page.getByTestId("stake")).not.toContainText("gorgée");
  });

  test("remembers the players and settings for the next game", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/jouer");
    await addPlayer(page, "Romain");
    await addPlayer(page, "Inès");
    await page.getByText("80", { exact: true }).click();

    await page.reload();

    await expect(page.getByLabel("Prénom du joueur 1")).toHaveValue("Romain");
    await expect(page.getByLabel("Prénom du joueur 2")).toHaveValue("Inès");
    await expect(page.getByRole("radio", { name: "80 cartes" })).toBeChecked();
  });

  test("warns about alcohol when sips are turned on", async ({ page }) => {
    await asReturningPlayer(page, { prefs: { players: trio } });
    await page.goto("/jouer");
    const sips = page.getByRole("switch", { name: /Mode gorgées/ });

    await sips.click();

    const warning = page.getByRole("dialog", { name: "Mode gorgées" });
    await expect(warning).toContainText(
      "L'abus d'alcool est dangereux pour la santé",
    );
    // Not on until the warning is accepted.
    await warning.getByRole("button", { name: "On reste aux points" }).click();
    await expect(sips).not.toBeChecked();

    await sips.click();
    await warning.getByRole("button", { name: "Compris, on active" }).click();

    await expect(sips).toBeChecked();
    // Shown once: turning it off and on again doesn't ask twice.
    await sips.click();
    await sips.click();
    await expect(warning).toBeHidden();
    await expect(sips).toBeChecked();
  });

  test("asks everyone's agreement once to turn Border on", async ({ page }) => {
    await asReturningPlayer(page, { prefs: { players: trio } });
    await page.goto("/jouer");
    const border = page.getByRole("radio", { name: /Border/ });
    const choose = () => page.getByText("Border", { exact: true }).click();
    const confirmation = page.getByRole("dialog", {
      name: "Border, vraiment ?",
    });

    await choose();
    await confirmation.getByRole("button", { name: "On reste sages" }).click();
    await expect(border).not.toBeChecked();

    await choose();
    await confirmation
      .getByRole("button", { name: "Tout le monde est d'accord" })
      .click();

    await expect(border).toBeChecked();
    await expect(confirmation).toBeHidden();
  });

  test("deals three teams, lets them be changed by hand, and needs two players in each", async ({
    page,
  }) => {
    await asReturningPlayer(page, {
      prefs: {
        players: somePlayers("Ada", "Bob", "Cléo", "Dan", "Eve", "Fay"),
      },
    });
    await page.goto("/jouer");

    await page.getByText("Équipes", { exact: true }).click();
    await page.getByText("3 équipes", { exact: true }).click();

    const teams = page.getByTestId("team-members");
    await expect(teams).toHaveCount(3);
    for (const team of await teams.all()) {
      await expect(team).toHaveText(/^\S+, \S+$/);
    }
    const start = page.getByRole("button", { name: "C'est parti" });
    await expect(start).toBeEnabled();

    await page.getByText("À la main", { exact: true }).click();
    const adaTeam = page.getByLabel("Équipe de Ada");
    const from = await adaTeam.inputValue();
    await adaTeam.selectOption(from === "0" ? "1" : "0");

    await expect(start).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText(
      "Chaque équipe doit avoir au moins 2 joueurs.",
    );

    await adaTeam.selectOption(from);
    await expect(start).toBeEnabled();
  });

  test("never plays a mini-game that is unchecked", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, { prefs: { players: trio } });
    await page.goto("/jouer");
    await page.getByText("Mini-jeux").click();
    for (const game of await page
      .getByRole("checkbox")
      .filter({ visible: true })
      .all()) {
      await game.uncheck();
    }
    await expect(page.getByRole("status")).toContainText(
      "au moins un mini-jeu",
    );
    await page.getByRole("checkbox", { name: "Duel" }).check();
    await page.getByRole("checkbox", { name: "Sentence gratuite" }).check();

    await page.getByRole("button", { name: "C'est parti" }).click();
    await stayUpright(page, isMobile);

    for (let card = 1; card <= 8; card++) {
      await expect(page.getByText(`Carte ${card} /`)).toBeVisible();
      await expect(page.getByRole("article")).toContainText(
        /Duel|Sentence gratuite/,
      );
      await page.getByRole("button", { name: "Carte suivante" }).click();
    }
  });
});

test.describe("packs", () => {
  const duel = (id: string, pack: string, text: string) => ({
    id,
    game: "duel",
    level: 1,
    text: `[J1] contre [J2] : ${text}`,
    themes: [],
    targets: 2,
    pack,
  });
  const deck = {
    version: "e2e",
    packs: [
      { id: "officiel", name: "Pack officiel", description: "" },
      {
        id: "couple",
        name: "Soirée couple",
        description: "À deux, ou presque.",
      },
    ],
    cards: [
      duel("DUE-901", "officiel", "bras de fer."),
      duel("DUE-902", "officiel", "concours de grimaces."),
      duel("DUE-903", "couple", "qui connaît le mieux l'autre ?"),
    ],
  };

  test("the group plays the deck it received, with the packs it keeps", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, settings: { games: ["duel"], level: 1 } },
      deck,
    });
    await page.goto("/jouer");

    const packs = page.getByRole("group", { name: "Packs de cartes" });
    const couple = packs.getByRole("checkbox", { name: "Soirée couple" });
    await expect(couple).toBeChecked();
    await expect(packs).toContainText("À deux, ou presque.");
    await couple.uncheck();
    // A game needs cards: the last pack can't be unticked.
    await packs.getByRole("checkbox", { name: "Pack officiel" }).click();
    await expect(
      packs.getByRole("checkbox", { name: "Pack officiel" }),
    ).toBeChecked();

    await page.getByRole("button", { name: "C'est parti" }).click();
    await stayUpright(page, isMobile);

    const seen: string[] = [];
    for (let card = 1; card <= 2; card++) {
      await expect(page.getByText(`Carte ${card} / 30`)).toBeVisible();
      seen.push(await page.getByRole("article").innerText());
      await page.getByRole("button", { name: "Carte suivante" }).click();
    }
    // Both cards of the pack kept, none of the other; then the deck is dry.
    expect(seen.join()).toContain("bras de fer");
    expect(seen.join()).toContain("concours de grimaces");
    await expect(page).toHaveURL("/fin");
    await expect(
      page.getByText("Plus de cartes ? Vous êtes des machines."),
    ).toBeVisible();
  });

  test("a saved game whose card was archived moves on to the next one", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, settings: { games: ["duel"], level: 1 } },
      deck,
      turns: [{ cardId: "DUE-000", players: ["p0", "p1"], stake: 1 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await expect(page.getByText("Carte 2 / 30")).toBeVisible();
    await expect(page.getByRole("article")).toContainText("contre");
  });
});

test.describe("playing", () => {
  test("has nothing to type and at most four buttons to play with", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio },
      turns: [{ cardId: "MOB-001", players: ["p0"], stake: 2 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await expect(page.getByRole("article")).toContainText(
      "Romain, quel est ton super pouvoir ? Montre-le.",
    );
    // The player's name is highlighted.
    await expect(page.getByRole("article").locator("mark")).toHaveText(
      "Romain",
    );
    await expect(page.locator("input, select, textarea")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveText([
      "", // quit, labelled below
      "", // report
      "Perdu",
      "Joker",
      "Gagné",
    ]);
    await expect(
      page.getByRole("button", { name: "Terminer la partie" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Signaler cette carte" }),
    ).toBeVisible();
  });

  test("counts Gagné and Perdu for the player on the card", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: {
        players: trio,
        settings: { games: ["montre-ou-bois"], duration: 3 },
      },
      turns: [{ cardId: "MOB-001", players: ["p0"], stake: 2 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await page.getByRole("button", { name: "Gagné" }).click();
    await expect(page.getByText("Carte 2 / 3")).toBeVisible();
    const second = (await savedGame(page)).turns[1];
    await page.getByRole("button", { name: "Perdu" }).click();
    await expect(page.getByText("Carte 3 / 3")).toBeVisible();
    await page.getByRole("button", { name: "Joker" }).click();

    await expect(page).toHaveURL("/fin");
    await expect(
      page.getByRole("heading", { name: "Le classement" }),
    ).toBeVisible();
    const game = await savedGame(page);
    expect(game.scores.p0.won).toBe(2);
    expect(game.scores[second.players[0]].lost).toBeGreaterThanOrEqual(
      second.stake,
    );
    await expect(page.getByTestId("ranking-row").first()).toContainText(
      "Romain",
    );
    await expect(page.getByTestId("ranking-row").first()).toContainText(
      "2 points",
    );
  });

  test("a duel has no Gagné or Perdu: the card says what the loser gets", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, settings: { sips: true } },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 3 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await expect(page.getByTestId("stake")).toHaveText(
      "Le perdant boit 3 gorgées",
    );
    await expect(page.getByRole("button", { name: "Gagné" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Perdu" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Carte suivante" }),
    ).toBeVisible();
  });

  test("a double-tier card shows both stakes", async ({ page, isMobile }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, settings: { sips: true } },
      turns: [{ cardId: "TMC-055", players: [], stake: 2 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await expect(page.getByTestId("stake")).toHaveText(
      "2 gorgées, 4 pour le second groupe",
    );
  });

  test("a quiz names four players, and its answer tops the next card", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: somePlayers("Ada", "Bob", "Cléo", "Dan") },
      turns: [
        { cardId: "CG-001", players: ["p0", "p1", "p2", "p3"], stake: 1 },
      ],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await expect(page.getByRole("article").locator("mark")).toHaveText([
      "Ada",
      "Bob",
      "Cléo",
      "Dan",
    ]);
    await expect(page.getByTestId("answer")).toHaveCount(0);

    await page.getByRole("button", { name: "Carte suivante" }).click();

    await expect(page.getByTestId("answer")).toContainText(
      "Réponse : 330 mètres",
    );
    await page.getByTestId("answer").getByText("Source").click();
    await expect(page.getByTestId("answer")).toContainText("tour Eiffel");
  });

  test("picks up at the sixth card after five cards and a reload", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, settings: { games: ["duel", "sentence"] } },
    });
    await page.goto("/jouer");
    await page.getByRole("button", { name: "C'est parti" }).click();
    await stayUpright(page, isMobile);
    for (let card = 1; card <= 5; card++) {
      await expect(page.getByText(`Carte ${card} /`)).toBeVisible();
      await page.getByRole("button", { name: "Carte suivante" }).click();
    }
    await expect(page.getByText("Carte 6 /")).toBeVisible();
    const sixth = await page.getByRole("article").innerText();

    await page.reload();

    await expect(page.getByText("Carte 6 /")).toBeVisible();
    expect(await page.getByRole("article").innerText()).toBe(sixth);

    // The home offers to pick the game up, or to start another.
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Reprendre la partie" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nouvelle partie" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Reprendre la partie" }).click();
    await expect(page.getByText("Carte 6 /")).toBeVisible();
  });

  test("a game left more than 12 hours ago isn't offered again", async ({
    page,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 1 }],
      game: { updatedAt: Date.now() - 13 * 60 * 60 * 1000 },
    });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Jouer" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Reprendre la partie" }),
    ).toHaveCount(0);
  });

  test("suggests turning an upright phone, and takes no for an answer", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "only on a touch screen held upright");
    await asReturningPlayer(page, {
      prefs: { players: trio },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 1 }],
    });
    await page.goto("/partie");

    await expect(page.getByText("Tourne ton téléphone")).toBeVisible();

    await page.getByRole("button", { name: "Rester à la verticale" }).click();

    await expect(page.getByText("Tourne ton téléphone")).toBeHidden();
    await expect(page.getByRole("article")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page.getByText("Tourne ton téléphone")).toBeHidden();
  });

  for (const size of [
    { name: "the smallest phone, in landscape", width: 667, height: 375 },
    { name: "the smallest phone, upright", width: 375, height: 667 },
    { name: "a large phone, in landscape", width: 932, height: 430 },
  ]) {
    test(`the longest card fits ${size.name}, without scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await asReturningPlayer(page, {
        prefs: {
          players: somePlayers("Maximilien", "Inès", "Sacha", "Léa"),
          settings: { sips: true },
          rotateHintClosed: true,
        },
        // The longest text, under a quiz answer and both reminders.
        turns: [
          { cardId: "CG-001", players: ["p0", "p1", "p2", "p3"], stake: 2 },
          { cardId: "AV-033", players: ["p0"], stake: 3 },
        ],
        game: {
          rules: [{ playerId: "p1", remaining: 7 }],
          partners: ["p2"],
        },
      });
      await page.goto("/partie");
      const card = page.getByRole("article");
      await expect(card).toContainText("vous buvez tous les deux.");
      // Measured once the card has slid in.
      await animationsDone(page);

      const layout = await page.evaluate(() => {
        const box = (element: Element | null) =>
          element!.getBoundingClientRect().toJSON() as DOMRect;
        const article = document.querySelector("article")!;
        const text = article.querySelector("p.font-display")!;
        return {
          scrolls:
            document.documentElement.scrollHeight > window.innerHeight ||
            document.documentElement.scrollWidth > window.innerWidth,
          card: box(article),
          text: box(text),
          textArea: box(text.parentElement!.parentElement),
          fontSize: parseFloat(getComputedStyle(text).fontSize),
          buttons: [...document.querySelectorAll("main ~ div button")].map(
            (button) => box(button),
          ),
        };
      });
      expect(layout.scrolls).toBe(false);
      // The whole text is inside its area, at a size that can be read.
      expect(layout.text.top).toBeGreaterThanOrEqual(layout.textArea.top - 1);
      expect(layout.text.bottom).toBeLessThanOrEqual(
        layout.textArea.bottom + 1,
      );
      expect(layout.fontSize).toBeGreaterThanOrEqual(12);
      // Card and buttons are all on screen.
      expect(layout.buttons).toHaveLength(3);
      for (const box of [layout.card, ...layout.buttons]) {
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(size.height);
        expect(box.right).toBeLessThanOrEqual(size.width);
      }
    });
  }

  test("reports a card anonymously, with its reference only", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 1 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await page.getByRole("button", { name: "Signaler cette carte" }).click();
    const sent = page.waitForRequest("/api/reports");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Signaler", exact: true })
      .click();

    expect((await sent).postDataJSON()).toEqual({
      cardId: "DUE-001",
      message: "",
    });
    await expect(page.getByRole("dialog")).toContainText("C'est noté, merci.");
  });
});

test.describe("the end of a game", () => {
  test("shows the ranking, keeps favourites, and plays again", async ({
    page,
    isMobile,
  }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 1 }],
    });
    await page.goto("/partie");
    await stayUpright(page, isMobile);

    await page.getByRole("button", { name: "Terminer la partie" }).click();
    await page.getByRole("button", { name: "Voir le classement" }).click();

    await expect(page).toHaveURL("/fin");
    await expect(page.getByTestId("ranking-row")).toHaveCount(3);

    const favourite = page.getByRole("button", {
      name: "Garder la carte DUE-001 en favori",
    });
    await favourite.click();
    await expect(favourite).toHaveAttribute("aria-pressed", "true");

    await page.goto("/favoris");
    await expect(page.getByRole("listitem")).toContainText(
      "concours de regard",
    );

    await page.goto("/fin");
    await page.getByRole("button", { name: "Rejouer" }).click();
    await expect(page).toHaveURL("/partie");
    await expect(page.getByText("Carte 1 /")).toBeVisible();
  });

  test("an empty favourites list says so, with a way to play", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/favoris");

    await expect(page.getByText(/Aucun favori/)).toBeVisible();
    await page.getByRole("link", { name: "Jouer" }).click();
    await expect(page).toHaveURL("/jouer");
  });
});

test.describe("settings", () => {
  test("a theme applies at once, with a sample card, and stays", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/reglages");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme");
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const night = await background();

    await page.getByText("Crème", { exact: true }).click();

    await expect(html).toHaveAttribute("data-theme", "creme");
    expect(await background()).not.toBe(night);
    const sample = page.getByRole("group", { name: "Aperçu du thème" });
    await expect(sample.locator("mark")).toHaveText("Romain");
    await expect(sample).toContainText("Défis · Montre ou bois");

    await page.reload();

    // Set before the first paint, by theme.js: no flash of the default theme.
    await expect(html).toHaveAttribute("data-theme", "creme");
    await expect(page.getByRole("radio", { name: /Crème/ })).toBeChecked();
  });

  test("erases everything kept on the phone", async ({ page }) => {
    await asReturningPlayer(page, {
      prefs: { players: trio, favorites: ["TP-001"] },
      turns: [{ cardId: "DUE-001", players: ["p0", "p1"], stake: 1 }],
    });
    await page.goto("/reglages");

    await page
      .getByRole("button", { name: "Effacer toutes les données" })
      .click();
    await page.getByRole("button", { name: "Tout effacer" }).click();

    // Back to the very first visit.
    await expect(
      page.getByRole("button", { name: "J'ai 18 ans ou plus" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => Object.keys(localStorage).join()),
    ).not.toContain("zbeul:game");
    await page.getByRole("button", { name: "J'ai 18 ans ou plus" }).click();
    await expect(page.getByRole("link", { name: "Jouer" })).toBeVisible();
    await page.goto("/favoris");
    await expect(page.getByText(/Aucun favori/)).toBeVisible();
  });

  test("sends a problem report, and says when the server refuses", async ({
    page,
  }) => {
    await asReturningPlayer(page);
    await page.goto("/signaler");

    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(
      page.getByText(/Dis-nous au moins quelques mots/),
    ).toBeVisible();

    await page.getByLabel("Ton message").fill("Le bouton Joker boude.");
    await page.getByLabel("Carte concernée (facultatif)").fill("tp-001");
    const sent = page.waitForRequest("/api/reports");
    await page.getByRole("button", { name: "Envoyer" }).click();

    expect((await sent).postDataJSON()).toEqual({
      cardId: "TP-001",
      message: "Le bouton Joker boude.",
    });
    await expect(page.getByRole("status")).toContainText("Bien reçu, merci.");
  });
});
