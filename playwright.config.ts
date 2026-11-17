import { defineConfig, devices } from "@playwright/test";
import { SIGNED_IN_STATE } from "./e2e/auth-state";
import { databaseNames, e2ePort } from "./scripts/checkout";

// Each checkout, such as an agent's git worktree, gets its own port and test
// database, so test runs in different checkouts can happen at once.
const PORT = Number(process.env.E2E_PORT ?? e2ePort());
const BASE_URL = `http://localhost:${PORT}`;

// Its own database, recreated on every run by e2e/reset-database.ts. Set on
// process.env so the server, and the test workers, use it instead of .env.
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgres://zbeul:zbeul@localhost:5432/${databaseNames().e2e}`;

// The server under test: the production build of the SPA, served by the
// bundled BFF, signing in through the local Keycloak (`yarn keycloak:up`).
Object.assign(process.env, {
  NODE_ENV: "production",
  PUBLIC_URL: BASE_URL,
  PORT: String(PORT),
  HOST: "127.0.0.1",
  STATIC_DIR: "apps/web/dist",
  // Production requires at least 32 characters (apps/bff/src/env.ts).
  SESSION_SECRET: "e2e-secret-not-for-production-0123456789",
  OIDC_ISSUER:
    process.env.E2E_OIDC_ISSUER ?? "http://localhost:8180/realms/zbeul",
  OIDC_CLIENT_ID: "zbeul-web",
  OIDC_CLIENT_SECRET: "zbeul-web-dev-secret",
  // The admin of e2e/admin.spec.ts, who chooses a password in the first test.
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_SETUP_CODE: "e2e-setup-code-0123456789",
  // Tests never send real mail, even with SMTP settings in .env: an empty
  // SMTP_HOST wins over the file and means mail is only logged (src/mail.ts).
  SMTP_HOST: "",
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // The service worker would answer from its cache instead of the server,
    // hiding what a test changes. e2e/pwa.spec.ts turns it back on.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "setup",
      testMatch: "auth.setup.ts",
    },
    {
      name: "api",
      testMatch: "api.spec.ts",
      dependencies: ["setup"],
      use: { storageState: SIGNED_IN_STATE },
    },
    {
      // One admin account for the whole run, whose password is set once: its
      // tests run in order, in one browser.
      name: "admin",
      testMatch: "admin.spec.ts",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop",
      testIgnore: ["api.spec.ts", "auth.setup.ts", "admin.spec.ts"],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: SIGNED_IN_STATE },
    },
    {
      name: "mobile",
      testIgnore: ["api.spec.ts", "auth.setup.ts", "admin.spec.ts"],
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: SIGNED_IN_STATE },
    },
  ],
  // Tests run against the production build, on their own port, so a running
  // `yarn dev` is left alone.
  webServer: {
    command:
      "yarn db:up && yarn keycloak:up && yarn tsx e2e/reset-database.ts && yarn build && yarn start",
    url: `${BASE_URL}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
