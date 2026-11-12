import { z } from "zod";

// A report from a player: about a card, or about anything else. Anonymous:
// it carries nothing about who sent it, or about the game being played.

/** What's wrong with a card, as a player ticks it under the thumb down. */
export const REPORT_REASONS = [
  "boring",
  "too-long",
  "too-hard",
  "to-fix",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  boring: "Nulle ou ennuyeuse",
  "too-long": "Trop longue",
  "too-hard": "Trop dure",
  "to-fix": "À modifier",
};

/** A card's reference, such as "TP-001". */
const cardIdSchema = z
  .string()
  .regex(/^[A-Z]+-[A-Z0-9]+$/)
  .max(20);

export const createReportSchema = z
  .object({
    /** The card's reference, when the report is about a card. */
    cardId: cardIdSchema.optional(),
    message: z.string().trim().max(1000).default(""),
    reasons: z
      .array(z.enum(REPORT_REASONS))
      .max(REPORT_REASONS.length)
      .default([])
      .transform((reasons) => [...new Set(reasons)]),
  })
  .refine((report) => report.cardId || report.message.length >= 3, {
    message: "Dis-nous au moins quelques mots.",
    path: ["message"],
  })
  .meta({ id: "CreateReport" });

export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Thumbs up: the cards a player liked, sent together. Anonymous too. */
export const likeCardsSchema = z
  .object({ cardIds: z.array(cardIdSchema).min(1).max(50) })
  .meta({ id: "LikeCards" });

export type LikeCardsInput = z.infer<typeof likeCardsSchema>;
