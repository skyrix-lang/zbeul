import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import type { Booking } from "@zbeul/core";
import { createLocalSession, storageState } from "../scripts/local-session";

/**
 * Every test also fails on:
 * - a console error or uncaught exception in the app (not on Keycloak's
 *   pages). Tests that trigger an error on purpose opt out with
 *   `test.use({ allowConsoleErrors: true })`.
 * - an accessibility violation (WCAG 2.2 AA, checked with axe) on the app
 *   page the test ends on.
 */
export const test = base.extend<{
  allowConsoleErrors: boolean;
  failOnConsoleError: void;
  checkAccessibility: void;
}>({
  // Sign-ins are rate limited per client address, which the app reads from
  // x-forwarded-for. Each test gets its own, as if from its own machine, so
  // parallel tests don't share a limit.
  // (`provide` is Playwright's `use`, renamed so it isn't taken for React's.)
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": randomIp() });
  },
  allowConsoleErrors: [false, { option: true }],
  failOnConsoleError: [
    async ({ page, allowConsoleErrors, baseURL }, use) => {
      const errors: string[] = [];
      const fromApp = () => page.url().startsWith(baseURL!);
      page.on("console", (message) => {
        if (message.type() === "error" && fromApp())
          errors.push(message.text());
      });
      page.on("pageerror", (error) => {
        if (fromApp()) errors.push(error.message);
      });

      await use();

      if (!allowConsoleErrors) expect(errors).toEqual([]);
    },
    { auto: true },
  ],
  checkAccessibility: [
    async ({ page, baseURL }, use, testInfo) => {
      await use();
      if (testInfo.status !== testInfo.expectedStatus) return;
      if (!page.url().startsWith(baseURL!)) return;
      // A card sliding in is half transparent for a moment: axe would measure
      // its contrast mid-animation.
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map(
          ({ id, nodes }) =>
            `${id}: ${nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 120)}`).join(", ")}`,
        ),
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits for the page's animations to end. Looping decorations never do. */
export async function animationsDone(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
}

/** An address in 198.18.0.0/15, a range reserved for testing. */
function randomIp() {
  const [a = 0, b = 0, c = 0] = randomBytes(3);
  return `198.${18 + (a % 2)}.${b}.${c}`;
}

/**
 * Tests run in parallel against one database, so a test that changes data
 * creates its own booking, with a unique title, and leaves the seed data alone.
 */
export async function createBooking(
  request: APIRequestContext,
  overrides: Partial<Booking> = {},
): Promise<Booking> {
  const response = await request.post("/api/bookings", {
    data: {
      title: `E2E ${randomUUID()}`,
      description: "Created by a test",
      date: "2030-01-15",
      time: "10:30",
      duration: 30,
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function setBookingStatus(
  request: APIRequestContext,
  id: string,
  status: Booking["status"],
) {
  const response = await request.patch(`/api/bookings/${id}`, {
    data: { status },
  });
  expect(response.ok()).toBe(true);
}

async function withDatabase<T>(run: (db: Client) => Promise<T>) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

/** Removes a row directly: the app has no delete, and this mimics another user. */
export async function deleteBookingFromDatabase(id: string) {
  await withDatabase((db) =>
    db.query("DELETE FROM bookings WHERE id = $1", [id]),
  );
}

/** Ends a user's sessions directly in the database, as if they had expired. */
export async function deleteSessionsFromDatabase(email: string) {
  await withDatabase((db) =>
    db.query(
      "DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [email],
    ),
  );
}

/** A storage state signed in as `email`, written straight to the database. */
export async function createSessionFor(email: string, baseURL: string) {
  const db = drizzle(process.env.DATABASE_URL!);
  try {
    const { token, expiresAt } = await createLocalSession(db, email);
    return storageState(new URL(baseURL), token, expiresAt);
  } finally {
    await db.$client.end();
  }
}

/** Signs this browser context in as a new user of its own. Returns the email. */
export async function signInAsNewUser(
  context: BrowserContext,
  baseURL: string,
) {
  const email = uniqueEmail();
  const state = await createSessionFor(email, baseURL);
  await context.addCookies(state.cookies);
  return email;
}

/**
 * Opens a page and waits until the app has rendered it, for tests that depend
 * on client behaviour. Everything is rendered by JavaScript, so the header
 * showing means React is running.
 */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole("banner")).toBeVisible();
}

export function bookingCard(page: Page, title: string) {
  return page
    .getByTestId("booking-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

export function uniqueEmail(domain = "example.test") {
  return `e2e-${randomUUID()}@${domain}`;
}

/** For tests that start signed out, or sign in as their own user. */
export const signedOut = { storageState: { cookies: [], origins: [] } };

/** The users in docker/keycloak/realm.json. */
export const KEYCLOAK_USERS = {
  ada: { username: "ada", password: "ada", email: "ada@example.test" },
  grace: { username: "grace", password: "grace", email: "grace@example.test" },
  // Only for e2e/account-linking.spec.ts, which needs users nobody else signs in as.
  linus: { username: "linus", password: "linus", email: "linus@example.test" },
  // Claims victim@example.test without having verified it.
  mallory: {
    username: "mallory",
    password: "mallory",
    email: "victim@example.test",
  },
} as const;

/** A user created ahead of their first sign-in: an email, no identity, one booking. */
export async function createUserWithBooking(email: string, title: string) {
  await withDatabase(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      "INSERT INTO users (email) VALUES ($1) RETURNING id",
      [email],
    );
    await db.query(
      "INSERT INTO bookings (user_id, title, date, time, duration) VALUES ($1, $2, '2030-05-01', '10:00', 30)",
      [rows[0]!.id, title],
    );
  });
}

/** Fills in Keycloak's login form, which must be open. */
export async function logInOnKeycloak(
  page: Page,
  user: { username: string; password: string },
) {
  await page.getByLabel("Username or email").fill(user.username);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

// ── The game ─────────────────────────────────────────────────────────────────

/** The game keeps everything in localStorage, under these two keys. */
const PREFS_KEY = "zbeul:prefs";
const GAME_KEY = "zbeul:game";

export interface SeedPlayer {
  id: string;
  name: string;
  gender: "gars" | "fille" | "autre";
  ceiling: number | null;
  excluded: string[];
  team: number | null;
}

export const somePlayers = (...names: string[]): SeedPlayer[] =>
  names.map((name, index) => ({
    id: `p${index}`,
    name,
    gender: (["gars", "fille", "autre"] as const)[index % 3]!,
    ceiling: null,
    excluded: [],
    team: null,
  }));

export const defaultSettings = {
  format: "solo",
  teams: ["Équipe 1", "Équipe 2"],
  level: 2,
  pressure: false,
  games: [
    "tu-preferes",
    "jamais",
    "action-verite",
    "qui-pourrait",
    "tribunal",
    "duel",
    "culture-g",
    "chaine",
    "valise",
    "montre-ou-bois",
    "tout-le-monde",
    "sentence",
    "regle",
    "partenaire",
  ],
  sips: false,
  intensity: "normale",
  progressive: true,
  duration: 30,
  excluded: [] as string[],
};

/**
 * What a returning adult has on their phone: the age gate passed, and
 * whatever the test adds. Written once, before the app loads, so a reload in
 * the test keeps what the app saved since.
 */
export async function asReturningPlayer(
  page: Page,
  {
    prefs = {},
    turns,
    game = {},
  }: {
    prefs?: Record<string, unknown>;
    /** Starts a game in progress with these cards already drawn. */
    turns?: { cardId: string; players: string[]; stake: number }[];
    game?: Record<string, unknown>;
  } = {},
) {
  const players = (prefs.players as SeedPlayer[] | undefined) ?? [];
  const settings = { ...defaultSettings, ...(prefs.settings as object) };
  const savedPrefs = {
    state: {
      ageConfirmedAt: Date.now(),
      theme: "nuit",
      favorites: [],
      recent: [],
      teamMode: "random",
      alcoholWarned: false,
      rotateHintClosed: false,
      pendingReports: [],
      ...prefs,
      settings,
      players,
    },
    version: 1,
  };
  const savedGame = turns && {
    state: {
      game: {
        id: "seeded",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        settings,
        players,
        turns,
        finished: false,
        outOfCards: false,
        scores: Object.fromEntries(
          players.map((player) => [player.id, { won: 0, lost: 0 }]),
        ),
        rules: [],
        partners: [],
        genderSlots: [],
        nextPauseAt: 999,
        ...game,
      },
    },
    version: 1,
  };
  await page.addInitScript(
    ([prefsKey, gameKey, prefsValue, gameValue]) => {
      if (sessionStorage.getItem("e2e-seeded")) return;
      sessionStorage.setItem("e2e-seeded", "1");
      localStorage.setItem(prefsKey!, prefsValue!);
      if (gameValue) localStorage.setItem(gameKey!, gameValue);
    },
    [
      PREFS_KEY,
      GAME_KEY,
      JSON.stringify(savedPrefs),
      savedGame ? JSON.stringify(savedGame) : "",
    ] as const,
  );
}

/** What the game saved on the phone: the current game, or null. */
export async function savedGame(page: Page) {
  return page.evaluate((key) => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved).state.game : null;
  }, GAME_KEY);
}

// ── The admin ────────────────────────────────────────────────────────────────

/** Matches playwright.config.ts. */
export const ADMIN = {
  email: "admin@example.test",
  setupCode: "e2e-setup-code-0123456789",
  password: "Cactus-Volant-42",
};

/** A report as a player sends it, with a message no other test uses. */
export async function createReport(
  request: APIRequestContext,
  cardId?: string,
) {
  const message = `E2E ${randomUUID()}`;
  const response = await request.post("/api/reports", {
    data: { cardId, message },
  });
  expect(response.status()).toBe(204);
  return message;
}
