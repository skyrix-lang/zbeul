import { z } from "zod";

// A report from a player: about a card, or about anything else. Anonymous:
// it carries nothing about who sent it, or about the game being played.

export const createReportSchema = z
  .object({
    /** The card's reference, when the report is about a card. */
    cardId: z
      .string()
      .regex(/^[A-Z]+-[A-Z0-9]+$/)
      .max(20)
      .optional(),
    message: z.string().trim().max(1000).default(""),
  })
  .refine((report) => report.cardId || report.message.length >= 3, {
    message: "Dis-nous au moins quelques mots.",
    path: ["message"],
  })
  .meta({ id: "CreateReport" });

export type CreateReportInput = z.infer<typeof createReportSchema>;
