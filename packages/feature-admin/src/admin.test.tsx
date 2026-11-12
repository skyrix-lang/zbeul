import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { AdminCard, CardChange, Pack, Report } from "@zbeul/api";
import {
  getGetAdminStatusMockHandler,
  getGetMeMockHandler,
  getListCardChangesMockHandler,
  getListCardsMockHandler,
  getListPacksMockHandler,
  getListReportsMockHandler,
} from "@zbeul/api/mocks";
import { server } from "@zbeul/api/test-server";
import { CardFormPage } from "./card-form";
import { filterCards } from "./cards-page";
import { describeChange, type RenderCard } from "./labels";
import { AdminGate } from "./layout";
import { ReportsPage } from "./reports-page";
import { renderPage } from "./test-utils";

const renderCard: RenderCard = (card, options) => (
  <p data-testid="preview">
    Aperçu de {card.id} : {card.text} ({card.targets} joueurs
    {options?.stake ? `, enjeu ${options.stake}` : ""})
  </p>
);

const page = (
  <AdminGate notFound={<h1>Page introuvable</h1>}>
    <ReportsPage status="open" renderCard={renderCard} />
  </AdminGate>
);

const signedOut = (setupNeeded = false) => [
  getGetMeMockHandler({ user: null }),
  getGetAdminStatusMockHandler({ setupNeeded }),
];
const signedIn = (isAdmin: boolean) => [
  getGetMeMockHandler({
    user: { email: "ada@example.test", name: null, isAdmin },
  }),
  getGetAdminStatusMockHandler({ setupNeeded: false }),
];

const card = (overrides: Partial<AdminCard> = {}): AdminCard => ({
  id: "TP-001",
  game: "tu-preferes",
  level: 1,
  text: "Tu préfères pouvoir voler ou être invisible ?",
  themes: [],
  packId: "officiel",
  status: "published",
  audience: null,
  doubleTier: false,
  witness: false,
  ruleDuration: null,
  answer: null,
  unit: null,
  source: null,
  updatedAt: "2030-03-10T21:30:00.000Z",
  ...overrides,
});

const pack: Pack = {
  id: "officiel",
  name: "Pack officiel",
  description: "",
  published: true,
  cards: 870,
  publishedCards: 870,
};

const report: Report = {
  id: "6f1c1b7e-2f0a-4c55-9b7c-1d2e3f4a5b6c",
  cardId: "TP-001",
  message: "Cette carte est fausse.",
  status: "open",
  createdAt: "2030-03-10T21:30:00.000Z",
};

const refuse = (path: string, status: number) =>
  http.post(`*/api/admin/${path}`, () =>
    HttpResponse.json({ error: "Refused" }, { status }),
  );

describe("signed out", () => {
  it("asks for the password, and says when it is wrong", async () => {
    server.use(...signedOut(), refuse("login", 403));
    await renderPage(page);
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "nope");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Adresse, mot de passe ou code refusé.",
    );
    // Still the form, with what was typed.
    expect(screen.getByLabelText("Adresse e-mail")).toHaveValue(
      "ada@example.test",
    );
  });

  it("says to wait after too many attempts", async () => {
    server.use(...signedOut(), refuse("login", 429));
    await renderPage(page);
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText("Adresse e-mail"),
      "ada@example.test",
    );
    await user.type(screen.getByLabelText("Mot de passe"), "nope");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Trop d'essais. Réessaie dans un quart d'heure.",
    );
  });

  it("doesn't send a weak first password, and lists what it lacks", async () => {
    let sent = 0;
    server.use(
      ...signedOut(true),
      http.post("*/api/admin/setup", () => {
        sent++;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage(page);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Première connexion" }),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("Adresse e-mail du compte admin"),
      "ada@example.test",
    );
    await user.type(
      screen.getByLabelText("Nouveau mot de passe"),
      "motdepasse",
    );
    await user.type(screen.getByLabelText("Code d'installation"), "the-code");
    await user.click(
      screen.getByRole("button", { name: "Créer le mot de passe" }),
    );

    expect(
      await screen.findByText(/Il manque encore quelque chose/),
    ).toBeVisible();
    const rules = screen.getByRole("list", {
      name: "Ce qu'il faut dans le mot de passe",
    });
    expect(within(rules).getAllByLabelText("Manque :")).toHaveLength(4);
    expect(within(rules).getAllByLabelText("OK :")).toHaveLength(1);
    expect(sent).toBe(0);
  });
});

