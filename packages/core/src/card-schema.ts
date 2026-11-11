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
  })
  .refine(
    (card) =>
      card.game !== "culture-g" || (card.answer && card.source && card.unit),
    { message: "A culture G question needs an answer, a unit and a source" },
  )
  .meta({ id: "Card" });

export type Card = z.infer<typeof cardSchema>;
