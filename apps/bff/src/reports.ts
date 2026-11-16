import { inArray, sql } from "drizzle-orm";
import type { CreateReportInput } from "@zbeul/core";
import { cardLikes, cards, reports } from "@zbeul/db";
import { getDb } from "./db";

// Reports and likes are write-only for players; the admin reads them
// (apps/bff/src/admin.ts, apps/bff/src/cards.ts). They hold no personal
// data, so there is no user to filter by. Votes change a card's chance of
// being drawn (voteWeight): the deck picks them up when its cache expires,
// within a minute, so a vote never forces every phone to download it again.

export async function createReport(input: CreateReportInput): Promise<void> {
  await getDb()
    .insert(reports)
    .values({
      cardId: input.cardId ?? null,
      message: input.message,
      reasons: input.reasons,
    });
}

/** One more like for each of these cards. A reference that isn't a card is ignored. */
export async function likeCards(cardIds: string[]): Promise<void> {
  const db = getDb();
  await db
    .insert(cardLikes)
    .select(
      db
        .select({ cardId: cards.id, count: sql<number>`1`.as("count") })
        .from(cards)
        .where(inArray(cards.id, [...new Set(cardIds)])),
    )
    .onConflictDoUpdate({
      target: cardLikes.cardId,
      set: { count: sql`${cardLikes.count} + 1` },
    });
}