describe("signed in", () => {
  it("shows 'page not found' to anyone but the admin", async () => {
    server.use(...signedIn(false));
    await renderPage(page);

    expect(
      await screen.findByRole("heading", { name: "Page introuvable" }),
    ).toBeVisible();
    expect(screen.queryByText("Signalements")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Se connecter" }),
    ).not.toBeInTheDocument();
  });

  it("lists the reports with their card, and files one", async () => {
    let filed: unknown;
    server.use(
      ...signedIn(true),
      getListReportsMockHandler([report]),
      getListCardsMockHandler([card()]),
      http.patch("*/api/admin/reports/:id", async ({ request, params }) => {
        filed = { id: params.id, ...((await request.json()) as object) };
        return HttpResponse.json({ ...report, status: "handled" });
      }),
    );
    await renderPage(page);
    const user = userEvent.setup();

    const row = await screen.findByTestId("report");
    expect(row).toHaveTextContent("Cette carte est fausse.");
    expect(await within(row).findByTestId("preview")).toHaveTextContent(
      "Aperçu de TP-001 : Tu préfères pouvoir voler",
    );
    // From a report, the card can be corrected or archived.
    expect(
      within(row).getByRole("link", { name: "Corriger ou archiver la carte" }),
    ).toHaveAttribute("href", "/admin/cartes/TP-001");

    await user.click(within(row).getByRole("button", { name: "Traité" }));

    await waitFor(() =>
      expect(filed).toEqual({ id: report.id, status: "handled" }),
    );
  });

  it("says so when filing a report fails", async () => {
    server.use(
      ...signedIn(true),
      getListReportsMockHandler([report]),
      getListCardsMockHandler([]),
      http.patch("*/api/admin/reports/:id", () =>
        HttpResponse.json({ error: "Boom" }, { status: 500 }),
      ),
    );
    await renderPage(page);
    const user = userEvent.setup();

    const row = await screen.findByTestId("report");
    await user.click(within(row).getByRole("button", { name: "Sans suite" }));

    expect(await within(row).findByRole("alert")).toHaveTextContent(
      "Ça n'a pas marché. Réessaie.",
    );
  });

  it("goes back to the sign-in form when the session has ended", async () => {
    let signedInStill = true;
    const gone = () => {
      signedInStill = false;
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    };
    server.use(
      getGetAdminStatusMockHandler({ setupNeeded: false }),
      http.get("*/api/me", () =>
        HttpResponse.json({
          user: signedInStill
            ? { email: "ada@example.test", name: null, isAdmin: true }
            : null,
        }),
      ),
      // To anyone but the admin, the admin's data doesn't exist.
      http.get("*/api/admin/reports", gone),
      http.get("*/api/admin/cards", gone),
    );
    await renderPage(page);

    expect(
      await screen.findByRole("button", { name: "Se connecter" }),
    ).toBeVisible();
  });
});

describe("the list of cards", () => {
  const cards = [
    card(),
    card({ id: "TP-016", level: 5, status: "archived", text: "Tu préfères…" }),
    card({
      id: "DUE-001",
      game: "duel",
      text: "[J1] contre [J2] : bras de fer.",
    }),
    card({
      id: "CG-009",
      game: "culture-g",
      packId: "couple",
      status: "draft",
    }),
  ];
  const ids = (filters: Parameters<typeof filterCards>[1]) =>
    filterCards(cards, filters).map((other) => other.id);

  it("filters by mini-game, level, status and pack", () => {
    expect(ids({})).toHaveLength(4);
    expect(ids({ game: "tu-preferes" })).toEqual(["TP-001", "TP-016"]);
    expect(ids({ game: "tu-preferes", level: 5 })).toEqual(["TP-016"]);
    expect(ids({ status: "draft" })).toEqual(["CG-009"]);
    expect(ids({ pack: "couple" })).toEqual(["CG-009"]);
    expect(ids({ game: "duel", status: "archived" })).toEqual([]);
  });

  it("searches the text and the reference, whatever the accents or case", () => {
    expect(ids({ q: "BRAS de fer" })).toEqual(["DUE-001"]);
    expect(ids({ q: "preferes" })).toEqual(["TP-001", "TP-016", "CG-009"]);
    expect(ids({ q: "cg-0" })).toEqual(["CG-009"]);
  });
});

