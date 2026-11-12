import { z } from "zod";

// A game card, as written in specs/cartes-mvp.md and bundled with the app
// (scripts/cards.ts). A card carries no stake: the game computes it when the
// card is drawn.

export const MINI_GAMES = [
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
  "pause",
] as const;
export type MiniGame = (typeof MINI_GAMES)[number];

/** Content themes a player, or the whole game, can exclude. */
export const CONTENT_THEMES = [
  "contact",
  "sexe",
  "ex",
  "couple",
  "argent",
  "avis",
  "secrets",
  "transgressions",
] as const;
export type ContentTheme = (typeof CONTENT_THEMES)[number];

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

/** What the app calls each mini-game, level and theme. */
export const MINI_GAME_LABELS: Record<MiniGame, string> = {
  "tu-preferes": "Tu préfères",
  jamais: "J'ai déjà ou je n'ai jamais",
  "action-verite": "Action ou vérité",
  "qui-pourrait": "Qui pourrait… ?",
  tribunal: "Tribunal",
  duel: "Duel",
  "culture-g": "Culture G",
  chaine: "Chaîne de thème",
  valise: "Dans ma valise",
  "montre-ou-bois": "Montre ou bois",
  "tout-le-monde": "Tout le monde concerné",
  sentence: "Sentence gratuite",
  regle: "Invente une règle",
  partenaire: "Partenaire de boisson",
  pause: "Pause",
};

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Apéro entre potes",
  2: "Festif",
  3: "Piquant",
  4: "Sans filtre",
  5: "Border",
};

export const THEME_LABELS: Record<ContentTheme, string> = {
  contact: "Contact physique",
  sexe: "Sexualité",
  ex: "Ex",
  couple: "Couple et jalousie",
  argent: "Argent",
  avis: "Avis sur le groupe",
  secrets: "Secrets",
  transgressions: "Transgressions passées",
};

/** Who a gender card is for. */
export const AUDIENCES = ["gars", "filles", "autres"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const cardSchema = z
  .object({
    /** The card's reference, such as "TP-001". */
    id: z.string().regex(/^[A-Z]+-[A-Z0-9]+$/),
    game: z.enum(MINI_GAMES),
    level: z.union(LEVELS.map((level) => z.literal(level))),
    /** With [J1]…[J4], [durée] and [he/she/they] agreement placeholders. */
    text: z.string().min(1),
    themes: z.array(z.enum(CONTENT_THEMES)),
    /** How many players the card names: [J1] to [J4]. */
    targets: z.int().min(0).max(4),
    /** A gender card: only these players are concerned. */
    audience: z.enum(AUDIENCES).optional(),
    /** The second group named on the card takes twice the stake. */
    doubleTier: z.boolean().optional(),
    /** Another player may speak or drink, named out loud. */
    witness: z.boolean().optional(),
    /** How many cards an invented rule lasts. */
    ruleDuration: z.int().positive().optional(),
    /** For culture G: shown at the top of the next card. */
    answer: z.string().min(1).optional(),
    unit: z.string().optional(),
    source: z.string().min(1).optional(),
    /** The pack the card belongs to. Absent in the deck bundled with the app. */
    pack: z.string().optional(),
  })
  .refine(
    (card) =>
      card.game !== "culture-g" || (card.answer && card.source && card.unit),
    { message: "A culture G question needs an answer, a unit and a source" },
  )
  .meta({ id: "Card" });

export type Card = z.infer<typeof cardSchema>;

// ── Managing cards (the admin) ───────────────────────────────────────────────

/** Only published cards, of published packs, reach players. */
export const CARD_STATUSES = ["draft", "published", "archived"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

/** A card's reference starts with its mini-game's prefix: TP-001. */
export const CARD_PREFIXES: Record<MiniGame, string> = {
  "tu-preferes": "TP",
  jamais: "JOJ",
  "action-verite": "AV",
  "qui-pourrait": "QP",
  tribunal: "TRI",
  duel: "DUE",
  "culture-g": "CG",
  chaine: "CH",
  valise: "VAL",
  "montre-ou-bois": "MOB",
  "tout-le-monde": "TMC",
  sentence: "SEN",
  regle: "REG",
  partenaire: "PAR",
  pause: "PAU",
};

/** How many players a card of each mini-game names: at least, at most. */
export const CARD_TARGETS: Record<MiniGame, readonly [number, number]> = {
  "tu-preferes": [0, 0],
  jamais: [0, 1],
  "action-verite": [1, 1],
  "qui-pourrait": [0, 0],
  tribunal: [1, 1],
  duel: [2, 2],
  "culture-g": [4, 4],
  chaine: [1, 1],
  valise: [1, 1],
  "montre-ou-bois": [1, 2],
  "tout-le-monde": [0, 0],
  sentence: [1, 1],
  regle: [1, 2],
  partenaire: [1, 1],
  pause: [0, 0],
};

/**
 * How many players a text names, counting [J1] to [J4]. Null when they aren't
 * in order from [J1]: a text with [J2] but no [J1] names nobody.
 */
export function countTargets(text: string): number | null {
  const named = [
    ...new Set([...text.matchAll(/\[J([1-4])\]/g)].map((match) => +match[1]!)),
  ].sort((a, b) => a - b);
  return named.every((player, index) => player === index + 1)
    ? named.length
    : null;
}

/** What the text may hold in brackets, besides [J1] to [J4]. */
const PLACEHOLDER = /\[([^\]]*)\]/g;
const isKnownPlaceholder = (inside: string) =>
  /^J[1-4]$/.test(inside) ||
  inside === "durée" ||
  // [accusé/accusée/accusé·e]: he, she, they.
  inside.split("/").length === 3;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

/** A card as the admin writes it. The server gives it its reference. */
export const cardInputSchema = z
  .object({
    game: z.enum(MINI_GAMES),
    level: z.union(LEVELS.map((level) => z.literal(level))),
    text: z.string().trim().min(3).max(600),
    themes: z.array(z.enum(CONTENT_THEMES)).default([]),
    packId: z.string().min(1).max(60),
    status: z.enum(CARD_STATUSES).default("draft"),
    audience: z
      .enum(AUDIENCES)
      .nullish()
      .transform((value) => value ?? null),
    doubleTier: z.boolean().default(false),
    witness: z.boolean().default(false),
    ruleDuration: z
      .int()
      .min(1)
      .max(50)
      .nullish()
      .transform((value) => value ?? null),
    answer: optionalText(200),
    unit: optionalText(200),
    source: optionalText(300),
  })
  .superRefine((card, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });

    const unknown = [...card.text.matchAll(PLACEHOLDER)]
      .map((match) => match[1]!)
      .find((inside) => !isKnownPlaceholder(inside));
    if (unknown !== undefined) {
      issue("text", `Emplacement inconnu : [${unknown}]`);
    }
    const targets = countTargets(card.text);
    const [min, max] = CARD_TARGETS[card.game];
    if (targets === null) {
      issue("text", "Les joueurs se suivent : [J1], puis [J2]…");
    } else if (targets < min || targets > max) {
      issue(
        "text",
        max === 0
          ? "Ce mini-jeu ne cite aucun joueur."
          : min === max
            ? `Ce mini-jeu cite ${min} joueur${min > 1 ? "s" : ""} : [J1]${min > 1 ? ` à [J${min}]` : ""}.`
            : `Ce mini-jeu cite de ${min} à ${max} joueurs.`,
      );
    }
    if (card.text.includes("[durée]") && card.game !== "regle") {
      issue("text", "[durée] ne sert que pour « Invente une règle ».");
    }
    if (card.game === "culture-g") {
      // A question without a sourced figure isn't published.
      if (!card.answer) issue("answer", "Une question a une réponse.");
      if (!card.unit) issue("unit", "Une réponse a une unité.");
      if (!card.source) issue("source", "Une réponse a une source.");
    }
    if (card.audience && card.game !== "tout-le-monde") {
      issue("audience", "Réservé à « Tout le monde concerné ».");
    }
  })
  .meta({ id: "CardInput" });

