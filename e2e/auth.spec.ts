import {
  expect,
  KEYCLOAK_USERS,
  logInOnKeycloak,
  signedInEmail,
  signedOut,
  test,
} from "./support";

// Sign-in through Keycloak. No page needs it yet (the game has no account,
// the admin has its own password), so these check the session through
// /api/me.

test.describe("signed out", () => {
  test.use(signedOut);

  test("the sign-in page goes through Keycloak and comes back", async ({
    page,
  }) => {
    await page.goto("/sign-in?returnTo=%2Fjouer");
    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Continuer vers la connexion" })
      .click();
    await logInOnKeycloak(page, KEYCLOAK_USERS.ada);

    await expect(page).toHaveURL("/jouer");
    expect(await signedInEmail(page)).toBe(KEYCLOAK_USERS.ada.email);
  });

  test("ignores a return address on another site", async ({ page }) => {
    await page.goto("/sign-in?returnTo=https%3A%2F%2Fevil.example");
    await page
      .getByRole("link", { name: "Continuer vers la connexion" })
      .click();
    await logInOnKeycloak(page, KEYCLOAK_USERS.grace);

    await expect(page).toHaveURL("/");
  });

  test("a wrong password stays on Keycloak", async ({ page }) => {
    await page.goto("/auth/login");
    await logInOnKeycloak(page, { username: "ada", password: "wrong" });

    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("a callback without a sign-in in progress is refused", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=forged&state=forged");

    await expect(page).toHaveURL("/sign-in?error=Expired");
    await expect(page.getByRole("alert")).toContainText("a pris trop de temps");
  });

  test("the session cookie is HttpOnly and SameSite", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/login");
    await logInOnKeycloak(page, KEYCLOAK_USERS.ada);
    await expect(page).toHaveURL("/");

    const session = (await context.cookies()).find((c) => c.name === "session");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "session=",
    );
  });
});

// Signs in as its own user: signing out would otherwise end the session the
// other tests share.
test.describe("own session", () => {
  test.use(signedOut);

  test("signing out ends the Keycloak session too", async ({ page }) => {
    await page.goto("/auth/login?returnTo=/sign-in");
    await logInOnKeycloak(page, KEYCLOAK_USERS.grace);
    // Signed in, the sign-in page sends you on: home, by default.
    await expect(page).toHaveURL("/");

    expect(await signedInEmail(page)).toBe(KEYCLOAK_USERS.grace.email);

    // What the header's sign-out button sends (components/user-menu.tsx),
    // which no page shows a signed-in visitor yet.
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/auth/logout";
      document.body.append(form);
      form.submit();
    });

    await expect(page).toHaveURL("/");
    expect(await signedInEmail(page)).toBeNull();
    // Keycloak asks for the password again: its own session ended as well.
    await page.goto("/auth/login");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
});

test.describe("sign-in limits", () => {
  test.use(signedOut);

  test("starts at most 30 sign-ins per client in 15 minutes", async ({
    request,
  }) => {
    for (let started = 0; started < 30; started++) {
      const response = await request.get("/auth/login", { maxRedirects: 0 });
      expect(response.headers().location).toContain("/realms/zbeul/");
    }

    const refused = await request.get("/auth/login", { maxRedirects: 0 });

    expect(refused.headers().location).toBe("/sign-in?error=RateLimited");
  });
});
