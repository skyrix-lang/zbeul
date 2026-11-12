import type { ReactNode } from "react";
import {
  countTargets,
  LEVEL_NAMES,
  MINI_GAME_LABELS,
  type AdminCard,
  type Card,
  type CardChange,
  type CardStatus,
} from "@zbeul/core";

export const STATUS_LABELS: Record<CardStatus, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

/**
 * Shows a card as players see it. The game's own components do it: the app
 * passes them in, since this package doesn't depend on the game's.
 */
export type RenderCard = (
  card: Card,
  options?: { sips?: boolean; stake?: number },
) => ReactNode;

/** A card as the game plays it, from the admin's own view of it. */
export const toCard = (
  card: Pick<
    AdminCard,
    | "id"
    | "game"
    | "level"
    | "text"
    | "themes"
    | "audience"
    | "doubleTier"
    | "witness"
    | "ruleDuration"
    | "answer"
    | "unit"
    | "source"
  >,
): Card => ({
  id: card.id,
  game: card.game,
  level: card.level,
  text: card.text,
  themes: card.themes,
  targets: countTargets(card.text) ?? 0,
  ...(card.audience && { audience: card.audience }),
  ...(card.doubleTier && { doubleTier: true }),
  ...(card.witness && { witness: true }),
  ...(card.ruleDuration && { ruleDuration: card.ruleDuration }),
  ...(card.answer && { answer: card.answer }),
  ...(card.unit && { unit: card.unit }),
  ...(card.source && { source: card.source }),
});

export const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const FIELD_LABELS: Record<string, string> = {
  text: "texte",
  level: "niveau",
  status: "statut",
  packId: "pack",
  themes: "thèmes",
  audience: "public",
  doubleTier: "double palier",
  witness: "témoin",
  ruleDuration: "durée de la règle",
  answer: "réponse",
  unit: "unité",
  source: "source",
  game: "mini-jeu",
};

const show = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "rien";
  if (field === "status") return STATUS_LABELS[value as CardStatus] ?? "?";
  if (field === "level") return LEVEL_NAMES[value as 1] ?? "?";
  if (field === "game") return MINI_GAME_LABELS[value as "duel"] ?? "?";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (Array.isArray(value)) return value.join(", ") || "aucun";
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : JSON.stringify(value);
};

/** What a change did, in a few words per field: "niveau : Festif → Piquant". */
export function describeChange(change: CardChange): string[] {
  if (!change.before) return ["Carte créée"];
  const { before, after } = change;
  return Object.keys(after)
    .filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map((field) =>
      field === "text"
        ? "texte modifié"
        : `${FIELD_LABELS[field] ?? field} : ${show(field, before[field])} → ${show(field, after[field])}`,
    );
}