export type CardInput = z.infer<typeof cardInputSchema>;

/** A card as the admin sees it: with its pack, its status and its age. */
export const adminCardSchema = z
  .object({
    id: z.string(),
    game: z.enum(MINI_GAMES),
    level: z.union(LEVELS.map((level) => z.literal(level))),
    text: z.string(),
    themes: z.array(z.enum(CONTENT_THEMES)),
    packId: z.string(),
    status: z.enum(CARD_STATUSES),
    audience: z.enum(AUDIENCES).nullable(),
    doubleTier: z.boolean(),
    witness: z.boolean(),
    ruleDuration: z.int().nullable(),
    answer: z.string().nullable(),
    unit: z.string().nullable(),
    source: z.string().nullable(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "AdminCard" });

export type AdminCard = z.infer<typeof adminCardSchema>;

/** The same change for several cards at once. */
export const bulkCardsSchema = z
  .object({
    ids: z.array(z.string().max(30)).min(1).max(2000),
    level: z.union(LEVELS.map((level) => z.literal(level))).optional(),
    status: z.enum(CARD_STATUSES).optional(),
    packId: z.string().min(1).max(60).optional(),
  })
  .refine(
    ({ level, status, packId }) =>
      level !== undefined || status !== undefined || packId !== undefined,
    { message: "Rien à changer", path: ["ids"] },
  )
  .meta({ id: "BulkCards" });

export type BulkCardsInput = z.infer<typeof bulkCardsSchema>;

export const packInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(200).default(""),
    published: z.boolean().default(false),
  })
  .meta({ id: "PackInput" });

export type PackInput = z.infer<typeof packInputSchema>;

export const packSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    published: z.boolean(),
    /** How many of its cards are published: what players would get. */
    publishedCards: z.int(),
    cards: z.int(),
  })
  .meta({ id: "Pack" });

export type Pack = z.infer<typeof packSchema>;

/** One line of the history: who did what to which card, and when. */
export const cardChangeSchema = z
  .object({
    id: z.uuid(),
    cardId: z.string(),
    adminEmail: z.string(),
    action: z.enum(["created", "updated"]),
    /** The card before and after, as it was stored. */
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "CardChange" });

export type CardChange = z.infer<typeof cardChangeSchema>;

/** What players receive: the published cards of the published packs. */
export const deckSchema = z
  .object({
    /** Changes whenever the deck does. */
    version: z.string(),
    packs: z.array(
      z.object({ id: z.string(), name: z.string(), description: z.string() }),
    ),
    cards: z.array(cardSchema),
  })
  .meta({ id: "Deck" });

export type PublishedDeck = z.infer<typeof deckSchema>;
