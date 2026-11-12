import {
  boolean,
  customType,
  jsonb,
  smallint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AUDIENCES,
  BOOKING_STATUSES,
  CARD_STATUSES,
  CONTENT_THEMES,
  MINI_GAMES,
  REPORT_STATUSES,
  type ReportReason,
} from "@zbeul/core";

export const bookingStatus = pgEnum("booking_status", BOOKING_STATUSES);

// Postgres returns "09:00:00"; the app works with "09:00".
const timeOfDay = customType<{ data: string; driverData: string }>({
  dataType: () => "time(0)",
  fromDriver: (value) => value.slice(0, 5),
});

// Each booking belongs to the user who created it, and only they can see or
// change it (apps/bff/src/bookings.ts).
export const bookings = pgTable(
  "bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text().notNull().default(""),
    date: date({ mode: "string" }).notNull(),
    time: timeOfDay().notNull(),
    duration: integer().notNull(),
    status: bookingStatus().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set by Drizzle on every update made through it, not by the database.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Serves the list: one user's bookings, in date order.
  (booking) => [
    index("bookings_user_id_date_time_idx").on(
      booking.userId,
      booking.date,
      booking.time,
    ),
  ],
);

// Fixed-window counters for apps/bff/src/rate-limit.ts, such as sign-in emails per
// address. A row is reused when its window has passed, and deleted later.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (rateLimit) => [index("rate_limits_reset_at_idx").on(rateLimit.resetAt)],
);

// People who have signed in. A user is identified by their identity provider
// (`oidc_issuer`) and its id for them (`oidc_subject`), never by email, which
// the provider may let them change. The name is refreshed at each sign-in; the
// email is set once, when verified (apps/bff/src/users.ts).
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text(),
    email: text().unique(),
    oidcIssuer: text("oidc_issuer"),
    oidcSubject: text("oidc_subject"),
    // The admin signs in with a password instead of an identity provider
    // (apps/bff/src/admin.ts). A scrypt hash, never the password; null until
    // the admin has chosen one.
    passwordHash: text("password_hash"),
    isAdmin: boolean("is_admin").notNull().default(false),
  },
  (user) => [
    uniqueIndex("users_oidc_issuer_subject_idx").on(
      user.oidcIssuer,
      user.oidcSubject,
    ),
  ],
);

// Server-side sessions (apps/bff/src/session.ts). The browser holds a random
// token in an HttpOnly cookie; only its SHA-256 hash is stored, so a copy of
// this table can't be used to sign in. Deleting a row signs that session out.
export const userSessions = pgTable(
  "user_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Sent back to the provider on sign-out, so it ends its own session too.
    idToken: text("id_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (session) => [index("user_sessions_user_id_idx").on(session.userId)],
);

// What players report: a card that is wrong or out of line, or a problem with
// the app (apps/bff/src/reports.ts). Anonymous by design: no user, no address,
// nothing about the game being played.
export const reportStatus = pgEnum("report_status", REPORT_STATUSES);

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    // The card's reference, such as "TP-001"; null for a general report.
    cardId: text("card_id"),
    message: text().notNull().default(""),
    // What the player ticked under the thumb down (REPORT_REASONS).
    reasons: text().array().$type<ReportReason[]>().notNull().default([]),
    // What the admin did with it: still to read, dealt with, or set aside.
    status: reportStatus().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Serves the admin's list: one status, the newest first.
  (report) => [
    index("reports_status_created_at_idx").on(report.status, report.createdAt),
  ],
);

// The deck, managed from the admin (apps/bff/src/cards.ts). Players get the
// published cards of the published packs; the app also bundles a deck, used
// before the first one arrives.
export const cardStatus = pgEnum("card_status", CARD_STATUSES);
export const miniGame = pgEnum("mini_game", MINI_GAMES);
export const contentTheme = pgEnum("content_theme", CONTENT_THEMES);
export const cardAudience = pgEnum("card_audience", AUDIENCES);

export const packs = pgTable("packs", {
  // A short name, such as "officiel": cards and saved games refer to it.
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  published: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cards = pgTable(
  "cards",
  {
    // The card's reference, such as "TP-001". Never reused: a card is
    // archived, not deleted, so reports and saved games keep meaning it.
    id: text().primaryKey(),
    packId: text("pack_id")
      .notNull()
      .references(() => packs.id),
    game: miniGame().notNull(),
    level: smallint().notNull(),
    text: text().notNull(),
    themes: contentTheme().array().notNull().default([]),
    audience: cardAudience(),
    doubleTier: boolean("double_tier").notNull().default(false),
    witness: boolean().notNull().default(false),
    ruleDuration: smallint("rule_duration"),
    answer: text(),
    unit: text(),
    source: text(),
    status: cardStatus().notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Serves the players' deck: the published cards.
  (card) => [index("cards_status_idx").on(card.status)],
);

// Thumbs up from players: a count per card, and nothing about who gave them.
export const cardLikes = pgTable("card_likes", {
  cardId: text("card_id")
    .primaryKey()
    .references(() => cards.id),
  count: integer().notNull().default(0),
});

// Who changed what, and when: one row per card created or changed, with the
// card before and after. Kept as written: never updated, never deleted.
export const cardChanges = pgTable(
  "card_changes",
  {
    id: uuid().primaryKey().defaultRandom(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    adminEmail: text("admin_email").notNull(),
    action: text({ enum: ["created", "updated"] }).notNull(),
    before: jsonb().$type<Record<string, unknown>>(),
    after: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (change) => [
    index("card_changes_card_id_idx").on(change.cardId, change.createdAt),
    index("card_changes_created_at_idx").on(change.createdAt),
  ],
);
