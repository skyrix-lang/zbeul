import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import {
  CARD_PREFIXES,
  countTargets,
  type AdminCard,
  type BulkCardsInput,
  type Card,
  type CardChange,
  type CardInput,
  type Pack,
  type PackInput,
  type PublishedDeck,
} from "@zbeul/core";
import { cardChanges, cards, packs } from "@zbeul/db";
import { getDb } from "./db";

// The deck: what players receive, and what the admin manages. There is no
// user to filter by: cards are the site's content, written by the admin only
// (the routes check that, apps/bff/src/routes/api.ts). Every creation and
// change is recorded in card_changes, in the same transaction.

type CardRow = typeof cards.$inferSelect;

const toAdminCard = (row: CardRow): AdminCard => ({
  id: row.id,
  game: row.game,
  level: row.level as AdminCard["level"],
  text: row.text,
  themes: row.themes,
  packId: row.packId,
  status: row.status,
  audience: row.audience,
  doubleTier: row.doubleTier,
  witness: row.witness,
  ruleDuration: row.ruleDuration,
  answer: row.answer,
  unit: row.unit,
  source: row.source,
  updatedAt: row.updatedAt.toISOString(),
});

/** What the history keeps of a card: everything but its dates. */
const snapshot = (row: CardRow): Record<string, unknown> => {
  const { updatedAt: _updatedAt, ...card } = toAdminCard(row);
  return card;
};

/** A card as the game plays it: only what is set, and how many players it names. */
const toCard = (row: CardRow): Card => ({
  id: row.id,
  game: row.game,
  level: row.level as Card["level"],
  text: row.text,
  themes: row.themes,
  targets: countTargets(row.text) ?? 0,
  pack: row.packId,
  ...(row.audience && { audience: row.audience }),
  ...(row.doubleTier && { doubleTier: true }),
  ...(row.witness && { witness: true }),
  ...(row.ruleDuration && { ruleDuration: row.ruleDuration }),
  ...(row.answer && { answer: row.answer }),
  ...(row.unit && { unit: row.unit }),
  ...(row.source && { source: row.source }),
});

// Every player asks for the deck at the home screen, and it only changes when
// the admin saves something: built once, then reused until then (or for a
// minute, should another instance have changed it).
const DECK_TTL_MS = 60_000;
let cachedDeck: { deck: PublishedDeck; at: number } | undefined;

const forgetDeck = () => {
  cachedDeck = undefined;
};

/** The published cards of the published packs. */
export async function publishedDeck(): Promise<PublishedDeck> {
  if (cachedDeck && Date.now() - cachedDeck.at < DECK_TTL_MS) {
    return cachedDeck.deck;
  }
  const db = getDb();
  const rows = await db
    .select({ card: cards })
    .from(cards)
    .innerJoin(packs, eq(packs.id, cards.packId))
    .where(and(eq(cards.status, "published"), eq(packs.published, true)))
    .orderBy(asc(cards.id));
  const deckCards = rows.map(({ card }) => toCard(card));
  const used = new Set(deckCards.map((card) => card.pack));
  const deckPacks = (
    await db
      .select({
        id: packs.id,
        name: packs.name,
        description: packs.description,
      })
      .from(packs)
      .where(eq(packs.published, true))
      .orderBy(asc(packs.createdAt))
  ).filter((pack) => used.has(pack.id));
  const version = createHash("sha256")
    .update(JSON.stringify([deckPacks, deckCards]))
    .digest("hex")
    .slice(0, 16);
  const deck = { version, packs: deckPacks, cards: deckCards };
  cachedDeck = { deck, at: Date.now() };
  return deck;
}

export async function listCards(): Promise<AdminCard[]> {
  const rows = await getDb().select().from(cards).orderBy(asc(cards.id));
  return rows.map(toAdminCard);
}

const packExists = async (id: string) =>
  (await getDb().$count(packs, eq(packs.id, id))) > 0;

const values = (input: CardInput) => ({
  packId: input.packId,
  game: input.game,
  level: input.level,
  text: input.text,
  themes: input.themes,
  audience: input.audience,
  doubleTier: input.doubleTier,
  witness: input.witness,
  // A rule lasts 10 cards unless the card says otherwise.
  ruleDuration: input.game === "regle" ? (input.ruleDuration ?? 10) : null,
  answer: input.answer,
  unit: input.unit,
  source: input.source,
  status: input.status,
});

export type Refusal = "unknown-pack" | "game-changed";

/**
 * Creates a card. Its reference is the mini-game's prefix and the number
 * after the highest one in use, archived cards included: never reused.
 */
