import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { Report } from "@zbeul/api";
import {
  getGetAdminStatusMockHandler,
  getGetMeMockHandler,
  getListReportsMockHandler,
} from "@zbeul/api/mocks";
import { server } from "@zbeul/api/test-server";
import { AdminPage } from "./admin-page";
import { renderPage } from "./test-utils";

const page = (
  <AdminPage
    status="open"
    notFound={<h1>Page introuvable</h1>}
    renderCard={(cardId) => <p>Aperçu de {cardId}</p>}
  />
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
      http.patch("*/api/admin/reports/:id", async ({ request, params }) => {
        filed = { id: params.id, ...((await request.json()) as object) };
        return HttpResponse.json({ ...report, status: "handled" });
      }),
    );
    await renderPage(page);
    const user = userEvent.setup();

    const row = await screen.findByTestId("report");
    expect(row).toHaveTextContent("Cette carte est fausse.");
    expect(row).toHaveTextContent("Aperçu de TP-001");

    await user.click(within(row).getByRole("button", { name: "Traité" }));

    await waitFor(() =>
      expect(filed).toEqual({ id: report.id, status: "handled" }),
    );
  });

  it("says so when filing a report fails", async () => {
    server.use(
      ...signedIn(true),
      getListReportsMockHandler([report]),
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
    server.use(
      getGetAdminStatusMockHandler({ setupNeeded: false }),
      http.get("*/api/me", () =>
        HttpResponse.json({
          user: signedInStill
            ? { email: "ada@example.test", name: null, isAdmin: true }
            : null,
        }),
      ),
      // To anyone but the admin, the reports don't exist.
      http.get("*/api/admin/reports", () => {
        signedInStill = false;
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      }),
    );
    await renderPage(page);

    expect(
      await screen.findByRole("button", { name: "Se connecter" }),
    ).toBeVisible();
  });
});
