import {
  createUserAhead,
  expect,
  identityOf,
  KEYCLOAK_USERS,
  logInOnKeycloak,
  signedInEmail,
  signedOut,
  test,
} from "./support";

// apps/bff/src/users.ts: a user created ahead of their first sign-in (by
// `yarn dev:session`, or by email in advance) keeps their account, but only
// when the provider has verified the email. Each case uses its own Keycloak
// user, and runs once: the first sign-in is the one that links.
test.describe.configure({ mode: "serial" });
test.use(signedOut);

test("a verified email links to the existing user", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the first sign-in links; run it once");
  const id = await createUserAhead(KEYCLOAK_USERS.linus.email);

  await page.goto("/auth/login");
  await logInOnKeycloak(page, KEYCLOAK_USERS.linus);
  await expect(page).toHaveURL("/");

  expect(await identityOf(id)).not.toBeNull();
  expect(await signedInEmail(page)).toBe(KEYCLOAK_USERS.linus.email);
});

test("an unverified email doesn't take over someone's account", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the first sign-in links; run it once");
  const victim = await createUserAhead(KEYCLOAK_USERS.mallory.email);

  await page.goto("/auth/login");
  await logInOnKeycloak(page, KEYCLOAK_USERS.mallory);
  await expect(page).toHaveURL("/");

  expect(await identityOf(victim)).toBeNull();
  // Nor does the unverified address show as theirs.
  expect(await signedInEmail(page)).not.toBe(KEYCLOAK_USERS.mallory.email);
});