export async function createCard(
  input: CardInput,
  adminEmail: string,
): Promise<AdminCard | Refusal> {
  if (!(await packExists(input.packId))) return "unknown-pack";
  const prefix = `${CARD_PREFIXES[input.game]}-`;
  return getDb().transaction(async (tx) => {
    const taken = await tx
      .select({ id: cards.id })
      .from(cards)
      .where(like(cards.id, `${prefix}%`));
    const highest = Math.max(
      0,
      ...taken.map(({ id }) => Number(id.slice(prefix.length)) || 0),
    );
    const id = prefix + String(highest + 1).padStart(3, "0");
    const [row] = await tx
      .insert(cards)
      .values({ id, ...values(input) })
      .returning();
    if (!row) throw new Error("Creating the card returned no row");
    await tx.insert(cardChanges).values({
      cardId: id,
      adminEmail,
      action: "created",
      after: snapshot(row),
    });
    forgetDeck();
    return toAdminCard(row);
  });
}

/** Changes a card; undefined when there is no such card. */
export async function updateCard(
  id: string,
  input: CardInput,
  adminEmail: string,
): Promise<AdminCard | Refusal | undefined> {
  if (!(await packExists(input.packId))) return "unknown-pack";
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(cards).where(eq(cards.id, id));
    if (!before) return undefined;
    // The reference says which mini-game the card is: it stays.
    if (before.game !== input.game) return "game-changed";
    const [after] = await tx
      .update(cards)
      .set(values(input))
      .where(eq(cards.id, id))
      .returning();
    if (!after) return undefined;
    const [was, is] = [snapshot(before), snapshot(after)];
    if (JSON.stringify(was) !== JSON.stringify(is)) {
      await tx.insert(cardChanges).values({
        cardId: id,
        adminEmail,
        action: "updated",
        before: was,
        after: is,
      });
    }
    forgetDeck();
    return toAdminCard(after);
  });
}

/** The same change for several cards. Returns how many cards changed. */
export async function updateCards(
  { ids, level, status, packId }: BulkCardsInput,
  adminEmail: string,
): Promise<number | Refusal> {
  if (packId !== undefined && !(await packExists(packId))) {
    return "unknown-pack";
  }
  const change = {
    ...(level !== undefined && { level }),
    ...(status !== undefined && { status }),
    ...(packId !== undefined && { packId }),
  };
  return getDb().transaction(async (tx) => {
    const before = await tx.select().from(cards).where(inArray(cards.id, ids));
    const after = await tx
      .update(cards)
      .set(change)
      .where(inArray(cards.id, ids))
      .returning();
    const was = new Map(before.map((row) => [row.id, snapshot(row)]));
    const changes = after
      .map((row) => ({ before: was.get(row.id)!, after: snapshot(row) }))
      .filter(
        (pair) => JSON.stringify(pair.before) !== JSON.stringify(pair.after),
      )
      .map((pair) => ({
        cardId: pair.after.id as string,
        adminEmail,
        action: "updated" as const,
        ...pair,
      }));
    if (changes.length > 0) await tx.insert(cardChanges).values(changes);
    forgetDeck();
    return changes.length;
  });
}

/** The latest changes, of one card or of all, the newest first. */
export async function listChanges(cardId?: string): Promise<CardChange[]> {
  const rows = await getDb()
    .select()
    .from(cardChanges)
    .where(cardId ? eq(cardChanges.cardId, cardId) : undefined)
    .orderBy(desc(cardChanges.createdAt))
    .limit(200);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPacks(): Promise<Pack[]> {
  const rows = await getDb()
    .select({
      id: packs.id,
      name: packs.name,
      description: packs.description,
      published: packs.published,
      cards: sql<number>`count(${cards.id})::int`,
      publishedCards: sql<number>`count(${cards.id}) filter (where ${cards.status} = 'published')::int`,
    })
    .from(packs)
    .leftJoin(cards, eq(cards.packId, packs.id))
    .groupBy(packs.id)
    .orderBy(asc(packs.createdAt));
  return rows;
}

/** "Soirée couple !" becomes "soiree-couple". */
const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "pack";

export async function createPack(input: PackInput): Promise<Pack> {
  const db = getDb();
  const base = slug(input.name);
  const taken = new Set(
    (await db.select({ id: packs.id }).from(packs)).map(({ id }) => id),
  );
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  const [row] = await db
    .insert(packs)
    .values({ id, ...input })
    .returning();
  if (!row) throw new Error("Creating the pack returned no row");
  forgetDeck();
  return { ...row, cards: 0, publishedCards: 0 };
}

/** Changes a pack; undefined when there is no such pack. */
export async function updatePack(
  id: string,
  input: PackInput,
): Promise<Pack | undefined> {
  const [row] = await getDb()
    .update(packs)
    .set(input)
    .where(eq(packs.id, id))
    .returning({ id: packs.id });
  if (!row) return undefined;
  forgetDeck();
  return (await listPacks()).find((pack) => pack.id === id);
}