describe("the card form", () => {
  const form = <CardFormPage renderCard={renderCard} />;
  const handlers = () => [
    getListCardsMockHandler([card()]),
    getListPacksMockHandler([pack]),
    getListCardChangesMockHandler([]),
  ];

  it("asks a quiz question for its sourced answer before sending anything", async () => {
    let sent: unknown;
    server.use(
      ...handlers(),
      http.post("*/api/admin/cards", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(card({ id: "CG-154", game: "culture-g" }), {
          status: 201,
        });
      }),
    );
    await renderPage(form, "/admin/cartes/nouvelle");
    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByLabelText("Mini-jeu"),
      "Culture G",
    );
    await user.type(
      screen.getByLabelText("Texte"),
      "[[J1], [[J2], [[J3] et [[J4] : combien de pattes a une araignée ?",
    );
    await user.click(screen.getByRole("button", { name: "Créer la carte" }));

    expect(
      await screen.findByText("Une question a une réponse."),
    ).toBeVisible();
    expect(screen.getByText("Une réponse a une source.")).toBeVisible();
    expect(sent).toBeUndefined();

    await user.type(screen.getByLabelText("Réponse"), "8");
    await user.type(screen.getByLabelText("Unité"), "pattes");
    await user.type(screen.getByLabelText("Source"), "Muséum, 2024");
    await user.selectOptions(screen.getByLabelText("Niveau"), "2 · Festif");
    await user.click(screen.getByRole("button", { name: "Créer la carte" }));

    await waitFor(() =>
      expect(sent).toMatchObject({
        game: "culture-g",
        level: 2,
        text: "[J1], [J2], [J3] et [J4] : combien de pattes a une araignée ?",
        answer: "8",
        unit: "pattes",
        source: "Muséum, 2024",
        packId: "officiel",
        status: "draft",
      }),
    );
  });

  it("previews the card at several stakes while it is written", async () => {
    server.use(...handlers());
    await renderPage(form, "/admin/cartes/nouvelle");
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Mini-jeu"), "Duel");
    expect(screen.getByText(/L'aperçu arrive/)).toBeVisible();
    await user.type(
      screen.getByLabelText("Texte"),
      "[[J1] contre [[J2] : bras de fer.",
    );

    const previews = await screen.findAllByTestId("preview");
    expect(previews.map((preview) => preview.textContent)).toEqual([
      "Aperçu de DUE-000 : [J1] contre [J2] : bras de fer. (2 joueurs, enjeu 1)",
      "Aperçu de DUE-000 : [J1] contre [J2] : bras de fer. (2 joueurs, enjeu 5)",
      "Aperçu de DUE-000 : [J1] contre [J2] : bras de fer. (2 joueurs, enjeu 3)",
    ]);
  });

  it("says what is wrong with the players a text names", async () => {
    server.use(...handlers());
    await renderPage(form, "/admin/cartes/nouvelle");
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Mini-jeu"), "Duel");
    await user.type(screen.getByLabelText("Texte"), "[[J1] contre personne.");
    await user.click(screen.getByRole("button", { name: "Créer la carte" }));

    expect(
      await screen.findByText("Ce mini-jeu cite 2 joueurs : [J1] à [J2]."),
    ).toBeVisible();
  });

  it("opens an existing card with its history, and saves a change", async () => {
    let saved: unknown;
    const change: CardChange = {
      id: "0b0f3c5e-1111-4c55-9b7c-1d2e3f4a5b6c",
      cardId: "TP-001",
      adminEmail: "ada@example.test",
      action: "updated",
      before: { level: 1, status: "draft", text: "Avant" },
      after: { level: 2, status: "published", text: "Après" },
      createdAt: "2030-03-10T21:30:00.000Z",
    };
    server.use(
      getListCardsMockHandler([card()]),
      getListPacksMockHandler([pack]),
      getListCardChangesMockHandler([change]),
      http.patch("*/api/admin/cards/:id", async ({ request, params }) => {
        saved = { id: params.id, ...((await request.json()) as object) };
        return HttpResponse.json(card({ status: "archived" }));
      }),
    );
    await renderPage(
      <CardFormPage cardId="TP-001" renderCard={renderCard} />,
      "/admin/cartes/TP-001",
    );
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Carte TP-001" }),
    ).toBeVisible();
    // The reference says which mini-game a card is: it can't change.
    expect(screen.getByLabelText("Mini-jeu")).toBeDisabled();
    expect(
      await screen.findByText(
        "niveau : Apéro entre potes → Festif ; statut : Brouillon → Publiée ; texte modifié",
      ),
    ).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Statut"), "Archivée");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Enregistré.");
    expect(saved).toMatchObject({
      id: "TP-001",
      game: "tu-preferes",
      status: "archived",
    });
  });

  it("says so when the card doesn't exist", async () => {
    server.use(...handlers());
    await renderPage(
      <CardFormPage cardId="NOPE-1" renderCard={renderCard} />,
      "/admin/cartes/NOPE-1",
    );

    expect(
      await screen.findByRole("heading", { name: "Carte introuvable" }),
    ).toBeVisible();
  });
});

describe("describeChange", () => {
  const change = (before: object | null, after: object): CardChange => ({
    id: "0b0f3c5e-1111-4c55-9b7c-1d2e3f4a5b6c",
    cardId: "TP-001",
    adminEmail: "ada@example.test",
    action: before ? "updated" : "created",
    before: before as CardChange["before"],
    after: after as CardChange["after"],
    createdAt: "2030-03-10T21:30:00.000Z",
  });

  it("says what changed, field by field", () => {
    expect(describeChange(change(null, { text: "Nouvelle" }))).toEqual([
      "Carte créée",
    ]);
    expect(
      describeChange(
        change(
          { themes: [], doubleTier: false, packId: "officiel", answer: null },
          { themes: ["ex"], doubleTier: true, packId: "couple", answer: "8" },
        ),
      ),
    ).toEqual([
      "thèmes : aucun → ex",
      "double palier : non → oui",
      "pack : officiel → couple",
      "réponse : rien → 8",
    ]);
  });
});
