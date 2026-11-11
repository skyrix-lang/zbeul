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
    page.getByRole("heading", { name: "Zbeul, admin" }),
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
    page.getByRole("heading", { name: "Zbeul, admin" }),
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
